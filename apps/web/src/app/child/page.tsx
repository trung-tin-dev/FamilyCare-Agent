// apps/web/src/app/child/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAlerts,
  getCheckInHistory,
  getTodayReport,
  getWeekReport,
  markAlertAsRead,
  resolveAlert,
  markAllAlertsAsRead,
  sendDailyReportEmail,
  getProfileFromServer,
} from "@/lib/api";
import type {
  Alert,
  CheckIn,
  DailyReport,
  WeeklyStats,
  UserProfile,
} from "@familycare/shared";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "alerts" | "timeline" | "report";

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEVERITY_STYLE = {
  emergency: {
    border: "border-red-400",
    bg: "bg-red-50",
    badge: "bg-red-500 text-white",
    label: "Khẩn cấp",
  },
  high: {
    border: "border-orange-400",
    bg: "bg-orange-50",
    badge: "bg-orange-500 text-white",
    label: "Nghiêm trọng",
  },
  medium: {
    border: "border-yellow-400",
    bg: "bg-yellow-50",
    badge: "bg-yellow-400 text-gray-800",
    label: "Cần chú ý",
  },
  low: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    badge: "bg-blue-400 text-white",
    label: "Thông tin",
  },
} as const;

const FEELING_CONFIG = {
  good: {
    label: "Khỏe",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  okay: {
    label: "Bình thường",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  bad: {
    label: "Không khỏe",
    color: "text-red-600",
    bg: "bg-red-50",
  },
} as const;

const STATUS_CONFIG = {
  good: {
    label: "Tốt",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  okay: {
    label: "Bình thường",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  concerning: {
    label: "Đáng lo ngại",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  critical: {
    label: "Nguy cấp",
    color: "text-red-600",
    bg: "bg-red-50",
  },
} as const;

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ChildDashboard() {
  const [tab, setTab] = useState<Tab>("alerts");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  // ── Fetch tất cả dữ liệu ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [profileRes, alertsRes, checkinsRes, reportRes, weeklyRes] =
        await Promise.allSettled([
          getProfileFromServer(),
          getAlerts(),
          getCheckInHistory(),
          getTodayReport(),
          getWeekReport(),
        ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.profile ?? null);
      }
      if (alertsRes.status === "fulfilled") {
        setAlerts(alertsRes.value.alerts ?? []);
      }
      if (checkinsRes.status === "fulfilled") {
        setCheckins(checkinsRes.value.checkIns ?? []);
      }
      if (reportRes.status === "fulfilled") {
        setReport(reportRes.value ?? null);
      }
      if (weeklyRes.status === "fulfilled") {
        setWeekly(weeklyRes.value ?? null);
      }
    } catch {
      setError(
        "Không thể tải dữ liệu. Kiểm tra Express server đang chạy chưa.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

useEffect(() => {
  const initTimer = setTimeout(() => {
    void fetchAll();
  }, 0);

  const timer = setInterval(() => {
    void fetchAll();
  }, 30_000);

  return () => {
    clearTimeout(initTimer);
    clearInterval(timer);
  };
}, [fetchAll]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleMarkRead = async (id: string) => {
    try {
      await markAlertAsRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
      );
    } catch {
      console.error("Lỗi đánh dấu đã đọc");
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, isResolved: true, isRead: true } : a,
        ),
      );
    } catch {
      console.error("Lỗi resolve alert");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsAsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch {
      console.error("Lỗi đánh dấu tất cả đã đọc");
    }
  };

  const handleSendEmail = async () => {
    if (!profile) return;
    setSending(true);
    try {
      await sendDailyReportEmail({
        childEmail: profile.childEmail,
        childName: profile.childName,
        callName: profile.callName,
      });
      setSentOk(true);
      setTimeout(() => setSentOk(false), 3000);
    } catch {
      console.error("Lỗi gửi email");
    } finally {
      setSending(false);
    }
  };

  // ── Thống kê nhanh ────────────────────────────────────────────────────────
  const unreadCount = alerts.filter((a) => !a.isRead && !a.isResolved).length;
  const activeAlerts = alerts.filter((a) => !a.isResolved);
  const resolvedAlerts = alerts.filter((a) => a.isResolved);
  const callName = profile?.callName ?? "Ba/Mẹ";

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-blue-600">🏥 FamilyCare</h1>
            <p className="text-xs text-gray-400">
              Theo dõi sức khỏe {callName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Badge khẩn cấp */}
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                {unreadCount} mới
              </span>
            )}

            {/* Refresh */}
            <button
              onClick={fetchAll}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Làm mới"
            >
              <span className={loading ? "animate-spin inline-block" : ""}>
                🔄
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-xl">❌</span>
            <div className="flex-1">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={fetchAll}
              className="text-red-500 text-xs underline shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* ── Trạng thái tổng quan hôm nay ─────────────────────────────────── */}
        {report && <OverallStatusCard report={report} callName={callName} />}

        {/* ── Stats row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon="📋"
            value={report?.checkInCount ?? 0}
            label="Check-in hôm nay"
            color="blue"
          />
          <StatCard
            icon="⚠️"
            value={activeAlerts.length}
            label="Cảnh báo chờ"
            color={activeAlerts.length > 0 ? "orange" : "green"}
          />
          <StatCard
            icon="📅"
            value={`${weekly?.goodDays ?? 0}/${7 - (weekly?.missedDays ?? 0)}`}
            label="Ngày khỏe/tuần"
            color="green"
          />
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="flex bg-white rounded-2xl border border-gray-200 p-1">
          {(
            [
              { key: "alerts", label: "🔔 Cảnh Báo", count: unreadCount },
              { key: "timeline", label: "📝 Lịch Sử", count: 0 },
              { key: "report", label: "📊 Báo Cáo", count: 0 },
            ] satisfies { key: Tab; label: string; count: number }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`
      flex-1 py-2 px-2 rounded-xl text-sm font-medium transition-all
      ${
        tab === t.key
          ? "bg-blue-500 text-white shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }
    `}
            >
              {t.label}
              {t.count > 0 ? (
                <span className="ml-1 bg-red-500 text-white text-xs px-1.5 rounded-full">
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {tab === "alerts" && (
              <AlertsTab
                active={activeAlerts}
                resolved={resolvedAlerts}
                onMarkRead={handleMarkRead}
                onResolve={handleResolve}
                onMarkAllRead={handleMarkAllRead}
              />
            )}
            {tab === "timeline" && (
              <TimelineTab checkins={checkins} callName={callName} />
            )}
            {tab === "report" && (
              <ReportTab
                report={report}
                weekly={weekly}
                callName={callName}
                onSendEmail={handleSendEmail}
                sending={sending}
                sentOk={sentOk}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Overall Status Card ───────────────────────────────────────────────────────
function OverallStatusCard({
  report,
}: {
  report: DailyReport;
  callName: string;
}) {
  const cfg = STATUS_CONFIG[report.overallStatus] ?? STATUS_CONFIG.okay;

  return (
    <div className={`${cfg.bg} rounded-2xl p-5 border border-gray-100`}>
      <div className="flex items-center gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Tình trạng hôm nay
          </p>
          <p className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">Check-in</p>
          <p className="text-lg font-bold text-gray-700">
            {report.checkInCount}/2
          </p>
        </div>
      </div>

      {/* Highlights */}
      {report.highlights.length > 0 && (
        <div className="space-y-1">
          {report.highlights.map((h, i) => (
            <p key={i} className="text-sm text-gray-600 flex items-start gap-2">
              <span>•</span>
              <span>{h}</span>
            </p>
          ))}
        </div>
      )}

      {/* Check-in sáng / tối */}
      <div className="flex gap-3 mt-3">
        <SessionBadge
          label="☀️ Sáng"
          done={!!report.morningCheckIn}
          feeling={report.morningCheckIn?.feeling}
        />
        <SessionBadge
          label="🌙 Tối"
          done={!!report.eveningCheckIn}
          feeling={report.eveningCheckIn?.feeling}
        />
      </div>
    </div>
  );
}

function SessionBadge({
  label,
  done,
}: {
  label: string;
  done: boolean;
  feeling?: string;
}) {

  return (
    <div
      className={`
        flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium
        ${
          done ? "bg-white border border-gray-200" : "bg-gray-100 text-gray-400"
        }
      `}
    >
      <span>{label}</span>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number | string;
  label: string;
  color: "blue" | "green" | "orange" | "red";
}) {
  const colorMap = {
    blue: "text-blue-600",
    green: "text-green-600",
    orange: "text-orange-500",
    red: "text-red-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

// ── AlertsTab ─────────────────────────────────────────────────────────────────
function AlertsTab({
  active,
  resolved,
  onMarkRead,
  onResolve,
  onMarkAllRead,
}: {
  active: Alert[];
  resolved: Alert[];
  onMarkRead: (id: string) => void;
  onResolve: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const unread = active.filter((a) => !a.isRead);

  if (active.length === 0 && resolved.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="Không có cảnh báo"
        desc={`Mọi thứ đang ổn định. Ba/Mẹ khỏe mạnh!`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header với nút đọc tất cả */}
      {unread.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Chưa xử lý ({active.length})
          </p>
          <button
            onClick={onMarkAllRead}
            className="text-xs text-blue-500 hover:text-blue-700 underline"
          >
            Đọc tất cả
          </button>
        </div>
      )}

      {/* Active alerts */}
      {active.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onMarkRead={onMarkRead}
          onResolve={onResolve}
        />
      ))}

      {/* Resolved alerts */}
      {resolved.length > 0 && (
        <>
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-2">
            Đã xử lý ({resolved.length})
          </p>
          {resolved.slice(0, 5).map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onMarkRead={onMarkRead}
              onResolve={onResolve}
              dimmed
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── AlertCard ─────────────────────────────────────────────────────────────────
function AlertCard({
  alert,
  onMarkRead,
  onResolve,
  dimmed = false,
}: {
  alert: Alert;
  onMarkRead: (id: string) => void;
  onResolve: (id: string) => void;
  dimmed?: boolean;
}) {
  const sev = alert.severity as keyof typeof SEVERITY_STYLE;
  const cfg = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.low;

  return (
    <div
      className={`
        border-l-4 ${cfg.border} ${cfg.bg} rounded-2xl p-4
        ${dimmed ? "opacity-50" : ""}
        ${!alert.isRead ? "shadow-sm" : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          {!alert.isRead && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              Mới
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0 ml-2">
          {formatTime(alert.createdAt)}
        </span>
      </div>

      {/* Title */}
      <p className="font-semibold text-gray-800 text-sm mb-1">{alert.title}</p>

      {/* Message */}
      <p className="text-sm text-gray-600 mb-2">{alert.message}</p>

      {/* Action gợi ý */}
      <p className="text-xs text-gray-500 bg-white/60 rounded-lg px-3 py-1.5 mb-3">
        💡 {alert.action}
      </p>

      {/* Buttons */}
      {!alert.isResolved && (
        <div className="flex gap-2">
          {!alert.isRead && (
            <button
              onClick={() => onMarkRead(alert.id)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Đã xem
            </button>
          )}
          <button
            onClick={() => onResolve(alert.id)}
            className="
              text-xs bg-white border border-gray-300 text-gray-700
              px-3 py-1 rounded-lg hover:bg-gray-50 transition-colors
            "
          >
            ✓ Đã xử lý
          </button>
        </div>
      )}
    </div>
  );
}

// ── TimelineTab ───────────────────────────────────────────────────────────────
function TimelineTab({
  checkins,
  callName,
}: {
  checkins: CheckIn[];
  callName: string;
}) {
  if (checkins.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="Chưa có lịch sử"
        desc={`${callName} chưa check-in lần nào`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        14 check-in gần nhất
      </p>

      {checkins.map((ci) => {
        const feelingCfg =
          FEELING_CONFIG[ci.feeling as keyof typeof FEELING_CONFIG] ??
          FEELING_CONFIG.okay;

        return (
          <div
            key={ci.id}
            className="bg-white border border-gray-200 rounded-2xl p-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div>
                  <p className={`text-sm font-semibold ${feelingCfg.color}`}>
                    {feelingCfg.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {ci.session === "morning" ? "☀️ Sáng" : "🌙 Tối"} •{" "}
                    {formatDate(ci.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Symptoms */}
            {ci.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ci.symptoms.map((s) => (
                  <span
                    key={s}
                    className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ReportTab ─────────────────────────────────────────────────────────────────
function ReportTab({
  report,
  weekly,
  callName,
  onSendEmail,
  sending,
  sentOk,
}: {
  report: DailyReport | null;
  weekly: WeeklyStats | null;
  callName: string;
  onSendEmail: () => void;
  sending: boolean;
  sentOk: boolean;
}) {
  if (!report && !weekly) {
    return (
      <EmptyState
        icon="📊"
        title="Chưa có báo cáo"
        desc={`${callName} chưa check-in hôm nay`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Báo cáo ngày */}
      {report && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-700 mb-4">📋 Hôm nay</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center bg-gray-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-blue-600">
                {report.checkInCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">Lần check-in</p>
            </div>
            <div className="text-center bg-gray-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-orange-500">
                {report.missedCheckIns.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Bỏ lỡ</p>
            </div>
          </div>

          {/* Symptoms hôm nay */}
          {(() => {
            const allSymptoms = [
              ...(report.morningCheckIn?.symptoms ?? []),
              ...(report.eveningCheckIn?.symptoms ?? []),
            ];
            const unique = [...new Set(allSymptoms)];
            return unique.length > 0 ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Triệu chứng hôm nay:
                </p>
                <div className="flex flex-wrap gap-1">
                  {unique.map((s) => (
                    <span
                      key={s}
                      className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Báo cáo tuần */}
      {weekly && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-700 mb-4">📅 7 ngày qua</h3>

          {/* Thanh tiến trình các ngày */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              {
                label: "😊 Khỏe",
                value: weekly.goodDays,
                color: "bg-green-400",
              },
              {
                label: "😐 Bình thường",
                value: weekly.okayDays,
                color: "bg-yellow-400",
              },
              { label: "😔 Mệt", value: weekly.badDays, color: "bg-red-400" },
              {
                label: "❌ Bỏ lỡ",
                value: weekly.missedDays,
                color: "bg-gray-300",
              },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div
                  className={`${item.color} rounded-xl flex items-center justify-center text-white font-bold text-xl`}
                  style={{ height: "56px" }}
                >
                  {item.value}
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-tight">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {/* Triệu chứng thường gặp */}
          {weekly.mostCommonSymptoms.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Hay gặp nhất tuần qua:
              </p>
              <div className="flex flex-wrap gap-1">
                {weekly.mostCommonSymptoms.map((s) => (
                  <span
                    key={s}
                    className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gửi email */}
      <button
        onClick={onSendEmail}
        disabled={sending}
        className={`
          w-full py-4 rounded-2xl font-bold text-sm transition-all
          ${
            sentOk
              ? "bg-green-500 text-white"
              : sending
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-200"
          }
        `}
      >
        {sentOk
          ? "✅ Đã gửi!"
          : sending
            ? "Đang gửi..."
            : `📧 Gửi báo cáo cho ${callName}`}
      </button>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-600">{title}</h3>
      <p className="text-gray-400 text-sm mt-1">{desc}</p>
    </div>
  );
}

// ── LoadingSkeleton ───────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-100 rounded-2xl h-24" />
      ))}
    </div>
  );
}
