// apps/api/src/routes/checkin.ts
// ═══════════════════════════════════════════════
// Route xử lý check-in từ ba mẹ
// Lưu vào file JSON cục bộ (Privacy-First)
// ═══════════════════════════════════════════════
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { analyzeCheckIn } from "../services/pythonAgent";
import { sendAlertEmail } from "../services/email";
import {
  saveCheckIn,
  getRecentCheckIns,
  getCheckInsByDate,
} from "../lib/localStore";
import { saveAlert } from "../lib/localStore";
import { anonymizeRequest, logAnonymizationInfo } from "../lib/anonymizer";
import type {
  CheckInRequest,
  CheckInResponse,
  Alert,
  AgentRequest,
} from "@familycare/shared";

const router = Router();

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

    try {
      // Lấy triệu chứng gần đây từ local file
      const recentCheckIns = getRecentCheckIns(5);
      const recentSymptoms = recentCheckIns
        .flatMap((c) => c.symptoms)
        .filter((s, i, arr) => arr.indexOf(s) === i);

      // Tạo request cho Python Agent
      const agentRequestRaw: AgentRequest = {
        message:
          voiceTranscript ||
          `Người dùng cảm thấy ${
            feeling === "good"
              ? "khỏe"
              : feeling === "okay"
                ? "bình thường"
                : "không khỏe"
          }`,
        sessionId: uuidv4(),
        context: { feeling, session, recentSymptoms },
      };

      // 🔒 Anonymize trước khi gửi AI
      const agentRequestAnon = anonymizeRequest(agentRequestRaw);
      logAnonymizationInfo(agentRequestRaw, agentRequestAnon);

      // Gửi sang Python Agent phân tích (với dữ liệu đã ẩn danh)
      const agentResult = await analyzeCheckIn(agentRequestAnon);

      // Lưu check-in vào file local
      const newCheckIn = saveCheckIn({
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString("vi-VN"),
        session,
        feeling,
        voiceTranscript,
        symptoms: agentResult.detectedSymptoms,
        medicationTaken,
        medicationNotes: "",
        inputType,
      });

      // Xử lý cảnh báo
      const newAlerts: Alert[] = [];

      if (agentResult.shouldNotifyChild) {
        const alert = saveAlert({
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
          readAt: null,
        });

        newAlerts.push(alert);

        // Gửi email
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

      console.log(`✅ Check-in lưu local thành công - id=${newCheckIn.id}`);

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
        checkIn: {} as any,
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
router.get("/today", async (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayCheckIns = getCheckInsByDate(today);

    res.json({
      date: today,
      checkIns: todayCheckIns,
      morningDone: todayCheckIns.some((c) => c.session === "morning"),
      eveningDone: todayCheckIns.some((c) => c.session === "evening"),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// GET /api/checkin/history
// Lấy lịch sử 14 check-in gần nhất
// ───────────────────────────────────────────────
router.get("/history", async (_req, res) => {
  try {
    const checkIns = getRecentCheckIns(14);
    res.json({ checkIns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
