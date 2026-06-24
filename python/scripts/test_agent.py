"""
Script test nhanh Python Agent mà không cần chạy Express
Dùng: python scripts/test_agent.py
"""

import asyncio
# pyrefly: ignore [missing-import]
import httpx

BASE = "http://localhost:8001"

TEST_CASES = [
    {
        "name": "✅ Khỏe bình thường",
        "payload": {
            "message": "Hôm nay cảm thấy khỏe, đã uống thuốc rồi",
            "sessionId": "test-001",
            "context": {"feeling": "good", "session": "morning", "recentSymptoms": []},
        },
    },
    {
        "name": "⚠️ Mệt + đau lưng",
        "payload": {
            "message": "Hôm nay đau lưng và chóng mặt, hơi mệt",
            "sessionId": "test-002",
            "context": {"feeling": "bad", "session": "evening", "recentSymptoms": ["đau lưng"]},
        },
    },
    {
        "name": "🚨 Khẩn cấp",
        "payload": {
            "message": "Đau ngực dữ dội, khó thở",
            "sessionId": "test-003",
            "context": {"feeling": "bad", "session": "morning", "recentSymptoms": []},
        },
    },
]


async def run_tests():
    async with httpx.AsyncClient(timeout=30) as client:
        # Kiểm tra health trước
        try:
            r = await client.get(f"{BASE}/health")
            print(f"🏥 Health: {r.json()}\n")
        except Exception:
            print("❌ Server chưa chạy! Hãy chạy: python run.py")
            return

        # Chạy từng test case
        for tc in TEST_CASES:
            print(f"{'─'*50}")
            print(f"Test: {tc['name']}")
            try:
                r = await client.post(f"{BASE}/analyze", json=tc["payload"])
                data = r.json()
                print(f"  Reply    : {data.get('reply', '')[:80]}")
                print(f"  Severity : {data.get('severity')}")
                print(f"  Symptoms : {data.get('detectedSymptoms')}")
                print(f"  Notify   : {data.get('shouldNotifyChild')}")
                print(f"  Alerts   : {len(data.get('alerts', []))} alert(s)")
            except Exception as e:
                print(f"  ❌ Lỗi: {e}")
            print()


if __name__ == "__main__":
    asyncio.run(run_tests())