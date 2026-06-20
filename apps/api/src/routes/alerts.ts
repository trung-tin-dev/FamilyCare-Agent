// apps/api/src/routes/alerts.ts
// ═══════════════════════════════════════════════
// Route quản lý cảnh báo
// Lưu vào Neon PostgreSQL qua Prisma
// ═══════════════════════════════════════════════
import { Router } from "express";
import { prisma } from "../lib/db";

const router = Router();

// ───────────────────────────────────────────────
// GET /api/alerts
// Lấy tất cả cảnh báo
// ───────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const unreadCount = await prisma.alert.count({
      where: { isRead: false },
    });

    res.json({
      total: alerts.length,
      unread: unreadCount,
      alerts: alerts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        readAt: a.readAt?.toISOString() || null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// GET /api/alerts/unread
// Chỉ lấy cảnh báo chưa đọc
// ───────────────────────────────────────────────
router.get("/unread", async (_req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { isRead: false },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      total: alerts.length,
      alerts: alerts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        readAt: a.readAt?.toISOString() || null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// PATCH /api/alerts/read-all
// Đánh dấu tất cả đã đọc
// Phải đặt TRƯỚC /:id để không bị nhầm route
// ───────────────────────────────────────────────
router.patch("/read-all", async (_req, res) => {
  try {
    const result = await prisma.alert.updateMany({
      where: { isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    console.log(`✅ Đã đọc tất cả ${result.count} alerts`);

    res.json({
      success: true,
      markedAsRead: result.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// PATCH /api/alerts/:id/read
// Đánh dấu 1 alert đã đọc
// ───────────────────────────────────────────────
router.patch("/:id/read", async (req, res) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    console.log(`✅ Đã đọc alert: ${alert.id}`);

    res.json({
      success: true,
      alert: {
        ...alert,
        createdAt: alert.createdAt.toISOString(),
        readAt: alert.readAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    // Prisma throw lỗi nếu không tìm thấy record
    res.status(404).json({ error: "Không tìm thấy cảnh báo" });
  }
});

// ───────────────────────────────────────────────
// PATCH /api/alerts/:id/resolve
// Đánh dấu đã xử lý
// ───────────────────────────────────────────────
router.patch("/:id/resolve", async (req, res) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        isResolved: true,
        isRead: true,
        readAt: new Date(),
      },
    });

    console.log(`✅ Đã xử lý alert: ${alert.id}`);

    res.json({
      success: true,
      alert: {
        ...alert,
        createdAt: alert.createdAt.toISOString(),
        readAt: alert.readAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    res.status(404).json({ error: "Không tìm thấy cảnh báo" });
  }
});

export default router;
