// packages/shared/src/index.ts
// ═══════════════════════════════════════════════════
// SHARED TYPES - ElderCare Agent
// Dùng chung giữa Next.js (web) và Express (api)
// ═══════════════════════════════════════════════════

// ───────────────────────────────────────────────────
// NHÓM 1 - UserProfile
// Thông tin cài đặt do con cái điền lần đầu
// ───────────────────────────────────────────────────

export type CallName = "Ba" | "Mẹ" | "Ông" | "Bà" | "Khác";

export type CheckInTime = {
  hour: number; // 0-23
  minute: number; // 0-59
};

export interface UserProfile {
  // Thông tin người được chăm sóc (ba mẹ)
  parentName: string; // Tên đầy đủ, ví dụ: "Nguyễn Văn Năm"
  callName: CallName; // Cách xưng hô: Ba/Mẹ/Ông/Bà

  // Thông tin người chăm sóc (con cái)
  childName: string; // Tên con, ví dụ: "Nam"
  childEmail: string; // Email nhận thông báo

  // Cài đặt thời gian
  timezone: string; // Mặc định: "Asia/Ho_Chi_Minh"
  morningCheckIn: CheckInTime; // Giờ nhắc buổi sáng, mặc định 7:00
  eveningCheckIn: CheckInTime; // Giờ nhắc buổi tối, mặc định 20:00

  // Cài đặt khác
  isSetupComplete: boolean; // Đã hoàn thành cài đặt chưa
  createdAt: string; // Ngày tạo hồ sơ
}

// ───────────────────────────────────────────────────
// NHÓM 2 - CheckIn
// Dữ liệu mỗi lần ba mẹ check-in
// ───────────────────────────────────────────────────

export type Feeling = "good" | "okay" | "bad";

export type CheckInSession = "morning" | "evening";

export interface CheckIn {
  id: string; // ID duy nhất
  date: string; // Ngày, ví dụ: "2024-01-15"
  time: string; // Giờ, ví dụ: "07:05"
  session: CheckInSession; // Sáng hay tối

  // Trạng thái sức khỏe
  feeling: Feeling; // good/okay/bad

  // Giọng nói (nếu ba mẹ nói)
  voiceTranscript: string; // Nội dung ba mẹ nói
  // Ví dụ: "Hôm nay mệt, đau lưng"

  // Agent phân tích ra
  symptoms: string[]; // Ví dụ: ["đau lưng", "mệt mỏi"]

  // Thuốc
  medicationTaken: boolean; // Đã uống thuốc chưa
  medicationNotes: string; // Ghi chú về thuốc nếu có

  // Metadata
  inputType: "button" | "voice" | "text"; // Ba mẹ dùng cách nào
  createdAt: string;
}

// ───────────────────────────────────────────────────
// NHÓM 3 - SymptomReport
// Agent phân tích triệu chứng từ giọng nói
// ───────────────────────────────────────────────────

export type Severity = "low" | "medium" | "high" | "emergency";

export interface Symptom {
  name: string; // Tên triệu chứng, ví dụ: "đau lưng"
  severity: Severity; // Mức độ nghiêm trọng
  consecutiveDays: number; // Số ngày liên tiếp xuất hiện
  firstDetected: string; // Ngày phát hiện lần đầu
  lastDetected: string; // Ngày phát hiện gần nhất
}

export interface SymptomReport {
  symptoms: Symptom[]; // Danh sách triệu chứng

  // Đánh giá tổng thể
  overallSeverity: Severity;
  needsAttention: boolean; // Cần chú ý không

  // Gợi ý cho con cái
  suggestion: string; // Ví dụ: "Nên gọi hỏi thăm Ba hôm nay"

  // Cảnh báo đặc biệt
  redFlags: string[]; // Triệu chứng nguy hiểm cần xử lý ngay
  // Ví dụ: ["đau ngực", "khó thở"]
  generatedAt: string;
}

// ───────────────────────────────────────────────────
// NHÓM 4 - DailyReport
// Báo cáo tổng kết 1 ngày gửi cho con cái
// ───────────────────────────────────────────────────

export type OverallStatus = "good" | "okay" | "concerning" | "critical";

export interface DailyReport {
  date: string;

  // Dữ liệu check-in
  morningCheckIn: CheckIn | null; // Check-in sáng (null nếu bỏ qua)
  eveningCheckIn: CheckIn | null; // Check-in tối (null nếu bỏ qua)

  // Đánh giá ngày
  overallStatus: OverallStatus;

  // Điểm nổi bật trong ngày
  highlights: string[];
  // Ví dụ: [
  //   "Ba đau lưng ngày thứ 3 liên tiếp",
  //   "Ba chưa check-in buổi tối"
  // ]

  // Phân tích triệu chứng
  symptomReport: SymptomReport | null;

  // Thống kê
  checkInCount: number; // Số lần check-in trong ngày (0/1/2)
  missedCheckIns: string[]; // Check-in nào bị bỏ qua

  generatedAt: string;
}

// ───────────────────────────────────────────────────
// NHÓM 5 - Alert
// Cảnh báo khi agent phát hiện bất thường
// ───────────────────────────────────────────────────

export type AlertType =
  | "SYMPTOM_CONSECUTIVE" // Triệu chứng lặp lại nhiều ngày
  | "MISSED_CHECKIN" // Không check-in
  | "RED_FLAG_SYMPTOM" // Triệu chứng nguy hiểm
  | "EMERGENCY" // Khẩn cấp
  | "MEDICATION_MISSED" // Quên uống thuốc
  | "NO_RESPONSE"; // Không phản hồi lâu

export interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;

  // Nội dung
  title: string; // Tiêu đề ngắn
  // Ví dụ: "⚠️ Ba cần được chú ý"
  message: string; // Nội dung chi tiết
  // Ví dụ: "Ba đau lưng 3 ngày liên tiếp"

  // Gợi ý hành động cho con
  action: string; // Ví dụ: "Gọi hỏi thăm Ba ngay hôm nay"

  // Trạng thái
  isRead: boolean; // Con đã đọc chưa
  isResolved: boolean; // Đã xử lý chưa

  createdAt: string;
  readAt: string | null;
}

// ───────────────────────────────────────────────────
// NHÓM 6 - Notification
// Thông báo gửi cho con cái
// ───────────────────────────────────────────────────

export type NotificationType = "web" | "email";

export interface Notification {
  id: string;
  type: NotificationType;

  // Nội dung
  subject: string; // Tiêu đề
  body: string; // Nội dung đầy đủ

  // Liên kết với alert
  alertId: string | null; // Alert liên quan nếu có

  // Trạng thái
  isDelivered: boolean;
  sentAt: string;
  deliveredAt: string | null;

  // Email cụ thể
  toEmail: string | null; // null nếu là web notification
}

// ───────────────────────────────────────────────────
// NHÓM 7 - ChatMessage
// Tin nhắn giữa ba mẹ và agent
// ───────────────────────────────────────────────────

export type MessageRole = "parent" | "agent";
export type MessageType = "text" | "voice" | "button";

export interface ChatMessage {
  id: string;
  role: MessageRole;

  // Nội dung
  content: string; // Nội dung tin nhắn
  type: MessageType; // Gõ chữ, nói, hay bấm nút

  // Nếu là voice
  audioTranscript: string | null; // Văn bản từ giọng nói

  timestamp: string;
}

// ───────────────────────────────────────────────────
// NHÓM 8 - Request & Response giữa các service
// ───────────────────────────────────────────────────

// Next.js gửi lên Express
export interface CheckInRequest {
  feeling: Feeling;
  voiceTranscript?: string; // Nếu ba mẹ nói
  inputType: "button" | "voice" | "text";
  session: CheckInSession;
  medicationTaken?: boolean;
}

// Express gửi xuống Python Agent
export interface AgentRequest {
  message: string; // Nội dung cần phân tích
  sessionId: string; // ID phiên làm việc
  context: {
    // Ngữ cảnh thêm
    feeling: Feeling;
    session: CheckInSession;
    recentSymptoms: string[]; // Triệu chứng gần đây
  };
}

// Python Agent trả về Express
export interface AgentResponse {
  // Câu trả lời cho ba mẹ
  reply: string;
  // Ví dụ: "Con hiểu rồi Ba, Ba nghỉ ngơi nhiều vào nhé"

  // Phân tích
  detectedSymptoms: string[]; // Triệu chứng phát hiện được
  severity: Severity; // Mức độ nghiêm trọng

  // Hành động cần làm
  shouldNotifyChild: boolean; // Có cần báo con không
  alerts: Alert[]; // Cảnh báo nếu có

  // Báo cáo
  report: DailyReport | null;

  sessionId: string;
}

// Express trả về Next.js
export interface CheckInResponse {
  success: boolean;
  checkIn: CheckIn; // Dữ liệu check-in đã lưu
  agentReply: string; // Câu agent nói với ba mẹ
  alerts: Alert[]; // Cảnh báo nếu có
  error?: string;
}

// ───────────────────────────────────────────────────
// NHÓM 9 - Các type tiện ích khác
// ───────────────────────────────────────────────────

// Trạng thái agent
export interface AgentStatus {
  status: "ready" | "loading" | "error";
  message: string;
  lastChecked: string;
}

// Thống kê tuần
export interface WeeklyStats {
  weekStart: string; // Ngày đầu tuần
  weekEnd: string; // Ngày cuối tuần

  totalCheckIns: number; // Tổng số lần check-in
  goodDays: number; // Số ngày khỏe
  okayDays: number; // Số ngày bình thường
  badDays: number; // Số ngày mệt
  missedDays: number; // Số ngày không check-in

  mostCommonSymptoms: string[]; // Triệu chứng hay gặp nhất
  alerts: Alert[]; // Cảnh báo trong tuần
}

// Lịch sử check-in để hiển thị trên dashboard
export interface CheckInHistory {
  date: string;
  feeling: Feeling | null; // null nếu không check-in
  hasAlert: boolean;
}
