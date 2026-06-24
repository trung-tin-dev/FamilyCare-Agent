// apps/api/src/services/pythonAgent.ts
// ═══════════════════════════════════════════════
// Service kết nối với Python Agent
// Gửi tin nhắn và nhận kết quả phân tích
// ═══════════════════════════════════════════════
import axios from "axios";
import type {
  AgentRequest,
  AgentResponse,
  Feeling,
  Severity,
} from "@familycare/shared";

// ── Port 8001 để không xung đột với Express (3001) ───────────────────────────
const PYTHON_URL = process.env.PYTHON_AGENT_URL || "http://localhost:8001";

// ───────────────────────────────────────────────
// Kiểm tra Python Agent có đang chạy không
// ───────────────────────────────────────────────
async function isPythonAlive(): Promise<boolean> {
  try {
    await axios.get(`${PYTHON_URL}/health`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export { isPythonAlive as checkPythonAgentHealth };

// ───────────────────────────────────────────────
// Gửi tin nhắn sang Python Agent để phân tích
// ───────────────────────────────────────────────
export async function analyzeCheckIn(
  request: AgentRequest,
): Promise<AgentResponse> {
  // Kiểm tra Python có sẵn không
  const alive = await isPythonAlive();

  if (!alive) {
    console.warn("Python Agent chưa chạy");
  }

  try {
    console.log(
      `Gửi sang Python Agent: "${request.message.slice(0, 50)}..."`,
    );

    // ── Gọi đúng endpoint /analyze ────────────────────────────────────────
    const response = await axios.post<AgentResponse>(
      `${PYTHON_URL}/analyze`,
      request,
      { timeout: 30000 },
    );

    console.log(
      `Python Agent trả về: severity=${response.data.severity}, notify=${response.data.shouldNotifyChild}`,
    );
    return response.data;
  } catch (error: any) {
    console.error(`Python Agent lỗi: ${error.message}`);
    return createMockResponse(request);
  }
}

// ───────────────────────────────────────────────
// Mock response khi Python Agent chưa chạy
// ───────────────────────────────────────────────
function createMockResponse(request: AgentRequest): AgentResponse {
  const { feeling, recentSymptoms } = request.context;

  let reply = "";
  let severity: Severity = "low";
  let shouldNotify = false;

  if (feeling === "good") {
    reply = `Con mừng khi nghe Ba/Mẹ khỏe! Nhớ uống nước nhiều và nghỉ ngơi đầy đủ nhé!`;
    severity = "low";
    shouldNotify = false;
  } else if (feeling === "okay") {
    reply = `Con hiểu rồi ạ. Nếu có gì không khỏe thì Ba/Mẹ cứ nói cho con biết nhé!`;
    severity = "low";
    shouldNotify = false;
  } else {
    const isEmergency =
      /đau ngực|khó thở|ngã|té|bất tỉnh|xỉu|cấp cứu|sos/i.test(request.message);

    if (isEmergency) {
      reply = `Con lo cho Ba/Mẹ lắm! Con sẽ liên hệ ngay. Ba/Mẹ ngồi nghỉ và đừng đi lại nhiều nhé!`;
      severity = "emergency";
      shouldNotify = true;
    } else if (recentSymptoms.length >= 2) {
      reply = `Con thấy Ba/Mẹ không khỏe mấy ngày rồi. Con sẽ gọi hỏi thăm sớm nhé. Ba/Mẹ nghỉ ngơi nhiều vào!`;
      severity = "medium";
      shouldNotify = true;
    } else {
      reply = `Con hiểu rồi Ba/Mẹ ơi. Hôm nay không khỏe thì nghỉ ngơi nhiều vào nhé. Nếu mệt hơn thì Ba/Mẹ nhớ bấm nút gọi con!`;
      severity = "low";
      shouldNotify = false;
    }
  }

  const detectedSymptoms = detectSymptomsFromText(request.message);

  return {
    reply,
    detectedSymptoms,
    severity,
    shouldNotifyChild: shouldNotify,
    alerts: [],
    report: null,
    sessionId: request.sessionId,
  };
}

// ───────────────────────────────────────────────
// Phát hiện triệu chứng từ text (dùng cho mock)
// ───────────────────────────────────────────────
function detectSymptomsFromText(text: string): string[] {
  const symptomKeywords: Record<string, string> = {
    "đau đầu": "đau đầu",
    "nhức đầu": "đau đầu",
    "đau lưng": "đau lưng",
    "nhức lưng": "đau lưng",
    "chóng mặt": "chóng mặt",
    "hoa mắt": "chóng mặt",
    "mệt": "mệt mỏi",
    "mệt mỏi": "mệt mỏi",
    "buồn nôn": "buồn nôn",
    "nôn": "buồn nôn",
    "đau bụng": "đau bụng",
    "đau ngực": "đau ngực",
    "khó thở": "khó thở",
    "tê tay": "tê tay chân",
    "tê chân": "tê tay chân",
    "sốt": "sốt",
    "ho": "ho",
    "mất ngủ": "mất ngủ",
    "ngủ không ngon": "mất ngủ",
    "không ăn được": "chán ăn",
    "chán ăn": "chán ăn",
  };

  const found = new Set<string>();
  const lower = text.toLowerCase();

  for (const [keyword, name] of Object.entries(symptomKeywords)) {
    if (lower.includes(keyword)) found.add(name);
  }

  return Array.from(found);
}
