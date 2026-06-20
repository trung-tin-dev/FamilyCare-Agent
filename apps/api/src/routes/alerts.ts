// apps/api/src/routes/alerts.ts
// ═══════════════════════════════════════════════
// Route quản lý cảnh báo cho con cái
// ═══════════════════════════════════════════════
import { Router } from "express";
import { alerts } from "./checkin";

const router = Router();

// ───────────────────────────────────────────────
// GET /api/alerts
// Lấy tất cả cảnh báo
// ───────────────────────────────────────────────
router.get("/", (_req, res) => {
  const unread = alerts.filter((a) => !a.isRead);

  res.json({
    total: alerts.length,
    unread: unread.length,
    alerts: alerts.slice(-20), // 20 cảnh báo gần nhất
  });
});

// ───────────────────────────────────────────────
// GET /api/alerts/unread
// Chỉ lấy cảnh báo chưa đọc
// ───────────────────────────────────────────────
router.get("/unread", (_req, res) => {
  const unread = alerts.filter((a) => !a.isRead);

  res.json({
    total: unread.length,
    alerts: unread,
  });
});

// ───────────────────────────────────────────────
// PATCH /api/alerts/:id/read
// Đánh dấu đã đọc
// ───────────────────────────────────────────────
router.patch("/:id/read", (req, res) => {
  const alert = alerts.find((a) => a.id === req.params.id);

  if (!alert) {
    return res.status(404).json({
      error: "Không tìm thấy cảnh báo",
    });
  }

  alert.isRead = true;
  alert.readAt = new Date().toISOString();

  console.log(`✅ Đã đọc alert: ${alert.id}`);

  res.json({
    success: true,
    alert,
  });
});

// ───────────────────────────────────────────────
// PATCH /api/alerts/:id/resolve
// Đánh dấu đã xử lý
// ───────────────────────────────────────────────
router.patch("/:id/resolve", (req, res) => {
  const alert = alerts.find((a) => a.id === req.params.id);

  if (!alert) {
    return res.status(404).json({
      error: "Không tìm thấy cảnh báo",
    });
  }

  alert.isResolved = true;
  alert.isRead = true;
  alert.readAt = alert.readAt || new Date().toISOString();

  console.log(`✅ Đã xử lý alert: ${alert.id}`);

  res.json({
    success: true,
    alert,
  });
});

// ───────────────────────────────────────────────
// PATCH /api/alerts/read-all
// Đánh dấu tất cả đã đọc
// ───────────────────────────────────────────────
router.patch("/read-all", (_req, res) => {
  const now = new Date().toISOString();
  let count = 0;

  alerts.forEach((a) => {
    if (!a.isRead) {
      a.isRead = true;
      a.readAt = now;
      count++;
    }
  });

  console.log(`✅ Đã đọc tất cả ${count} alerts`);

  res.json({
    success: true,
    markedAsRead: count,
  });
});

export default router;
