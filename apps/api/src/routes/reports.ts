// apps/api/src/routes/reports.ts
// ═══════════════════════════════════════════════
// Route tạo báo cáo ngày và tuần
// Lấy dữ liệu từ file JSON cục bộ (Privacy-First)
// ═══════════════════════════════════════════════
import { Router } from "express";
import {
  getCheckInsByDate,
  getCheckInsInRange,
  getAlertsInRange,
} from "../lib/localStore";
import { sendDailyReportEmail } from "../services/email";
import type { OverallStatus, DailyReport, CheckIn } from "@familycare/shared";

const router = Router();

// ───────────────────────────────────────────────
// Helper - Tính tình trạng tổng thể
// ───────────────────────────────────────────────
function calcOverallStatus(
  alerts: { severity: string }[],
  checkIns: CheckIn[],
): OverallStatus {
  if (alerts.some((a) => a.severity === "emergency")) return "critical";
  if (alerts.some((a) => a.severity === "high")) return "concerning";
  if (alerts.some((a) => a.severity === "medium")) return "okay";
  if (checkIns.some((c) => c.feeling === "bad")) return "okay";
  if (checkIns.some((c) => c.feeling === "okay")) return "okay";
  return "good";
}

// ───────────────────────────────────────────────
// GET /api/reports/today
// Báo cáo sức khỏe hôm nay
// ───────────────────────────────────────────────
router.get("/today", async (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const todayCheckIns = getCheckInsByDate(today);

    const startOfDay = new Date(today);
    const endOfDay = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000);
    const todayAlerts = getAlertsInRange(startOfDay, endOfDay);

    const morningCheckIn =
      todayCheckIns.find((c) => c.session === "morning") ?? null;
    const eveningCheckIn =
      todayCheckIns.find((c) => c.session === "evening") ?? null;

    const overallStatus = calcOverallStatus(todayAlerts, todayCheckIns);

    // Tạo highlights
    const highlights: string[] = [];
    if (!morningCheckIn) highlights.push("Chưa check-in buổi sáng");
    if (!eveningCheckIn) highlights.push("Chưa check-in buổi tối");

    const allSymptoms = todayCheckIns.flatMap((c) => c.symptoms);
    const uniqueSymptoms = [...new Set(allSymptoms)];
    if (uniqueSymptoms.length > 0) {
      highlights.push(`Triệu chứng hôm nay: ${uniqueSymptoms.join(", ")}`);
    }


    const report: DailyReport = {
      date: today,
      morningCheckIn,
      eveningCheckIn,
      overallStatus,
      highlights,
      symptomReport: null,
      checkInCount: todayCheckIns.length,
      missedCheckIns: [
        ...(!morningCheckIn ? ["morning"] : []),
        ...(!eveningCheckIn ? ["evening"] : []),
      ],
      generatedAt: new Date().toISOString(),
    };

    res.json(report);
  } catch (error: any) {
    console.error(`❌ Lỗi reports/today: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// GET /api/reports/week
// Thống kê sức khỏe 7 ngày gần nhất
// ───────────────────────────────────────────────
router.get("/week", async (_req, res) => {
  try {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekCheckIns = getCheckInsInRange(weekStart, today);
    const weekAlerts = getAlertsInRange(weekStart, today);

    // Thống kê theo ngày
    const daysWithCheckIn = new Set(weekCheckIns.map((c) => c.date));

    const goodDays = [...daysWithCheckIn].filter((date) =>
      weekCheckIns
        .filter((c) => c.date === date)
        .every((c) => c.feeling === "good"),
    ).length;

    const badDays = [...daysWithCheckIn].filter((date) =>
      weekCheckIns
        .filter((c) => c.date === date)
        .some((c) => c.feeling === "bad"),
    ).length;

    const okayDays = daysWithCheckIn.size - goodDays - badDays;
    const missedDays = 7 - daysWithCheckIn.size;

    // Triệu chứng hay gặp nhất
    const allSymptoms = weekCheckIns.flatMap((c) => c.symptoms);
    const symptomCount: Record<string, number> = {};
    allSymptoms.forEach((s) => {
      symptomCount[s] = (symptomCount[s] || 0) + 1;
    });

    const mostCommonSymptoms = Object.entries(symptomCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);

    res.json({
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: today.toISOString().split("T")[0],
      totalCheckIns: weekCheckIns.length,
      goodDays,
      okayDays,
      badDays,
      missedDays,
      mostCommonSymptoms,
      alerts: weekAlerts,
    });
  } catch (error: any) {
    console.error(`❌ Lỗi reports/week: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// POST /api/reports/send-daily
// Gửi báo cáo cuối ngày qua email
// ───────────────────────────────────────────────
router.post("/send-daily", async (req, res) => {
  try {
    const { childEmail, childName, callName } = req.body;

    if (!childEmail) {
      return res.status(400).json({ error: "Thiếu thông tin email" });
    }

    const today = new Date().toISOString().split("T")[0];
    const todayCheckIns = getCheckInsByDate(today);

    const morningCheckIn =
      todayCheckIns.find((c) => c.session === "morning") ?? null;
    const eveningCheckIn =
      todayCheckIns.find((c) => c.session === "evening") ?? null;

    let overallStatus: OverallStatus = "good";
    if (todayCheckIns.some((c) => c.feeling === "bad")) {
      overallStatus = "concerning";
    } else if (todayCheckIns.some((c) => c.feeling === "okay")) {
      overallStatus = "okay";
    }

    const highlights: string[] = [];
    if (!morningCheckIn) highlights.push("Chưa check-in buổi sáng");
    if (!eveningCheckIn) highlights.push("Chưa check-in buổi tối");

    const allSymptoms = todayCheckIns.flatMap((c) => c.symptoms);
    const uniqueSymptoms = [...new Set(allSymptoms)];
    if (uniqueSymptoms.length > 0) {
      highlights.push(`Triệu chứng: ${uniqueSymptoms.join(", ")}`);
    }

    const report: DailyReport = {
      date: today,
      morningCheckIn,
      eveningCheckIn,
      overallStatus,
      highlights,
      symptomReport: null,
      checkInCount: todayCheckIns.length,
      missedCheckIns: [
        ...(!morningCheckIn ? ["morning"] : []),
        ...(!eveningCheckIn ? ["evening"] : []),
      ],
      generatedAt: new Date().toISOString(),
    };

    const toEmail =
      process.env.NODE_ENV === "development"
        ? process.env.ALERT_TO_EMAIL || childEmail
        : childEmail;

    const sent = await sendDailyReportEmail({
      toEmail,
      childName: childName || "Con",
      parentCallName: callName || "Ba/Mẹ",
      report,
    });

    res.json({
      success: sent,
      message: sent ? "Đã gửi báo cáo thành công" : "Gửi báo cáo thất bại",
      report,
    });
  } catch (error: any) {
    console.error(`❌ Lỗi send-daily: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
