"""
FamilyCare AI Health Agent
Gemini 2.0 Flash + 5 MCP Tools

Luồng xử lý mỗi check-in:
  1. [MCP] read_checkins        — lấy context lịch sử
  2. [MCP] read_alerts          — biết alert nào đang mở
  3. Gọi Gemini phân tích
  4. [MCP] get_symptom_trend    — kiểm tra triệu chứng lặp
  5. [MCP] create_alert         — tạo alert nếu cần
  6. [MCP] write_checkin_symptoms — ghi symptoms vào record
"""

import os
import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
import google.generativeai as genai
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

# ── Import 5 MCP Tools ────────────────────────────────────────────────────────
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp_servers.health_mcp import (
    read_checkins,
    write_checkin_symptoms,
    read_alerts,
    create_alert,
    get_symptom_trend,
)

# ── Cấu hình môi trường ───────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("GEMINI_API_KEY chưa được cấu hình!")

# ── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FamilyCare AI Agent",
    description="Phân tích sức khỏe người lớn tuổi bằng Gemini AI + MCP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models (khớp với AgentRequest/AgentResponse trong shared types) ──

class ContextModel(BaseModel):
    feeling: str                    # "good" | "okay" | "bad"
    session: str                    # "morning" | "evening"
    recentSymptoms: list[str] = []  # Triệu chứng từ Express truyền sang


class AgentRequest(BaseModel):
    message:   str              # Tin nhắn đã ẩn danh từ anonymizer.ts
    sessionId: str
    context:   ContextModel
    checkinId: str = ""   


class AgentResponse(BaseModel):
    reply:             str          # Câu trả lời thân thiện cho ba/mẹ
    detectedSymptoms:  list[str]    # Triệu chứng AI phát hiện
    severity:          str          # "low"|"medium"|"high"|"emergency"
    shouldNotifyChild: bool         # Express dùng field này để gửi email
    alerts:            list[dict]   # Alerts đã tạo qua MCP
    report:            Optional[dict] = None
    sessionId:         str


# ── Session history (in-memory) ───────────────────────────────────────────────
# Lưu tối đa 3 lượt hỏi-đáp gần nhất per session
_sessions: dict[str, list[dict]] = {}
MAX_TURNS = 3


# ═══════════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """
Bạn là FamilyCare AI - trợ lý chăm sóc sức khỏe cho người lớn tuổi tại Việt Nam.

NHIỆM VỤ: Phân tích tin nhắn check-in sức khỏe, trả về JSON.

━━━ PHÂN LOẠI SEVERITY ━━━
• "low"       — Khỏe, bình thường, không triệu chứng
• "medium"    — Mệt nhẹ, đau nhẹ, khó ngủ → cần theo dõi
• "high"      — Đau nhiều, chóng mặt nặng, nôn, huyết áp bất thường → báo con
• "emergency" — Đau ngực, khó thở, té ngã, bất tỉnh, SOS → báo NGAY

━━━ RULES shouldNotifyChild = true ━━━
• severity là "high" hoặc "emergency"
• Triệu chứng trùng với recentSymptoms (lặp lại nhiều ngày)
• feeling = "bad" + chưa uống thuốc

━━━ TRÍCH XUẤT TRIỆU CHỨNG ━━━
Từ message + feeling, liệt kê triệu chứng cụ thể bằng tiếng Việt.
Ví dụ: ["đau lưng", "chóng mặt", "mệt mỏi"]
Nếu không có triệu chứng → trả về []

━━━ RULES PHẢN HỒI (reply) ━━━
• Bắt đầu bằng sự đồng cảm, ấm áp
• Ngôn ngữ đơn giản, gần gũi như người thân
• Câu ngắn (người cao tuổi đọc dễ)
• severity cao → thông báo nhẹ nhàng sẽ báo cho con
• Không dùng thuật ngữ y tế phức tạp

━━━ FORMAT TRẢ LỜI ━━━
Chỉ trả về JSON hợp lệ, không markdown, không giải thích thêm:
{
  "reply": "Câu trả lời thân thiện",
  "detectedSymptoms": ["triệu chứng 1", "triệu chứng 2"],
  "severity": "low|medium|high|emergency",
  "shouldNotifyChild": true/false,
  "alertTitle": "Tiêu đề cảnh báo ngắn (để trống nếu không cần)",
  "alertAction": "Hành động khuyến nghị (để trống nếu không cần)"
}
"""


# ═══════════════════════════════════════════════════════════════════════════════
# GEMINI CALLER
# ═══════════════════════════════════════════════════════════════════════════════

async def call_gemini(prompt: str, session_id: str) -> dict:
    """
    Gọi Gemini 2.0 Flash với session history.
    Trả về dict đã parse từ JSON response.
    """
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,        # Thấp = nhất quán, ít ngẫu nhiên
            max_output_tokens=512,
        ),
    )

    # Lấy history của session
    history = _sessions.get(session_id, [])
    chat    = model.start_chat(history=history)

    # Gọi API trong thread pool (SDK chưa hỗ trợ async native)
    response = await asyncio.to_thread(chat.send_message, prompt)

    # Lưu history, giới hạn MAX_TURNS lượt
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id] += [
        {"role": "user",  "parts": [prompt]},
        {"role": "model", "parts": [response.text]},
    ]
    max_msgs = MAX_TURNS * 2
    if len(_sessions[session_id]) > max_msgs:
        _sessions[session_id] = _sessions[session_id][-max_msgs:]

    # Parse JSON
    try:
        return json.loads(response.text)
    except json.JSONDecodeError:
        # Gemini đôi khi trả text thay vì JSON → fallback
        return {
            "reply":             response.text,
            "detectedSymptoms":  [],
            "severity":          "low",
            "shouldNotifyChild": False,
            "alertTitle":        "",
            "alertAction":       "",
        }


# ═══════════════════════════════════════════════════════════════════════════════
# CORE: Quy trình xử lý check-in (6 bước với MCP Tools)
# ═══════════════════════════════════════════════════════════════════════════════

async def process_checkin(request: AgentRequest) -> AgentResponse:
    """
    6 bước xử lý:
      1. [MCP] read_checkins        → context lịch sử
      2. [MCP] read_alerts          → biết alert đang mở
      3. Gọi Gemini                 → phân tích AI
      4. [MCP] get_symptom_trend    → kiểm tra lặp triệu chứng
      5. [MCP] create_alert         → tạo alert nếu cần
      6. [MCP] write_checkin_symptoms → ghi symptoms
    """

    # ── BƯỚC 1: Lấy lịch sử check-in qua MCP ────────────────────────────────
    print("🔌 [MCP] read_checkins...")
    recent = await read_checkins(limit=5)

    # Tóm tắt lịch sử cho prompt
    history_lines = []
    for ci in recent[:3]:
        feeling_vn = {"good": "khỏe", "okay": "bình thường", "bad": "không khỏe"}.get(
            ci.get("feeling", ""), "?"
        )
        syms = ", ".join(ci.get("symptoms", [])) or "không có triệu chứng"
        history_lines.append(
            f"  • {ci.get('date')} ({ci.get('session', '')}) → {feeling_vn} | {syms}"
        )
    history_ctx = (
        "\nLỊCH SỬ 3 CHECK-IN GẦN NHẤT:\n" + "\n".join(history_lines)
        if history_lines else ""
    )

    # ── BƯỚC 2: Đọc alerts đang mở qua MCP ──────────────────────────────────
    print("🔌 [MCP] read_alerts...")
    open_alerts  = await read_alerts(unresolved_only=True, limit=3)
    alert_ctx    = f"\n⚠️ Đang có {len(open_alerts)} cảnh báo chưa xử lý." if open_alerts else ""

    # ── BƯỚC 3: Xây dựng prompt và gọi Gemini ────────────────────────────────
    feeling_vn = {
        "good": "khỏe mạnh", "okay": "bình thường", "bad": "không khỏe"
    }.get(request.context.feeling, "không rõ")

    session_vn = "buổi sáng" if request.context.session == "morning" else "buổi tối"

    recent_syms = (
        ", ".join(request.context.recentSymptoms)
        if request.context.recentSymptoms else "không có"
    )

    prompt = f"""THÔNG TIN CHECK-IN:
• Thời điểm     : {session_vn}, {datetime.now().strftime("%d/%m/%Y %H:%M")}
• Trạng thái    : {feeling_vn}
• Tin nhắn      : "{request.message}"
• Triệu chứng cũ: {recent_syms}
{history_ctx}
{alert_ctx}

Phân tích và trả về JSON theo đúng định dạng."""

    print("🤖 Gọi Gemini...")
    result = await call_gemini(prompt, request.sessionId)

    # Lấy kết quả từ Gemini
    detected:      list[str] = result.get("detectedSymptoms", [])
    severity:      str       = result.get("severity", "low")
    should_notify: bool      = result.get("shouldNotifyChild", False)
    reply:         str       = result.get("reply", "Cảm ơn bạn đã check-in!")
    alert_title:   str       = result.get("alertTitle", "")
    alert_action:  str       = result.get("alertAction", "")

    # ── BƯỚC 4: Kiểm tra xu hướng triệu chứng qua MCP ───────────────────────
    if detected and severity in ("low", "medium"):
        print(f"🔌 [MCP] get_symptom_trend: {detected[0]}...")
        trend = await get_symptom_trend(detected[0], days=7)

        # Nâng severity nếu triệu chứng lặp >= 3 ngày liên tiếp
        if trend["consecutive_days"] >= 3:
            print(f"   → Lặp {trend['consecutive_days']} ngày! Nâng severity lên high")
            severity      = "high"
            should_notify = True
            reply += (
                f" Triệu chứng {detected[0]} đã xuất hiện "
                f"{trend['consecutive_days']} ngày liên tiếp, con sẽ được thông báo."
            )

    # ── BƯỚC 5: Tạo alert qua MCP nếu cần ───────────────────────────────────
    created_alerts: list[dict] = []

    if should_notify:
        print("🔌 [MCP] create_alert...")

        # Xác định loại alert
        if severity == "emergency":
            a_type = "EMERGENCY"
        elif any(
            s.lower() in [r.lower() for r in request.context.recentSymptoms]
            for s in detected
        ):
            a_type = "SYMPTOM_CONSECUTIVE"
        elif detected:
            a_type = "RED_FLAG_SYMPTOM"
        else:
            a_type = "SYMPTOM_CONSECUTIVE"

        # Tạo title/action mặc định nếu Gemini không trả về
        if not alert_title:
            alert_title = {
                "emergency": "🚨 Cần hỗ trợ khẩn cấp!",
                "high":      "⚠️ Ba/Mẹ cần được chú ý",
                "medium":    "🔔 Cập nhật sức khỏe",
            }.get(severity, "🔔 Thông báo sức khỏe")

        if not alert_action:
            alert_action = (
                "Gọi điện ngay hoặc liên hệ cấp cứu 115"
                if severity == "emergency"
                else "Gọi hỏi thăm hôm nay"
            )

        new_alert = await create_alert(
            alert_type=a_type,
            severity=severity,
            title=alert_title,
            message=(
                f'Tin nhắn: "{request.message}"'
                if request.message.strip()
                else "Người dùng báo cáo không khỏe"
            ),
            action=alert_action,
        )
        created_alerts.append(new_alert)
        print(f"   → Đã tạo alert [{a_type}] severity={severity}")

    # ── BƯỚC 6: Ghi symptoms vào đúng check-in qua MCP ──────────────────────
    # Dùng checkinId từ Express thay vì recent[0] để tránh race condition
    if detected and request.checkinId:
        print(f"🔌 [MCP] write_checkin_symptoms → id={request.checkinId}, symptoms={detected}")
        success = await write_checkin_symptoms(request.checkinId, detected)
        if success:
            print(f"   Đã cập nhật symptoms vào check-in {request.checkinId}")
        else:
            print(f"   Không tìm thấy check-in id={request.checkinId}")

    print(f"Xong: severity={severity}, notify={should_notify}, symptoms={detected}")

    return AgentResponse(
        reply=reply,
        detectedSymptoms=detected,
        severity=severity,
        shouldNotifyChild=should_notify,
        alerts=created_alerts,
        report=None,
        sessionId=request.sessionId,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Express gọi endpoint này để kiểm tra Python có sẵn không"""
    return {
        "status":            "healthy",
        "service":           "FamilyCare AI Agent",
        "gemini_configured": bool(GEMINI_API_KEY),
        "timestamp":         datetime.now().isoformat(),
    }


@app.post("/analyze", response_model=AgentResponse)
# async def analyze(request: AgentRequest):
#     """
#     Endpoint chính — Express gọi sau khi đã anonymize dữ liệu.

#     Input : AgentRequest  (message đã ẩn danh, context feeling/session)
#     Output: AgentResponse (reply, symptoms, severity, alerts)
#     """
#     if not GEMINI_API_KEY:
#         raise HTTPException(
#             status_code=503,
#             detail="GEMINI_API_KEY chưa cấu hình trong python/.env",
#         )

#     # Fast path: khỏe + không có message → không cần gọi AI
#     if not request.message.strip() and request.context.feeling == "good":
#         return AgentResponse(
#             reply="Tuyệt vời! Cảm ơn Ba/Mẹ đã check-in. Chúc ngày vui và sức khỏe! 💚",
#             detectedSymptoms=[],
#             severity="low",
#             shouldNotifyChild=False,
#             alerts=[],
#             report=None,
#             sessionId=request.sessionId,
#         )

#     try:
#         return await process_checkin(request)
#     except Exception as e:
#         print(f"❌ Lỗi xử lý: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
def analyze():
    return {
        "reply": "Con hiểu rồi ạ",
        "detectedSymptoms": ["đau đầu", "chóng mặt"],
        "severity": "medium",
        "shouldNotifyChild": False,
        "alerts": []
    }