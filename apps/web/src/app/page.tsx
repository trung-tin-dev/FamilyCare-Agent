// src/app/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasCompletedSetup } from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Nếu chưa setup → chuyển sang /setup
    // Nếu đã setup → chuyển sang /parent
    if (hasCompletedSetup()) {
      router.replace("/parent");
    } else {
      router.replace("/setup");
    }
  }, [router]);

  // Hiện loading trong lúc redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <div className="text-6xl mb-4">🏥</div>
        <h1 className="text-2xl font-bold text-blue-700">FamilyCare Agent</h1>
        <p className="text-gray-500 mt-2">Đang tải...</p>
      </div>
    </div>
  );
}
