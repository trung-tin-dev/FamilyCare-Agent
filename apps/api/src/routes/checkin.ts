// apps/api/src/routes/checkin.ts
// ═══════════════════════════════════════════════
// Route xử lý check-in từ ba mẹ
// Lưu vào Neon PostgreSQL qua Prisma
// ═══════════════════════════════════════════════
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { analyzeCheckIn } from "../services/pythonAgent";
import { sendAlertEmail } from "../services/email";
import { prisma } from "../lib/db";
import type {
  CheckInRequest,
  CheckInResponse,
  CheckIn,
  Alert,
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
      // Lấy triệu chứng gần đây từ DB
      const recentCheckIns = await prisma.checkIn.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      const recentSymptoms = recentCheckIns
        .flatMap((c) => {
          try {
            return JSON.parse(c.symptoms) as string[];
          } catch {
            return [];
          }
        })
        .filter((s, i, arr) => arr.indexOf(s) === i);

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
        context: { feeling, session, recentSymptoms },
      });

      // Lưu check-in vào DB
      const savedCheckIn = await prisma.checkIn.create({
        data: {
          id: uuidv4(),
          date: new Date().toISOString().split("T")[0],
          time: new Date().toLocaleTimeString("vi-VN"),
          session,
          feeling,
          voiceTranscript,
          symptoms: JSON.stringify(agentResult.detectedSymptoms),
          medicationTaken,
          medicationNotes: "",
          inputType,
        },
      });

      // Chuyển sang type CheckIn
      const newCheckIn: CheckIn = {
        ...savedCheckIn,
        symptoms: JSON.parse(savedCheckIn.symptoms),
        session: savedCheckIn.session as "morning" | "evening",
        feeling: savedCheckIn.feeling as "good" | "okay" | "bad",
        inputType: savedCheckIn.inputType as "button" | "voice" | "text",
        createdAt: savedCheckIn.createdAt.toISOString(),
      };

      // Xử lý cảnh báo
      const newAlerts: Alert[] = [];

      if (agentResult.shouldNotifyChild) {
        // Lưu alert vào DB
        const savedAlert = await prisma.alert.create({
          data: {
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
          },
        });

        const alert: Alert = {
          ...savedAlert,
          type: savedAlert.type as Alert["type"],
          severity: savedAlert.severity as Alert["severity"],
          createdAt: savedAlert.createdAt.toISOString(),
          readAt: savedAlert.readAt?.toISOString() || null,
        };

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

      console.log(`✅ Check-in lưu DB thành công - id=${savedCheckIn.id}`);

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
router.get("/today", async (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const todayCheckIns = await prisma.checkIn.findMany({
      where: { date: today },
      orderBy: { createdAt: "asc" },
    });

    const formatted = todayCheckIns.map((c) => ({
      ...c,
      symptoms: JSON.parse(c.symptoms),
      createdAt: c.createdAt.toISOString(),
    }));

    res.json({
      date: today,
      checkIns: formatted,
      morningDone: formatted.some((c) => c.session === "morning"),
      eveningDone: formatted.some((c) => c.session === "evening"),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// GET /api/checkin/history
// Lấy lịch sử 14 ngày gần nhất
// ───────────────────────────────────────────────
router.get("/history", async (_req, res) => {
  try {
    const checkIns = await prisma.checkIn.findMany({
      orderBy: { createdAt: "desc" },
      take: 14,
    });

    res.json({
      checkIns: checkIns.map((c) => ({
        ...c,
        symptoms: JSON.parse(c.symptoms),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
