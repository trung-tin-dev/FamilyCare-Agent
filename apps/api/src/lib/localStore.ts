// apps/api/src/lib/localStore.ts
// ═══════════════════════════════════════════════
// Privacy-First Local Storage
// Dữ liệu lưu dưới dạng JSON trên máy chủ cục bộ
// Không gửi lên bất kỳ cloud database nào
// ═══════════════════════════════════════════════
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { CheckIn, Alert, UserProfile } from "@familycare/shared";

// ───────────────────────────────────────────────
// Đường dẫn lưu dữ liệu
// data/ nằm cùng cấp với thư mục src/
// ───────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const CHECKINS_FILE = path.join(DATA_DIR, "checkins.json");
const ALERTS_FILE = path.join(DATA_DIR, "alerts.json");

// ───────────────────────────────────────────────
// Khởi tạo thư mục và file nếu chưa tồn tại
// ───────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Tạo thư mục lưu dữ liệu: ${DATA_DIR}`);
  }
}

function ensureFile(filePath: string, defaultValue: unknown[]) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
  }
}

// ───────────────────────────────────────────────
// Helper đọc / ghi file an toàn
// ───────────────────────────────────────────────
function readJson<T>(filePath: string, defaultValue: T[]): T[] {
  try {
    ensureFile(filePath, []);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T[];
  } catch (err) {
    console.error(`❌ Lỗi đọc file ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJson<T>(filePath: string, data: T[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`❌ Lỗi ghi file ${filePath}:`, err);
    throw err;
  }
}

// ═══════════════════════════════════════════════
// CHECK-IN STORE
// ═══════════════════════════════════════════════

export function getCheckIns(): CheckIn[] {
  return readJson<CheckIn>(CHECKINS_FILE, []);
}

export function saveCheckIn(
  data: Omit<CheckIn, "id" | "createdAt">,
): CheckIn {
  const checkIns = getCheckIns();

  const newCheckIn: CheckIn = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...data,
  };

  checkIns.push(newCheckIn);
  writeJson(CHECKINS_FILE, checkIns);

  console.log(`💾 Đã lưu check-in local: id=${newCheckIn.id}`);
  return newCheckIn;
}

export function getCheckInsByDate(date: string): CheckIn[] {
  return getCheckIns().filter((c) => c.date === date);
}

export function getRecentCheckIns(limit = 5): CheckIn[] {
  const all = getCheckIns();
  return all
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

export function getCheckInsInRange(from: Date, to: Date): CheckIn[] {
  return getCheckIns().filter((c) => {
    const t = new Date(c.createdAt).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });
}

// ═══════════════════════════════════════════════
// ALERT STORE
// ═══════════════════════════════════════════════

export function getAlerts(): Alert[] {
  return readJson<Alert>(ALERTS_FILE, []);
}

export function saveAlert(data: Omit<Alert, "id" | "createdAt">): Alert {
  const alerts = getAlerts();

  const newAlert: Alert = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...data,
  };

  alerts.push(newAlert);
  writeJson(ALERTS_FILE, alerts);

  console.log(`💾 Đã lưu alert local: id=${newAlert.id}`);
  return newAlert;
}

export function updateAlert(
  id: string,
  patch: Partial<Alert>,
): Alert | null {
  const alerts = getAlerts();
  const idx = alerts.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  alerts[idx] = { ...alerts[idx], ...patch };
  writeJson(ALERTS_FILE, alerts);
  return alerts[idx];
}

export function updateManyAlerts(
  filter: (a: Alert) => boolean,
  patch: Partial<Alert>,
): number {
  const alerts = getAlerts();
  let count = 0;
  for (let i = 0; i < alerts.length; i++) {
    if (filter(alerts[i])) {
      alerts[i] = { ...alerts[i], ...patch };
      count++;
    }
  }
  writeJson(ALERTS_FILE, alerts);
  return count;
}

export function getUnreadAlerts(): Alert[] {
  return getAlerts().filter((a) => !a.isRead);
}

export function getAlertsInRange(from: Date, to: Date): Alert[] {
  return getAlerts().filter((a) => {
    const t = new Date(a.createdAt).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });
}

export function getAlertById(id: string): Alert | null {
  return getAlerts().find((a) => a.id === id) ?? null;
}

// ═══════════════════════════════════════════════
// PROFILE - Lưu/đọc cấu hình gia đình
// ═══════════════════════════════════════════════
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");

export function getStoredProfile(): UserProfile | null {
  try {
    if (!fs.existsSync(PROFILE_FILE)) return null;
    const raw = fs.readFileSync(PROFILE_FILE, "utf-8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveStoredProfile(profile: UserProfile): UserProfile {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), "utf-8");
  return profile;
}