"""
Entry point — khởi động FamilyCare Python Agent
Chạy: python run.py
"""
# pyrefly: ignore [missing-import]
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "agents.health_agent:app",
        host="0.0.0.0",
        port=8001,      # Express chạy 3001, tránh xung đột
        reload=True,    # Auto reload khi sửa code
        log_level="info",
    )