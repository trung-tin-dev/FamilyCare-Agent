// apps/api/src/routes/checkin.ts
// ═══════════════════════════════════════════════
// Route xử lý check-in từ ba mẹ
// ═══════════════════════════════════════════════
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { analyzeCheckIn } from "../services/pythonAgent";
import { sendAlertEmail } from "../services/email";
import type {
  CheckInRequest,
  CheckInResponse,
  CheckIn,
  Alert,
} from "@familycare/shared";

const router = Router();

// Lưu trong memory
// Production: dùng file encrypted hoặc database
export const checkIns: CheckIn[] = [];
export const alerts: Alert[] = [];

// ───────────────────────────────────────────────
// POST /api/checkin
// Ba mẹ gửi check-in lên
// ───────────────────────────────────────────────
router.post(
  "/",
  async (
    req: Request<
      {},
      {},
      CheckInRequest & {
        profile: {
          childEmail: string;
          childName: string;
          callName: string;
        };
      }
    >,
    res: Response<CheckInResponse>,
  ) => {
    const {
      feeling,
      voiceTranscript = "",
      inputType,
      session,
      medicationTaken = false,
      profile,
    } = req.body;

    console.log(`\n📥 Check-in mới: feeling=${feeling}, session=${session}`);

    // Lấy triệu chứng gần đây từ lịch sử 5 lần gần nhất
    const recentSymptoms = checkIns
      .slice(-5)
      .flatMap((c) => c.symptoms)
      .filter((s, i, arr) => arr.indexOf(s) === i);

    try {
      // Gửi sang Python Agent phân tích
      const agentResult = await analyzeCheckIn({
        message:
          voiceTranscript ||
          `Ba/Mẹ cảm thấy ${
            feeling === "good"
              ? "khỏe"
              : feeling === "okay"
                ? "bình thường"
                : "không khỏe"
          }`,
        sessionId: uuidv4(),
        context: {
          feeling,
          session,
          recentSymptoms,
        },
      });

      // Tạo bản ghi check-in mới
      const newCheckIn: CheckIn = {
        id: uuidv4(),
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString("vi-VN"),
        session,
        feeling,
        voiceTranscript,
        symptoms: agentResult.detectedSymptoms,
        medicationTaken,
        medicationNotes: "",
        inputType,
        createdAt: new Date().toISOString(),
      };

      checkIns.push(newCheckIn);

      // Xử lý cảnh báo
      const newAlerts: Alert[] = [];

      if (agentResult.shouldNotifyChild) {
        const alert: Alert = {
          id: uuidv4(),
          type:
            agentResult.severity === "emergency"
              ? "EMERGENCY"
              : "SYMPTOM_CONSECUTIVE",
          severity: agentResult.severity,
          title:
            agentResult.severity === "emergency"
              ? "🚨 Cần hỗ trợ khẩn cấp!"
              : `⚠️ ${profile?.callName || "Ba/Mẹ"} cần được chú ý`,
          message: voiceTranscript
            ? `${profile?.callName || "Ba/Mẹ"} nói: "${voiceTranscript}"`
            : `${profile?.callName || "Ba/Mẹ"} cảm thấy không khỏe`,
          action:
            agentResult.severity === "emergency"
              ? "Gọi điện ngay hoặc liên hệ cấp cứu 115"
              : `Gọi hỏi thăm ${profile?.callName || "Ba/Mẹ"} hôm nay`,
          isRead: false,
          isResolved: false,
          createdAt: new Date().toISOString(),
          readAt: null,
        };

        newAlerts.push(alert);
        alerts.push(alert);

        // Gửi email nếu có thông tin profile
        // Ưu tiên dùng email trong .env khi dev
        // Khi production dùng email của con cái
        const toEmail =
          process.env.NODE_ENV === "development"
            ? process.env.ALERT_TO_EMAIL || profile?.childEmail || ""
            : profile?.childEmail || "";

        if (toEmail) {
          await sendAlertEmail({
            toEmail,
            childName: profile?.childName || "Con",
            parentCallName: profile?.callName || "Ba/Mẹ",
            alert,
          });
        }
      }

      console.log(
        `✅ Check-in xong - shouldNotify=${agentResult.shouldNotifyChild}`,
      );

      return res.json({
        success: true,
        checkIn: newCheckIn,
        agentReply: agentResult.reply,
        alerts: newAlerts,
      });
    } catch (error: any) {
      console.error(`❌ Lỗi check-in: ${error.message}`);
      return res.status(500).json({
        success: false,
        checkIn: {} as CheckIn,
        agentReply: "Xin lỗi, có lỗi xảy ra. Ba/Mẹ thử lại sau nhé!",
        alerts: [],
        error: error.message,
      });
    }
  },
);

// ───────────────────────────────────────────────
// GET /api/checkin/today
// Lấy check-in hôm nay
// ───────────────────────────────────────────────
router.get("/today", (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const todayCheckIns = checkIns.filter((c) => c.date === today);

  res.json({
    date: today,
    checkIns: todayCheckIns,
    morningDone: todayCheckIns.some((c) => c.session === "morning"),
    eveningDone: todayCheckIns.some((c) => c.session === "evening"),
  });
});

// ───────────────────────────────────────────────
// GET /api/checkin/history
// Lấy lịch sử 7 ngày gần nhất
// ───────────────────────────────────────────────
router.get("/history", (_req, res) => {
  const last14 = checkIns.slice(-14);
  res.json({ checkIns: last14 });
});

export default router;
