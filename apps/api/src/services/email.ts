// apps/api/src/services/email.ts
// ═══════════════════════════════════════════════
// Service gửi email thông báo cho con cái
// Dùng Resend (miễn phí 3000 email/tháng)
// ═══════════════════════════════════════════════
import { Resend } from "resend";
import type { Alert, DailyReport, Severity } from "@familycare/shared";

// Khởi tạo Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL || "onboarding@resend.dev";

// ───────────────────────────────────────────────
// Helper functions
// ───────────────────────────────────────────────
function getSeverityEmoji(severity: Severity): string {
  const map: Record<Severity, string> = {
    low: "ℹ️",
    medium: "⚠️",
    high: "🔴",
    emergency: "🚨",
  };
  return map[severity];
}

function getSeverityText(severity: Severity): string {
  const map: Record<Severity, string> = {
    low: "Thông tin",
    medium: "Cần chú ý",
    high: "Quan trọng",
    emergency: "KHẨN CẤP",
  };
  return map[severity];
}

function getSeverityColor(severity: Severity): string {
  const map: Record<Severity, string> = {
    low: "#16a34a",
    medium: "#d97706",
    high: "#dc2626",
    emergency: "#7f1d1d",
  };
  return map[severity];
}

function getSeverityBg(severity: Severity): string {
  const map: Record<Severity, string> = {
    low: "#f0fdf4",
    medium: "#fef3c7",
    high: "#fee2e2",
    emergency: "#450a0a",
  };
  return map[severity];
}

// ───────────────────────────────────────────────
// Gửi email cảnh báo cho con cái
// ───────────────────────────────────────────────
export async function sendAlertEmail(params: {
  toEmail: string;
  childName: string;
  parentCallName: string;
  alert: Alert;
}): Promise<boolean> {
  const { toEmail, childName, parentCallName, alert } = params;

  // Nếu chưa có API key thì log ra console
  if (!process.env.RESEND_API_KEY) {
    console.log("\n📧 [MOCK EMAIL] Chưa có RESEND_API_KEY:");
    console.log(`   To     : ${toEmail}`);
    console.log(
      `   Subject: ${getSeverityEmoji(alert.severity)} ${alert.title}`,
    );
    console.log(`   Message: ${alert.message}`);
    console.log(`   Action : ${alert.action}\n`);
    return true;
  }

  try {
    const subject = `${getSeverityEmoji(alert.severity)} [${getSeverityText(alert.severity)}] ${alert.title}`;

    const html = buildAlertEmailHtml({
      childName,
      parentCallName,
      alert,
    });

    const { data, error } = await resend.emails.send({
      from: `ElderCare Agent <${FROM_EMAIL}>`,
      to: [toEmail],
      subject,
      html,
    });

    if (error) {
      console.error(`❌ Resend lỗi: ${error.message}`);
      return false;
    }

    console.log(`✅ Email đã gửi - ID: ${data?.id}`);
    return true;
  } catch (err: any) {
    console.error(`❌ Lỗi gửi email: ${err.message}`);
    return false;
  }
}

// ───────────────────────────────────────────────
// Gửi email báo cáo cuối ngày
// ───────────────────────────────────────────────
export async function sendDailyReportEmail(params: {
  toEmail: string;
  childName: string;
  parentCallName: string;
  report: DailyReport;
}): Promise<boolean> {
  const { toEmail, childName, parentCallName, report } = params;

  // Nếu chưa có API key thì log ra console
  if (!process.env.RESEND_API_KEY) {
    console.log("\n📧 [MOCK EMAIL] Báo cáo cuối ngày:");
    console.log(`   To    : ${toEmail}`);
    console.log(`   Status: ${report.overallStatus}`);
    console.log(`   Count : ${report.checkInCount}/2 check-ins`);
    console.log(`   Notes : ${report.highlights.join(", ")}\n`);
    return true;
  }

  try {
    const statusEmoji: Record<string, string> = {
      good: "😊",
      okay: "🙂",
      concerning: "😟",
      critical: "🚨",
    };

    const subject = `📊 Sức khỏe ${parentCallName} hôm nay ${statusEmoji[report.overallStatus]} - ${new Date().toLocaleDateString("vi-VN")}`;

    const html = buildDailyReportHtml({
      childName,
      parentCallName,
      report,
      statusEmoji,
    });

    const { data, error } = await resend.emails.send({
      from: `ElderCare Agent <${FROM_EMAIL}>`,
      to: [toEmail],
      subject,
      html,
    });

    if (error) {
      console.error(`❌ Resend lỗi: ${error.message}`);
      return false;
    }

    console.log(`✅ Báo cáo ngày đã gửi - ID: ${data?.id}`);
    return true;
  } catch (err: any) {
    console.error(`❌ Lỗi gửi email báo cáo: ${err.message}`);
    return false;
  }
}

// ───────────────────────────────────────────────
// HTML Templates
// ───────────────────────────────────────────────
function buildAlertEmailHtml(params: {
  childName: string;
  parentCallName: string;
  alert: Alert;
}): string {
  const { childName, parentCallName, alert } = params;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family: Arial, sans-serif;">

  <div style="max-width:600px; margin:24px auto; border-radius:12px; overflow:hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1d4ed8; padding:24px;">
      <h1 style="color:white; margin:0; font-size:22px;">🏥 ElderCare Agent</h1>
      <p style="color:#bfdbfe; margin:4px 0 0; font-size:14px;">Thông báo sức khỏe tự động</p>
    </div>

    <!-- Alert Banner -->
    <div style="background:${getSeverityBg(alert.severity)}; padding:16px 24px; border-left:4px solid ${getSeverityColor(alert.severity)};">
      <p style="margin:0; font-size:18px; font-weight:bold; color:${getSeverityColor(alert.severity)};">
        ${getSeverityEmoji(alert.severity)} ${alert.title}
      </p>
    </div>

    <!-- Body -->
    <div style="background:white; padding:24px;">

      <p style="font-size:16px; color:#374151; margin:0 0 16px;">
        Xin chào <strong>${childName}</strong>,
      </p>

      <p style="font-size:16px; color:#374151; margin:0 0 20px; line-height:1.6;">
        ElderCare Agent vừa phát hiện thông tin cần bạn chú ý 
        về <strong>${parentCallName}</strong>:
      </p>

      <!-- Alert Box -->
      <div style="background:#f9fafb; border-radius:8px; padding:20px; margin:0 0 20px; border:1px solid #e5e7eb;">
        <p style="font-size:15px; color:#111827; margin:0 0 8px; font-weight:bold;">
          📋 Tình trạng:
        </p>
        <p style="font-size:15px; color:#374151; margin:0 0 16px; line-height:1.6;">
          ${alert.message}
        </p>
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;">
        <p style="font-size:15px; color:#111827; margin:0 0 8px; font-weight:bold;">
          💡 Gợi ý:
        </p>
        <p style="font-size:15px; color:#374151; margin:0;">
          ${alert.action}
        </p>
      </div>

      <!-- Emergency Banner -->
      ${
        alert.severity === "emergency"
          ? `
      <div style="background:#fee2e2; border-radius:8px; padding:16px; margin:0 0 20px; border:1px solid #fca5a5;">
        <p style="color:#dc2626; font-weight:bold; margin:0 0 8px; font-size:16px;">
          🚨 Tình huống khẩn cấp!
        </p>
        <p style="color:#dc2626; margin:0; font-size:15px; line-height:1.6;">
          Hãy gọi điện ngay cho ${parentCallName} 
          hoặc liên hệ cấp cứu <strong>115</strong>.
        </p>
      </div>
      `
          : ""
      }

      <p style="font-size:13px; color:#9ca3af; margin:0;">
        Thời gian: ${new Date().toLocaleString("vi-VN")}
      </p>

    </div>

    <!-- Footer -->
    <div style="background:#f3f4f6; padding:16px 24px; text-align:center;">
      <p style="margin:0; font-size:12px; color:#6b7280;">
        🔒 ElderCare Agent · Dữ liệu được mã hóa và bảo mật
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();
}

function buildDailyReportHtml(params: {
  childName: string;
  parentCallName: string;
  report: DailyReport;
  statusEmoji: Record<string, string>;
}): string {
  const { childName, parentCallName, report, statusEmoji } = params;

  const statusColor: Record<string, string> = {
    good: "#16a34a",
    okay: "#d97706",
    concerning: "#dc2626",
    critical: "#7f1d1d",
  };

  const statusText: Record<string, string> = {
    good: "Tốt",
    okay: "Bình thường",
    concerning: "Cần chú ý",
    critical: "Khẩn cấp",
  };

  const feelingEmoji: Record<string, string> = {
    good: "😊",
    okay: "🙂",
    bad: "😔",
  };

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family: Arial, sans-serif;">

  <div style="max-width:600px; margin:24px auto; border-radius:12px; overflow:hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1d4ed8; padding:24px;">
      <h1 style="color:white; margin:0; font-size:22px;">🏥 ElderCare Agent</h1>
      <p style="color:#bfdbfe; margin:4px 0 0; font-size:14px;">
        Báo cáo sức khỏe · ${new Date().toLocaleDateString("vi-VN")}
      </p>
    </div>

    <!-- Body -->
    <div style="background:white; padding:24px;">

      <p style="font-size:16px; color:#374151; margin:0 0 16px;">
        Xin chào <strong>${childName}</strong>,
      </p>

      <p style="font-size:16px; color:#374151; margin:0 0 20px;">
        Đây là báo cáo sức khỏe của <strong>${parentCallName}</strong> hôm nay:
      </p>

      <!-- Overall Status -->
      <div style="background:#f9fafb; border-radius:8px; padding:20px; margin:0 0 16px; text-align:center; border:1px solid #e5e7eb;">
        <p style="font-size:48px; margin:0;">${statusEmoji[report.overallStatus]}</p>
        <p style="font-size:18px; font-weight:bold; color:${statusColor[report.overallStatus]}; margin:8px 0 0;">
          ${statusText[report.overallStatus]}
        </p>
        <p style="font-size:14px; color:#6b7280; margin:4px 0 0;">
          ${report.checkInCount}/2 lần check-in hôm nay
        </p>
      </div>

      <!-- Check-in Details -->
      <div style="background:#f9fafb; border-radius:8px; padding:20px; margin:0 0 16px; border:1px solid #e5e7eb;">
        <p style="font-size:15px; font-weight:bold; color:#111827; margin:0 0 12px;">
          📋 Chi tiết check-in
        </p>

        <!-- Morning -->
        <div style="display:flex; align-items:flex-start; margin:0 0 12px;">
          <span style="font-size:20px; margin-right:8px;">☀️</span>
          <div>
            <p style="font-size:14px; font-weight:bold; color:#374151; margin:0;">Buổi sáng</p>
            <p style="font-size:14px; color:#6b7280; margin:2px 0 0;">
              ${
                report.morningCheckIn
                  ? `${feelingEmoji[report.morningCheckIn.feeling]} ${report.morningCheckIn.voiceTranscript || "Đã check-in"}`
                  : "❌ Chưa check-in"
              }
            </p>
          </div>
        </div>

        <!-- Evening -->
        <div style="display:flex; align-items:flex-start;">
          <span style="font-size:20px; margin-right:8px;">🌙</span>
          <div>
            <p style="font-size:14px; font-weight:bold; color:#374151; margin:0;">Buổi tối</p>
            <p style="font-size:14px; color:#6b7280; margin:2px 0 0;">
              ${
                report.eveningCheckIn
                  ? `${feelingEmoji[report.eveningCheckIn.feeling]} ${report.eveningCheckIn.voiceTranscript || "Đã check-in"}`
                  : "❌ Chưa check-in"
              }
            </p>
          </div>
        </div>
      </div>

      <!-- Highlights -->
      ${
        report.highlights.length > 0
          ? `
      <div style="background:#fef3c7; border-radius:8px; padding:20px; margin:0 0 16px; border:1px solid #fde68a;">
        <p style="font-size:15px; font-weight:bold; color:#92400e; margin:0 0 12px;">
          ⚠️ Điểm cần lưu ý
        </p>
        ${report.highlights
          .map(
            (h) => `
          <p style="font-size:14px; color:#78350f; margin:4px 0;">• ${h}</p>
        `,
          )
          .join("")}
      </div>
      `
          : ""
      }

      <p style="font-size:13px; color:#9ca3af; margin:0;">
        Báo cáo lúc: ${new Date().toLocaleString("vi-VN")}
      </p>

    </div>

    <!-- Footer -->
    <div style="background:#f3f4f6; padding:16px 24px; text-align:center;">
      <p style="margin:0; font-size:12px; color:#6b7280;">
        🔒 ElderCare Agent · Dữ liệu được mã hóa và bảo mật
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();
}
