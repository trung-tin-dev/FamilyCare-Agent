// src/app/parent/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "@/lib/storage";
import { sendCheckIn, toBackendProfile } from "@/lib/api";
import type { UserProfile, Feeling, CheckInSession } from "@familycare/shared";

// ───────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────
type PageState = "idle" | "loading" | "replied" | "emergency";

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────
function getSession(): CheckInSession {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : "evening";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

// ───────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────
export default function ParentPage() {
  const router = useRouter();
  const [profile] = useState<UserProfile | null>(() => getProfile());
  const [pageState, setPageState] = useState<PageState>("idle");
  const [agentReply, setAgentReply] = useState("");
  const [transcript, setTranscript] = useState("");
  const [hasAlerts, setHasAlerts] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);

useEffect(() => {
  if (!profile?.isSetupComplete) {
    router.replace("/setup");
  }
}, [profile, router]);

  // ───────────────────────────────────────────────
  // Gửi check-in
  // ───────────────────────────────────────────────
  async function handleCheckIn(
    feeling: Feeling,
    inputType: "button" = "button",
  ) {
    if (!profile) return;
    setPageState("loading");

    try {
      const result = await sendCheckIn({
        feeling,
        inputType,
        session: getSession(),
        profile: toBackendProfile(profile),
      });

      setAgentReply(result.agentReply);
      setCheckedInToday(true);

      if (result.alerts.some((a) => a.severity === "emergency")) {
        setPageState("emergency");
      } else {
        if (result.alerts.length > 0) setHasAlerts(true);
        setPageState("replied");
      }

      speakText(result.agentReply);
    } catch {
      setAgentReply("Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.");
      setPageState("replied");
    }
  }

  // ───────────────────────────────────────────────
  // Text to Speech
  // ───────────────────────────────────────────────
  function speakText(text: string) {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  // ───────────────────────────────────────────────
  // Reset
  // ───────────────────────────────────────────────
  function handleReset() {
    window.speechSynthesis?.cancel();
    setPageState("idle");
    setAgentReply("");
    setTranscript("");
  }

  // ───────────────────────────────────────────────
  // Render: Loading
  // ───────────────────────────────────────────────
  if (!profile?.isSetupComplete) {
    return null;
  }
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-8xl animate-bounce"></div>
        <p className="text-3xl font-bold text-blue-700 text-center">
          Con đang xem...
        </p>
        <p className="text-xl text-gray-500 text-center">
          Vui lòng chờ một chút
        </p>
      </div>
    );
  }


  // ───────────────────────────────────────────────
  // Render: Agent trả lời
  // ───────────────────────────────────────────────
  if (pageState === "replied") {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center gap-8 p-6">
        <div className="text-8xl">💙</div>

        {transcript && (
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-gray-500 text-sm mb-1">Ba nói:</p>
            <p className="text-xl text-gray-700">&ldquo;{transcript}&rdquo;</p>
          </div>
        )}

        <div className="w-full max-w-sm bg-white rounded-2xl p-6 border border-green-200">
          <p className="text-gray-500 text-sm mb-2">Con nhắn:</p>
          <p className="text-2xl text-gray-800 leading-relaxed font-medium">
            {agentReply}
          </p>
        </div>

        {hasAlerts && (
          <div className="w-full max-w-sm bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
            <p className="text-yellow-700 text-lg font-medium text-center">
              ⚠️ Con đã được thông báo
            </p>
          </div>
        )}

        <button
          onClick={handleReset}
          className="
            w-full max-w-sm py-6 bg-blue-500 text-white
            text-2xl font-bold rounded-3xl
            active:scale-95 transition-transform
          "
        >
          ← Quay về
        </button>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // Render: Khẩn cấp
  // ───────────────────────────────────────────────
  if (pageState === "emergency") {
    return (
      <div className="min-h-screen bg-red-100 flex flex-col items-center justify-center gap-8 p-6">
        <div className="text-8xl animate-bounce">🚨</div>
        <h2 className="text-4xl font-bold text-red-700 text-center">
          Con đã được báo!
        </h2>
        <p className="text-2xl text-red-600 text-center leading-relaxed">
          {agentReply}
        </p>
        <div className="w-full max-w-sm bg-white rounded-2xl p-6 border border-red-200">
          <p className="text-red-600 text-2xl font-bold text-center">
            📞 Cấp cứu: 115
          </p>
        </div>
        <button
          onClick={handleReset}
          className="
            w-full max-w-sm py-6 bg-red-500 text-white
            text-2xl font-bold rounded-3xl
            active:scale-95 transition-transform
          "
        >
          ← Quay về
        </button>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // Render: Màn hình chính
  // ───────────────────────────────────────────────
  if (!profile) return null;

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 to-white flex flex-col p-5 gap-4">
      {/* Header */}
      <div className="pt-4 pb-2 text-center">
        <p className="text-2xl text-gray-500">{getGreeting()}!</p>
        <p className="text-xl text-gray-500 mt-2">
          Hôm nay {profile.callName} thấy thế nào?
        </p>
      </div>

      {/* Đã check-in */}
      {checkedInToday && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-600 text-lg font-medium">
            ✅ {profile.callName} đã check-in rồi!
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {profile.callName} có thể check-in lại nếu muốn
          </p>
        </div>
      )}

      {/* 3 nút cảm xúc */}
      <div className="flex flex-col gap-4 flex-1">
        <button
          onClick={() => handleCheckIn("good")}
          className="
            w-full py-8 bg-green-400 text-white
            rounded-3xl shadow-lg
            active:scale-95 transition-transform
            flex items-center justify-center gap-5
          "
        >
          <span className="text-4xl font-bold">KHỎE</span>
        </button>

        <button
          onClick={() => handleCheckIn("okay")}
          className="
            w-full py-8 bg-yellow-400 text-white
            rounded-3xl shadow-lg
            active:scale-95 transition-transform
            flex items-center justify-center gap-5
          "
        >
          <span className="text-4xl font-bold">BÌNH THƯỜNG</span>
        </button>

        <button
          onClick={() => handleCheckIn("bad")}
          className="
            w-full py-8 bg-red-400 text-white
            rounded-3xl shadow-lg
            active:scale-95 transition-transform
            flex items-center justify-center gap-5
          "
        >
          <span className="text-4xl font-bold">KHÔNG KHỎE</span>
        </button>
      </div>

      <button
        onClick={() => router.push("/setup")}
        className="w-full py-4 bg-green-400 text-white rounded-3xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-5"
      >
        <span className="text-4xl font-bold">Setup</span>
      </button>

      {/* Link sang dashboard */}
      <button
        onClick={() => router.push("/child")}
        className="text-center text-gray-400 text-sm pb-2"
      >
        Xem dashboard →
      </button>
    </div>
  );
}
