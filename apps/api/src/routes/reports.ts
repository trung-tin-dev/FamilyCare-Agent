// apps/api/src/routes/reports.ts
// ═══════════════════════════════════════════════
// Route tạo báo cáo ngày và tuần cho con cái
// ═══════════════════════════════════════════════
import { Router } from "express";
import { checkIns, alerts } from "./checkin";
import { sendDailyReportEmail } from "../services/email";
import type {
  WeeklyStats,
  OverallStatus,
  DailyReport,
} from "@familycare/shared";

const router = Router();

// ───────────────────────────────────────────────
// GET /api/reports/today
// Báo cáo sức khỏe hôm nay
// ───────────────────────────────────────────────
router.get("/today", (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const todayCheckIns = checkIns.filter((c) => c.date === today);

  // Tìm check-in sáng và tối
  const morningCheckIn =
    todayCheckIns.find((c) => c.session === "morning") || null;

  const eveningCheckIn =
    todayCheckIns.find((c) => c.session === "evening") || null;

  // Xác định tình trạng tổng thể
  const todayAlerts = alerts.filter((a) => a.createdAt.startsWith(today));

  let overallStatus: OverallStatus = "good";

  if (todayAlerts.some((a) => a.severity === "emergency")) {
    overallStatus = "critical";
  } else if (todayAlerts.some((a) => a.severity === "high")) {
    overallStatus = "concerning";
  } else if (todayAlerts.some((a) => a.severity === "medium")) {
    overallStatus = "okay";
  } else if (todayCheckIns.some((c) => c.feeling === "bad")) {
    overallStatus = "okay";
  }

  // Tạo highlights
  const highlights: string[] = [];

  if (!morningCheckIn) {
    highlights.push("Chưa check-in buổi sáng");
  }
  if (!eveningCheckIn) {
    highlights.push("Chưa check-in buổi tối");
  }

  // Tổng hợp triệu chứng hôm nay
  const allSymptoms = todayCheckIns.flatMap((c) => c.symptoms);
  const uniqueSymptoms = [...new Set(allSymptoms)];

  if (uniqueSymptoms.length > 0) {
    highlights.push(`Triệu chứng hôm nay: ${uniqueSymptoms.join(", ")}`);
  }

  // Kiểm tra uống thuốc
  const tookMedication = todayCheckIns.some((c) => c.medicationTaken);
  if (!tookMedication && todayCheckIns.length > 0) {
    highlights.push("Chưa xác nhận uống thuốc hôm nay");
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
});

// ───────────────────────────────────────────────
// GET /api/reports/week
// Thống kê sức khỏe 7 ngày
// ───────────────────────────────────────────────
router.get("/week", (_req, res) => {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);

  // Lọc check-in trong tuần
  const weekCheckIns = checkIns.filter((c) => {
    const date = new Date(c.date);
    return date >= weekStart && date <= today;
  });

  // Tính số ngày theo từng trạng thái
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
    .map(([symptom]) => symptom);

  // Alerts trong tuần
  const weekAlerts = alerts.filter((a) => {
    const date = new Date(a.createdAt);
    return date >= weekStart && date <= today;
  });

  const weeklyStats: WeeklyStats = {
    weekStart: weekStart.toISOString().split("T")[0],
    weekEnd: today.toISOString().split("T")[0],
    totalCheckIns: weekCheckIns.length,
    goodDays,
    okayDays,
    badDays,
    missedDays,
    mostCommonSymptoms,
    alerts: weekAlerts,
  };

  res.json(weeklyStats);
});

// ───────────────────────────────────────────────
// POST /api/reports/send-daily
// Gửi báo cáo cuối ngày qua email
// ───────────────────────────────────────────────
router.post("/send-daily", async (req, res) => {
  const { childEmail, childName, callName } = req.body;

  if (!childEmail) {
    return res.status(400).json({
      error: "Thiếu thông tin email",
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const todayCheckIns = checkIns.filter((c) => c.date === today);

  const morningCheckIn =
    todayCheckIns.find((c) => c.session === "morning") || null;

  const eveningCheckIn =
    todayCheckIns.find((c) => c.session === "evening") || null;

  // Xác định tình trạng
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

  const toEmail = process.env.NODE_ENV === 'development'
    ? (process.env.ALERT_TO_EMAIL || childEmail)
    : childEmail

  const sent = await sendDailyReportEmail({
    toEmail,
    childName: childName || 'Con',
    parentCallName: callName || 'Ba/Mẹ',
    report,
  });

  res.json({
    success: sent,
    message: sent ? "Đã gửi báo cáo thành công" : "Gửi báo cáo thất bại",
    report,
  });
});

export default router;
