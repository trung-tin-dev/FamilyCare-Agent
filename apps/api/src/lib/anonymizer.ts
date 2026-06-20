// apps/api/src/lib/anonymizer.ts
// ═══════════════════════════════════════════════
// Privacy-First: Anonymize dữ liệu trước khi gửi AI
// Đảm bảo Python Agent không nhận thông tin cá nhân
// ═══════════════════════════════════════════════
import type { AgentRequest } from "@familycare/shared";

// ───────────────────────────────────────────────
// Danh sách pattern cần xóa khỏi text
// ───────────────────────────────────────────────
const NAME_PATTERNS = [
  // Email
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Số điện thoại VN
  /(\+84|0)(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}/g,
];

/**
 * Xóa thông tin cá nhân khỏi một đoạn văn bản.
 * Thay email, số điện thoại bằng placeholder.
 */
function sanitizeText(text: string): string {
  let result = text;
  result = result.replace(NAME_PATTERNS[0], "[email]");
  result = result.replace(NAME_PATTERNS[1], "[số điện thoại]");
  return result;
}

// ───────────────────────────────────────────────
// Anonymize AgentRequest trước khi gửi Python Agent
// Chỉ giữ lại thông tin y tế, xóa thông tin cá nhân
// ───────────────────────────────────────────────
export function anonymizeRequest(request: AgentRequest): AgentRequest {
  return {
    // sessionId: dùng UUID, không có thông tin cá nhân
    sessionId: request.sessionId,

    // message: xóa thông tin nhạy cảm
    message: sanitizeText(request.message),

    // context: chỉ giữ thông tin y tế
    context: {
      feeling: request.context.feeling,
      session: request.context.session,
      recentSymptoms: request.context.recentSymptoms,
      // Không bao gồm: tên, email, địa chỉ
    },
  };
}

/**
 * Log để xác nhận anonymization (chỉ trong development)
 */
export function logAnonymizationInfo(
  original: AgentRequest,
  anonymized: AgentRequest,
) {
  if (process.env.NODE_ENV !== "development") return;

  const originalLen = JSON.stringify(original).length;
  const anonymizedLen = JSON.stringify(anonymized).length;

  console.log(
    `🔒 Anonymized request: ${originalLen} → ${anonymizedLen} chars`,
  );
  console.log(
    `   Message gửi AI: "${anonymized.message.slice(0, 60)}${anonymized.message.length > 60 ? "..." : ""}"`,
  );
}
