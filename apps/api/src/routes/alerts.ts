// apps/api/src/routes/alerts.ts
// ═══════════════════════════════════════════════
// Route quản lý cảnh báo
// Lưu vào file JSON cục bộ (Privacy-First)
// ═══════════════════════════════════════════════
import { Router } from "express";
import {
  getAlerts,
  getUnreadAlerts,
  updateAlert,
  updateManyAlerts,
  getAlertById,
} from "../lib/localStore";

const router = Router();

// ───────────────────────────────────────────────
// GET /api/alerts
// Lấy 20 cảnh báo gần nhất
// ───────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const all = getAlerts()
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 20);

    const unreadCount = all.filter((a) => !a.isRead).length;

    res.json({
      total: all.length,
      unread: unreadCount,
      alerts: all,
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
    const alerts = getUnreadAlerts().sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    res.json({
      total: alerts.length,
      alerts,
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
    const count = updateManyAlerts(
      (a) => !a.isRead,
      { isRead: true, readAt: new Date().toISOString() },
    );

    console.log(`✅ Đã đọc tất cả ${count} alerts`);

    res.json({
      success: true,
      markedAsRead: count,
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
    const alert = updateAlert(req.params.id, {
      isRead: true,
      readAt: new Date().toISOString(),
    });

    if (!alert) {
      return res.status(404).json({ error: "Không tìm thấy cảnh báo" });
    }

    console.log(`✅ Đã đọc alert: ${alert.id}`);
    res.json({ success: true, alert });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// PATCH /api/alerts/:id/resolve
// Đánh dấu đã xử lý
// ───────────────────────────────────────────────
router.patch("/:id/resolve", async (req, res) => {
  try {
    const alert = updateAlert(req.params.id, {
      isResolved: true,
      isRead: true,
      readAt: new Date().toISOString(),
    });

    if (!alert) {
      return res.status(404).json({ error: "Không tìm thấy cảnh báo" });
    }

    console.log(`✅ Đã xử lý alert: ${alert.id}`);
    res.json({ success: true, alert });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
