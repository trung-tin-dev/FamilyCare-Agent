// apps/api/src/routes/profile.ts
// ═══════════════════════════════════════════════
// Route quản lý profile gia đình
// Lưu vào file JSON cục bộ (Privacy-First)
// ═══════════════════════════════════════════════
import { Router } from "express";
import { getStoredProfile, saveStoredProfile } from "../lib/localStore";
import type { UserProfile } from "@familycare/shared";

const router = Router();

// ───────────────────────────────────────────────
// GET /api/profile
// Lấy profile — Child Dashboard dùng endpoint này
// ───────────────────────────────────────────────
router.get("/", (_req, res) => {
  try {
    const profile = getStoredProfile();

    if (!profile) {
      return res.status(404).json({
        error: "Chưa có profile. Vui lòng setup trước.",
      });
    }

    // Trả về profile nhưng ẩn email đầy đủ (privacy)
    res.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ───────────────────────────────────────────────
// POST /api/profile
// Lưu profile khi hoàn tất setup
// ───────────────────────────────────────────────
router.post("/", (req, res) => {
  try {
    const profile = req.body as UserProfile;

    // Validate các field bắt buộc
    if (!profile.parentName || !profile.childEmail || !profile.callName) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc: parentName, childEmail, callName",
      });
    }

    const saved = saveStoredProfile({
      ...profile,
      isSetupComplete: true,
      createdAt: profile.createdAt || new Date().toISOString(),
    });

    console.log(`✅ Đã lưu profile: ${saved.callName} ${saved.parentName}`);

    res.json({
      success: true,
      profile: saved,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
