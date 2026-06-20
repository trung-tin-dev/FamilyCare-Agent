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
  CheckInSession,
  Severity,
} from "@familycare/shared";

const PYTHON_URL = process.env.PYTHON_AGENT_URL || "http://localhost:8000";

// ───────────────────────────────────────────────
// Gửi tin nhắn sang Python Agent để phân tích
// ───────────────────────────────────────────────
export async function analyzeCheckIn(
  request: AgentRequest,
): Promise<AgentResponse> {
  try {
    console.log(`📤 Gửi sang Python Agent: ${request.message.slice(0, 50)}...`);

    const response = await axios.post<AgentResponse>(
      `${PYTHON_URL}/chat`,
      request,
      { timeout: 30000 },
    );

    console.log(
      `📥 Nhận từ Python Agent: ${response.data.reply.slice(0, 50)}...`,
    );
    return response.data;
  } catch (error: any) {
    // Nếu Python Agent chưa chạy, dùng mock response để test
    console.warn("⚠️  Python Agent chưa sẵn sàng, dùng mock response");
    return createMockResponse(request);
  }
}

// ───────────────────────────────────────────────
// Kiểm tra Python Agent có đang chạy không
// ───────────────────────────────────────────────
export async function checkPythonAgentHealth(): Promise<boolean> {
  try {
    await axios.get(`${PYTHON_URL}/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────
// Mock response khi Python Agent chưa chạy
// Dùng để test Next.js và Express trước
// ───────────────────────────────────────────────
function createMockResponse(request: AgentRequest): AgentResponse {
  const { feeling, recentSymptoms } = request.context;

  // Tạo câu trả lời dựa trên cảm giác
  let reply = "";
  let severity: Severity = "low";
  let shouldNotify = false;

  if (feeling === "good") {
    reply = `Con mừng khi nghe ${request.context.session === "morning" ? "buổi sáng" : "buổi tối"} hôm nay Ba/Mẹ khỏe! Ba/Mẹ nhớ uống nước nhiều và nghỉ ngơi đầy đủ nhé! 😊`;
    severity = "low";
    shouldNotify = false;
  } else if (feeling === "okay") {
    reply = `Con hiểu rồi ạ. Ba/Mẹ bình thường là tốt rồi. Nếu có gì không khỏe thì Ba/Mẹ cứ nói cho con biết nhé! 🙂`;
    severity = "low";
    shouldNotify = false;
  } else {
    // Feeling bad - phân tích thêm
    const hasSerious =
      request.message.toLowerCase().includes("đau ngực") ||
      request.message.toLowerCase().includes("khó thở") ||
      request.message.toLowerCase().includes("ngã");

    if (hasSerious) {
      reply = `Con lo cho Ba/Mẹ lắm! Triệu chứng này cần được chú ý ngay. Con sẽ liên hệ ngay bây giờ. Ba/Mẹ ngồi nghỉ và đừng đi lại nhiều nhé! 🆘`;
      severity = "emergency";
      shouldNotify = true;
    } else if (recentSymptoms.length >= 2) {
      reply = `Con thấy Ba/Mẹ không khỏe mấy ngày rồi. Con sẽ gọi hỏi thăm sớm nhé. Ba/Mẹ nghỉ ngơi nhiều vào, uống đủ nước và đừng làm việc nặng! 💙`;
      severity = "medium";
      shouldNotify = true;
    } else {
      reply = `Con hiểu rồi Ba/Mẹ ơi. Hôm nay không khỏe thì nghỉ ngơi nhiều vào nhé. Nếu mệt hơn thì Ba/Mẹ nhớ bấm nút gọi con! 💙`;
      severity = "low";
      shouldNotify = false;
    }
  }

  // Phân tích triệu chứng từ text
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
// Phát hiện triệu chứng từ text
// ───────────────────────────────────────────────
function detectSymptomsFromText(text: string): string[] {
  const symptomKeywords: Record<string, string> = {
    "đau đầu": "đau đầu",
    "nhức đầu": "đau đầu",
    "đau lưng": "đau lưng",
    "nhức lưng": "đau lưng",
    "chóng mặt": "chóng mặt",
    "hoa mắt": "chóng mặt",
    mệt: "mệt mỏi",
    "mệt mỏi": "mệt mỏi",
    "buồn nôn": "buồn nôn",
    nôn: "buồn nôn",
    "đau bụng": "đau bụng",
    "đau ngực": "đau ngực",
    "khó thở": "khó thở",
    "tê tay": "tê tay chân",
    "tê chân": "tê tay chân",
    sốt: "sốt",
    ho: "ho",
    "ngủ không ngon": "mất ngủ",
    "mất ngủ": "mất ngủ",
    "không ăn được": "chán ăn",
    "không muốn ăn": "chán ăn",
  };

  const found: Set<string> = new Set();
  const lowerText = text.toLowerCase();

  for (const [keyword, symptomName] of Object.entries(symptomKeywords)) {
    if (lowerText.includes(keyword)) {
      found.add(symptomName);
    }
  }

  return Array.from(found);
}
