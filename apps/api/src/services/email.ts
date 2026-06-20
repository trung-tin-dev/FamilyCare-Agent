// apps/api/src/services/email.ts
import { Resend } from "resend";
import type { Alert, DailyReport, Severity } from "@familycare/shared";

// ───────────────────────────────────────────────
// Khởi tạo lười (Lazy Getter)
// Sẽ không bao giờ gây crash server khi khởi động
// ───────────────────────────────────────────────
function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.includes("your_api_key")) {
    return null;
  }
  return new Resend(key);
}

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
// Gửi email cảnh báo
// ───────────────────────────────────────────────
export async function sendAlertEmail(params: {
  toEmail: string;
  childName: string;
  parentCallName: string;
  alert: Alert;
}): Promise<boolean> {
  const { toEmail, childName, parentCallName, alert } = params;

  const resend = getResendClient();

  // Nếu không có API Key, giả lập gửi email (Mock)
  if (!resend) {
    console.log("\n📧 [MOCK EMAIL] Sẽ gửi email trong production:");
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

    const html = buildAlertEmailHtml({ childName, parentCallName, alert });

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

  const resend = getResendClient();

  if (!resend) {
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
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:20px; background:#f3f4f6; font-family: sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:white; border-radius:12px; overflow:hidden;">
    <div style="background:#1d4ed8; padding:20px; color:white;">
      <h2 style="margin:0;">🏥 ElderCare Agent</h2>
    </div>
    <div style="padding:20px;">
      <p>Xin chào <strong>${childName}</strong>,</p>
      <p>Phát hiện thông tin cần chú ý về <strong>${parentCallName}</strong>:</p>
      <div style="background:#f9fafb; padding:15px; border-radius:8px; border:1px solid #e5e7eb;">
        <p><strong>Tình trạng:</strong> ${alert.message}</p>
        <p><strong>Gợi ý:</strong> ${alert.action}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
}

function buildDailyReportHtml(params: {
  childName: string;
  parentCallName: string;
  report: DailyReport;
  statusEmoji: Record<string, string>;
}): string {
  const { childName, parentCallName, report, statusEmoji } = params;
  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:20px; background:#f3f4f6; font-family: sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:white; border-radius:12px; overflow:hidden;">
    <div style="background:#1d4ed8; padding:20px; color:white;">
      <h2 style="margin:0;">📊 Báo cáo sức khỏe ${parentCallName}</h2>
    </div>
    <div style="padding:20px;">
      <h1 style="text-align:center;">${statusEmoji[report.overallStatus]}</h1>
      <p>Số lần check-in hôm nay: ${report.checkInCount}/2</p>
      <ul>${report.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>
    </div>
  </div>
</body>
</html>`.trim();
}
