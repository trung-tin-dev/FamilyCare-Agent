// apps/web/src/lib/api.ts
import axios from "axios";
import type {
  UserProfile,
  CheckInRequest,
  CheckInResponse,
  CheckIn,
  Alert,
  DailyReport,
  WeeklyStats,
} from "@familycare/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// ───────────────────────────────────────────────
// Local types cho response từ Express
// ───────────────────────────────────────────────
export interface PingResponse {
  status: string;
  service: string;
  database: string;
  pythonAgent: string;
  timestamp: string;
}

export interface TodayCheckInResponse {
  date: string;
  checkIns: CheckIn[];
  morningDone: boolean;
  eveningDone: boolean;
}

export interface CheckInHistoryResponse {
  checkIns: CheckIn[];
}

export interface AlertsResponse {
  total: number;
  unread: number;
  alerts: Alert[];
}

export interface UnreadAlertsResponse {
  total: number;
  alerts: Alert[];
}

export interface SendDailyReportResponse {
  success: boolean;
  message: string;
  report: DailyReport;
}

// ───────────────────────────────────────────────
// Health / Ping
// ───────────────────────────────────────────────
export async function pingApi() {
  const { data } = await api.get<PingResponse>("/api/ping");
  return data;
}

// ───────────────────────────────────────────────
// Check-in
// ───────────────────────────────────────────────
export async function sendCheckIn(
  payload: CheckInRequest & {
    profile: {
      childEmail: string;
      childName: string;
      callName: string;
    };
  },
) {
  const { data } = await api.post<CheckInResponse>("/api/checkin", payload);
  return data;
}

export async function getTodayCheckIns() {
  const { data } = await api.get<TodayCheckInResponse>("/api/checkin/today");
  return data;
}

export async function getCheckInHistory() {
  const { data } = await api.get<CheckInHistoryResponse>(
    "/api/checkin/history",
  );
  return data;
}

// ───────────────────────────────────────────────
// Alerts
// ───────────────────────────────────────────────
export async function getAlerts() {
  const { data } = await api.get<AlertsResponse>("/api/alerts");
  return data;
}

export async function getUnreadAlerts() {
  const { data } = await api.get<UnreadAlertsResponse>("/api/alerts/unread");
  return data;
}

export async function markAlertAsRead(id: string) {
  const { data } = await api.patch(`/api/alerts/${id}/read`);
  return data;
}

export async function resolveAlert(id: string) {
  const { data } = await api.patch(`/api/alerts/${id}/resolve`);
  return data;
}

export async function markAllAlertsAsRead() {
  const { data } = await api.patch("/api/alerts/read-all");
  return data;
}

// ───────────────────────────────────────────────
// Reports
// ───────────────────────────────────────────────
export async function getTodayReport() {
  const { data } = await api.get<DailyReport>("/api/reports/today");
  return data;
}

export async function getWeekReport() {
  const { data } = await api.get<WeeklyStats>("/api/reports/week");
  return data;
}

export async function sendDailyReportEmail(payload: {
  childEmail: string;
  childName: string;
  callName: string;
}) {
  const { data } = await api.post<SendDailyReportResponse>(
    "/api/reports/send-daily",
    payload,
  );
  return data;
}

// ───────────────────────────────────────────────
// Helper - tạo payload profile gọn cho backend
// ───────────────────────────────────────────────
export function toBackendProfile(profile: UserProfile) {
  return {
    childEmail: profile.childEmail,
    childName: profile.childName,
    callName: profile.callName,
  };
}

export default api;
