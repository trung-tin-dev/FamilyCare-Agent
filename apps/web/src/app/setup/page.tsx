// src/app/setup/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile, createDefaultProfile } from "@/lib/storage";
import type { CallName } from "@familycare/shared";
import { saveProfileToServer } from "@/lib/api";

const CALL_NAME_OPTIONS: { value: CallName; label: string; emoji: string }[] = [
  { value: "Ba", label: "Ba", emoji: "👨‍🦳" },
  { value: "Mẹ", label: "Mẹ", emoji: "👩‍🦳" },
  { value: "Ông", label: "Ông", emoji: "👴" },
  { value: "Bà", label: "Bà", emoji: "👵" },
];

export default function SetupPage() {
  const router = useRouter();

  // State cho form
  const [parentName, setParentName] = useState("");
  const [callName, setCallName] = useState<CallName>("Ba");
  const [childName, setChildName] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [step, setStep] = useState(1); // 3 bước
  const [error, setError] = useState("");

  // ───────────────────────────────────────
  // Bước 1: Thông tin người được chăm sóc
  // ───────────────────────────────────────
  function renderStep1() {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
          <h2 className="text-2xl font-bold text-gray-800">
            Người thân của bạn
          </h2>
          <p className="text-gray-500 mt-2">Bạn muốn chăm sóc ai?</p>
        </div>

        {/* Chọn cách xưng hô */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-3">
            Bạn gọi họ là gì?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {CALL_NAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setCallName(option.value)}
                className={`
                  flex items-center justify-center gap-3
                  p-4 rounded-2xl border-2 text-xl font-medium
                  transition-all duration-200
                  ${
                    callName === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }
                `}
              >
                <span className="text-3xl">{option.emoji}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tên */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Tên {callName} là gì?
          </label>
          <input
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder={`Ví dụ: ${callName} Năm, ${callName} Lan...`}
            className="
              w-full p-4 text-xl rounded-2xl border-2 border-gray-200
              focus:outline-none focus:border-blue-400
            "
          />
        </div>

        <button
          onClick={() => {
            if (!parentName.trim()) {
              setError(`Vui lòng nhập tên ${callName}`);
              return;
            }
            setError("");
            setStep(2);
          }}
          className="
            w-full p-4 bg-blue-500 text-white text-xl font-bold
            rounded-2xl hover:bg-blue-600 transition-colors
          "
        >
          Tiếp theo →
        </button>

        {error && <p className="text-red-500 text-center">{error}</p>}
      </div>
    );
  }

  // ───────────────────────────────────────
  // Bước 2: Thông tin người chăm sóc (con)
  // ───────────────────────────────────────
  function renderStep2() {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-4">👤</div>
          <h2 className="text-2xl font-bold text-gray-800">
            Thông tin của bạn
          </h2>
          <p className="text-gray-500 mt-2">
            Để nhận thông báo sức khỏe {callName}
          </p>
        </div>

        {/* Tên con */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Tên bạn là gì?
          </label>
          <input
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="Ví dụ: Nam, Lan..."
            className="
              w-full p-4 text-xl rounded-2xl border-2 border-gray-200
              focus:outline-none focus:border-blue-400
            "
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Email nhận thông báo
          </label>
          <input
            type="email"
            value={childEmail}
            onChange={(e) => setChildEmail(e.target.value)}
            placeholder="Ví dụ: ten@gmail.com"
            className="
              w-full p-4 text-xl rounded-2xl border-2 border-gray-200
              focus:outline-none focus:border-blue-400
            "
          />
          <p className="text-sm text-gray-400 mt-2">
            🔒 Email chỉ dùng để gửi thông báo sức khỏe, không chia sẻ
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep(1)}
            className="
              flex-1 p-4 bg-gray-100 text-gray-600 text-xl font-bold
              rounded-2xl hover:bg-gray-200 transition-colors
            "
          >
            ← Quay lại
          </button>
          <button
            onClick={() => {
              if (!childName.trim()) {
                setError("Vui lòng nhập tên bạn");
                return;
              }
              if (!childEmail.trim() || !childEmail.includes("@")) {
                setError("Vui lòng nhập email hợp lệ");
                return;
              }
              setError("");
              setStep(3);
            }}
            className="
              flex-1 p-4 bg-blue-500 text-white text-xl font-bold
              rounded-2xl hover:bg-blue-600 transition-colors
            "
          >
            Tiếp theo →
          </button>
        </div>

        {error && <p className="text-red-500 text-center">{error}</p>}
      </div>
    );
  }

  // ───────────────────────────────────────
  // Bước 3: Xác nhận
  // ───────────────────────────────────────
  function renderStep3() {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800">
            Xác nhận thông tin
          </h2>
        </div>

        {/* Thông tin tóm tắt */}
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Người được chăm sóc:</span>
            <span className="text-xl font-bold text-gray-800">
              {parentName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Xưng hô:</span>
            <span className="text-xl font-bold text-gray-800">{callName}</span>
          </div>
          <hr className="border-gray-200" />
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Người chăm sóc:</span>
            <span className="text-xl font-bold text-gray-800">{childName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Email thông báo:</span>
            <span className="text-lg font-bold text-gray-800">
              {childEmail}
            </span>
          </div>
        </div>

        {/* Mô tả cách hoạt động */}
        <div className="bg-blue-50 rounded-2xl p-6 space-y-3">
          <p className="font-bold text-blue-700">App sẽ hoạt động như sau:</p>
          <p className="text-blue-600">
            📱 {callName} sẽ check-in sức khỏe hàng ngày
          </p>
          <p className="text-blue-600">
            🔔 {childName} sẽ nhận thông báo qua email
          </p>
          <p className="text-blue-600">
            🆘 Khi có vấn đề, {childName} được cảnh báo ngay
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep(2)}
            className="
              flex-1 p-4 bg-gray-100 text-gray-600 text-xl font-bold
              rounded-2xl hover:bg-gray-200 transition-colors
            "
          >
            ← Sửa lại
          </button>
          <button
            onClick={handleComplete} // đã là async, gọi trực tiếp được
            className="
    flex-1 p-4 bg-green-500 text-white text-xl font-bold
    rounded-2xl hover:bg-green-600 transition-colors
  "
          >
            🎉 Bắt đầu!
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────
  // Hoàn thành setup
  // ───────────────────────────────────────
async function handleComplete() {
  const profile = createDefaultProfile();
  profile.parentName = parentName.trim();
  profile.callName = callName;
  profile.childName = childName.trim();
  profile.childEmail = childEmail.trim();
  profile.isSetupComplete = true;

  // Lưu vào localStorage (cho parent page dùng offline)
  saveProfile(profile);

  // Lưu lên Express server (cho child dashboard dùng)
  try {
    await saveProfileToServer(profile);
    console.log("✅ Đã lưu profile lên server");
  } catch (err) {
    // Không chặn flow nếu server lỗi
    console.warn("⚠️ Không lưu được profile lên server:", err);
  }

  router.push("/parent");
}

  // ───────────────────────────────────────
  // Render
  // ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600">🏥 FamilyCare</h1>
          <p className="text-gray-400 text-sm mt-1">Trợ lý sức khỏe gia đình</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`
                flex-1 h-2 rounded-full transition-colors
                ${s <= step ? "bg-blue-500" : "bg-gray-200"}
              `}
            />
          ))}
        </div>

        {/* Steps */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Privacy note */}
        <p className="text-center text-xs text-gray-400 mt-8">
          🔒 Thông tin được lưu trên thiết bị, không upload lên cloud
        </p>
      </div>
    </div>
  );
}
