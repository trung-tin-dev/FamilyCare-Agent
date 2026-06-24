// apps/api/src/routes/checkin.ts
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { analyzeCheckIn } from "../services/pythonAgent";
import { sendAlertEmail } from "../services/email";
import {
  saveCheckIn,
  getRecentCheckIns,
  getCheckInsByDate,
  saveAlert,
} from "../lib/localStore";
import { anonymizeRequest, logAnonymizationInfo } from "../lib/anonymizer";
import type {
  CheckInRequest,
  CheckInResponse,
  Alert,
  AgentRequest,
} from "@familycare/shared";

const router = Router();

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
      inputType,
      session,
      profile,
    } = req.body;

    console.log(`\n Check-in mới: feeling=${feeling}, session=${session}`);

    try {
      // ── Lấy triệu chứng gần đây ──────────────────────────────────────────
      const recentCheckIns = getRecentCheckIns(5);
      const recentSymptoms = recentCheckIns
        .flatMap((c) => c.symptoms)
        .filter((s, i, arr) => arr.indexOf(s) === i);

      // ── BƯỚC 1: Lưu check-in TRƯỚC (symptoms rỗng) ───────────────────────
      // Fix race condition: lưu trước để Python Agent đọc đúng check-in mới
      const newCheckIn = saveCheckIn({
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString("vi-VN"),
        session,
        feeling,
        symptoms: [], // Rỗng, Python sẽ điền sau
        inputType,
      });

      console.log(`Đã lưu check-in trước: id=${newCheckIn.id}`);

      // ── BƯỚC 2: Tạo AgentRequest (kèm checkinId) ─────────────────────────
      const agentRequestRaw: AgentRequest & { checkinId?: string } = {
        message:
          `Người dùng cảm thấy ${
            feeling === "good"
              ? "khỏe"
              : feeling === "okay"
                ? "bình thường"
                : "không khỏe"
          }`,
        sessionId: uuidv4(),
        context: { feeling, session, recentSymptoms },
        checkinId: newCheckIn.id, // Truyền ID để Python ghi đúng chỗ
      };

      // ── BƯỚC 3: Ẩn danh trước khi gửi AI ────────────────────────────────
      const agentRequestAnon = anonymizeRequest(
        agentRequestRaw as AgentRequest,
      );
      // Giữ lại checkinId sau khi anonymize (không phải PII)
      (agentRequestAnon as any).checkinId = newCheckIn.id;

      logAnonymizationInfo(agentRequestRaw as AgentRequest, agentRequestAnon);

      // ── BƯỚC 4: Gọi Python Agent phân tích ───────────────────────────────
      const agentResult = await analyzeCheckIn(agentRequestAnon);

      // ── BƯỚC 5: Xử lý cảnh báo và email ─────────────────────────────────
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
          message:
            `${profile?.callName || "Ba/Mẹ"} cảm thấy không khỏe`,
          action:
            agentResult.severity === "emergency"
              ? "Gọi điện ngay hoặc liên hệ cấp cứu 115"
              : `Gọi hỏi thăm ${profile?.callName || "Ba/Mẹ"} hôm nay`,
          isRead: false,
          isResolved: false,
          readAt: null,
        });

        newAlerts.push(alert);

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
        `✅ Hoàn tất check-in id=${newCheckIn.id}, severity=${agentResult.severity}`,
      );

      // Trả về check-in với symptoms đã được Python cập nhật
      // (Python đã ghi vào file, đọc lại để lấy symptoms mới nhất)
      const updatedCheckIns = getRecentCheckIns(1);
      const finalCheckIn =
        updatedCheckIns.find((c) => c.id === newCheckIn.id) || newCheckIn;

      return res.json({
        success: true,
        checkIn: finalCheckIn,
        agentReply: agentResult.reply,
        alerts: newAlerts,
      });
    } catch (error: any) {
      console.error(`Lỗi check-in: ${error.message}`);
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

// GET /api/checkin/today
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

// GET /api/checkin/history
router.get("/history", async (_req, res) => {
  try {
    const checkIns = getRecentCheckIns(14);
    res.json({ checkIns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
