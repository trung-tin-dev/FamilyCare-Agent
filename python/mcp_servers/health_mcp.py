"""
FamilyCare MCP Server
5 Tools cho AI Agent tương tác với dữ liệu sức khỏe local

Tools:
  1. read_checkins         — Lấy lịch sử check-in để AI có context
  2. write_checkin_symptoms — Cập nhật symptoms sau khi AI phân tích
  3. read_alerts           — Xem alerts đang mở
  4. create_alert          — Tạo cảnh báo mới cho con
  5. get_symptom_trend     — Kiểm tra triệu chứng lặp bao nhiêu ngày
"""

import json
import uuid
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
import os

import aiofiles
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from datetime import timezone, timedelta as td

VN_TZ = timezone(td(hours=7))   # GMT+7

# ── Cấu hình đường dẫn ───────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent / ".env")

DATA_DIR      = Path(os.getenv("DATA_DIR", "../apps/api/data"))
CHECKINS_FILE = DATA_DIR / "checkins.json"
ALERTS_FILE   = DATA_DIR / "alerts.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)

# File lock — tránh race condition khi đọc/ghi đồng thời
_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: Đọc / Ghi JSON bất đồng bộ
# ═══════════════════════════════════════════════════════════════════════════════

async def _read_json(path: Path, default=None) -> list | dict:
    """Đọc file JSON async. Trả về default nếu file không tồn tại hoặc rỗng."""
    if default is None:
        default = []
    try:
        if not path.exists():
            return default
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            raw = await f.read()
        return json.loads(raw) if raw.strip() else default
    except (json.JSONDecodeError, IOError):
        return default


async def _write_json(path: Path, data: list | dict) -> None:
    """Ghi dữ liệu xuống file JSON async, tạo thư mục nếu chưa có."""
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, ensure_ascii=False, indent=2))


# ═══════════════════════════════════════════════════════════════════════════════
# MCP TOOL 1 — read_checkins
# ═══════════════════════════════════════════════════════════════════════════════

async def read_checkins(limit: int = 5) -> list[dict]:
    """
    MCP Tool: Lấy N check-in gần nhất.

    AI Agent gọi tool này để biết:
    - Ba/Mẹ gần đây khỏe hay không
    - Triệu chứng nào đã xuất hiện trước đó
    - Đã uống thuốc chưa

    Args:
        limit: Số check-in tối đa (mặc định 5)

    Returns:
        List check-in sắp xếp mới nhất trước, mỗi item gồm:
        id, date, time, session, feeling, voiceTranscript,
        symptoms, medicationTaken, createdAt
    """
    async with _locks[str(CHECKINS_FILE)]:
        data = await _read_json(CHECKINS_FILE, default=[])

    # Sắp xếp mới nhất trước
    data.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return data[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# MCP TOOL 2 — write_checkin_symptoms
# ═══════════════════════════════════════════════════════════════════════════════

async def write_checkin_symptoms(checkin_id: str, symptoms: list[str]) -> bool:
    """
    MCP Tool: Cập nhật triệu chứng vào check-in đã tồn tại.

    Express tạo record check-in trước, Python Agent phân tích
    xong rồi gọi tool này để ghi symptoms vào đúng record.

    Args:
        checkin_id: ID của check-in cần cập nhật
        symptoms:   Danh sách triệu chứng AI phát hiện được
                    Ví dụ: ["đau lưng", "chóng mặt"]

    Returns:
        True nếu tìm thấy và cập nhật thành công
        False nếu không tìm thấy ID
    """
    async with _locks[str(CHECKINS_FILE)]:
        data = await _read_json(CHECKINS_FILE, default=[])

        found = False
        for item in data:
            if item.get("id") == checkin_id:
                item["symptoms"]  = symptoms
                item["updatedAt"] = datetime.now().isoformat()
                found = True
                break

        if found:
            await _write_json(CHECKINS_FILE, data)

    return found


# ═══════════════════════════════════════════════════════════════════════════════
# MCP TOOL 3 — read_alerts
# ═══════════════════════════════════════════════════════════════════════════════

async def read_alerts(unresolved_only: bool = True, limit: int = 10) -> list[dict]:
    """
    MCP Tool: Đọc danh sách cảnh báo sức khỏe.

    AI Agent dùng tool này để biết hiện tại có bao nhiêu
    cảnh báo chưa xử lý — tránh tạo alert trùng lặp.

    Args:
        unresolved_only: Chỉ lấy alert chưa xử lý (mặc định True)
        limit:           Số lượng tối đa trả về

    Returns:
        List alert sắp xếp mới nhất trước, mỗi item gồm:
        id, type, severity, title, message, action,
        isRead, isResolved, createdAt
    """
    async with _locks[str(ALERTS_FILE)]:
        data = await _read_json(ALERTS_FILE, default=[])

    if unresolved_only:
        data = [a for a in data if not a.get("isResolved", False)]

    data.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return data[:limit]


# ═══════════════════════════════════════════════════════════════════════════════
# MCP TOOL 4 — create_alert
# ═══════════════════════════════════════════════════════════════════════════════

async def create_alert(
    alert_type: str,
    severity:   str,
    title:      str,
    message:    str,
    action:     str,
) -> dict:
    """
    MCP Tool: Tạo cảnh báo mới và lưu vào file local.

    AI Agent gọi tool này khi phát hiện tình trạng cần
    thông báo cho con cái.

    Args:
        alert_type: Loại alert — "SYMPTOM_CONSECUTIVE" | "RED_FLAG_SYMPTOM"
                    | "EMERGENCY" | "MEDICATION_MISSED" | "MISSED_CHECKIN"
        severity:   Mức độ — "low" | "medium" | "high" | "emergency"
        title:      Tiêu đề ngắn, ví dụ: "⚠️ Ba cần được chú ý"
        message:    Nội dung chi tiết cho con đọc
        action:     Hành động khuyến nghị, ví dụ: "Gọi hỏi thăm hôm nay"

    Returns:
        Alert object đã lưu, có đầy đủ id và createdAt
    """
    new_alert = {
        "id":         str(uuid.uuid4()),
        "createdAt":  datetime.now().isoformat(),
        "type":       alert_type,
        "severity":   severity,
        "title":      title,
        "message":    message,
        "action":     action,
        "isRead":     False,
        "isResolved": False,
        "readAt":     None,
    }

    async with _locks[str(ALERTS_FILE)]:
        data = await _read_json(ALERTS_FILE, default=[])
        data.append(new_alert)
        await _write_json(ALERTS_FILE, data)

    return new_alert


# ═══════════════════════════════════════════════════════════════════════════════
# MCP TOOL 5 — get_symptom_trend
# ═══════════════════════════════════════════════════════════════════════════════

async def get_symptom_trend(symptom: str, days: int = 7) -> dict:
    """
    MCP Tool: Kiểm tra một triệu chứng xuất hiện bao nhiêu ngày liên tiếp.

    AI Agent dùng tool này để quyết định có nâng cấp severity không.
    Ví dụ: "đau lưng" xuất hiện 3 ngày liên tiếp → nâng từ medium lên high.

    Args:
        symptom: Tên triệu chứng cần kiểm tra, ví dụ: "đau lưng"
        days:    Số ngày nhìn lại (mặc định 7)

    Returns:
        {
            "symptom":          "đau lưng",
            "occurrences":      3,        # tổng số lần xuất hiện
            "consecutive_days": 3,        # ngày liên tiếp gần nhất
            "dates":            ["2026-06-20", "2026-06-19", "2026-06-18"]
        }
    """
    async with _locks[str(CHECKINS_FILE)]:
        data = await _read_json(CHECKINS_FILE, default=[])

    # Lọc trong khoảng 'days' ngày gần nhất
    # cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    cutoff = (datetime.now(VN_TZ) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    relevant = [
        c for c in data
        if c.get("date", "") >= cutoff
        and any(
            symptom.lower() in s.lower()
            for s in c.get("symptoms", [])
        )
    ]

    # Danh sách ngày unique, sắp xếp mới nhất trước
    dates = sorted(set(c["date"] for c in relevant), reverse=True)

    # Đếm ngày liên tiếp gần nhất tính từ hôm nay trở về trước
    consecutive = 0
    if dates:
        expected = datetime.now(VN_TZ).date()
        for d_str in dates:
            d = datetime.strptime(d_str, "%Y-%m-%d").date()
            diff = (expected - d).days
            if diff <= 1:           # cho phép lệch 1 ngày (sáng/tối)
                consecutive += 1
                expected = d
            else:
                break

    return {
        "symptom":          symptom,
        "occurrences":      len(relevant),
        "consecutive_days": consecutive,
        "dates":            dates,
    }