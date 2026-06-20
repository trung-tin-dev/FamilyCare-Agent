// apps/web/src/lib/storage.ts
import type { UserProfile, CallName } from "@familycare/shared";

const PROFILE_KEY = "familycare_profile";

// ───────────────────────────────────────────────
// Helper
// ───────────────────────────────────────────────
function isBrowser() {
  return typeof window !== "undefined";
}

// ───────────────────────────────────────────────
// Default profile
// ───────────────────────────────────────────────
export function createDefaultProfile(): UserProfile {
  return {
    parentName: "",
    callName: "Ba" as CallName,
    childName: "",
    childEmail: "",
    timezone: "Asia/Ho_Chi_Minh",
    morningCheckIn: {
      hour: 7,
      minute: 0,
    },
    eveningCheckIn: {
      hour: 20,
      minute: 0,
    },
    isSetupComplete: false,
    createdAt: new Date().toISOString(),
  };
}

// ───────────────────────────────────────────────
// Read profile
// ───────────────────────────────────────────────
export function getProfile(): UserProfile | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────
// Save profile
// ───────────────────────────────────────────────
export function saveProfile(profile: UserProfile) {
  if (!isBrowser()) return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// ───────────────────────────────────────────────
// Update profile
// ───────────────────────────────────────────────
export function updateProfile(partial: Partial<UserProfile>) {
  if (!isBrowser()) return;

  const current = getProfile() || createDefaultProfile();
  const nextProfile: UserProfile = {
    ...current,
    ...partial,
  };

  saveProfile(nextProfile);
  return nextProfile;
}

// ───────────────────────────────────────────────
// Check setup
// ───────────────────────────────────────────────
export function hasCompletedSetup() {
  const profile = getProfile();
  return !!profile?.isSetupComplete;
}

// ───────────────────────────────────────────────
// Clear profile
// ───────────────────────────────────────────────
export function clearProfile() {
  if (!isBrowser()) return;
  localStorage.removeItem(PROFILE_KEY);
}
