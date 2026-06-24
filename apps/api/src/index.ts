// apps/api/src/index.ts
// ═══════════════════════════════════════════════
// Server chính của Express API
// Privacy-First: Dữ liệu lưu local, không cloud
// ═══════════════════════════════════════════════
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import checkinRouter from "./routes/checkin";
import alertsRouter from "./routes/alerts";
import reportsRouter from "./routes/reports";
import profileRouter from "./routes/profile";
import { checkPythonAgentHealth } from "./services/pythonAgent";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ───────────────────────────────────────────────
// Middleware
// ───────────────────────────────────────────────
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ───────────────────────────────────────────────
// Routes
// ───────────────────────────────────────────────
app.use("/api/checkin", checkinRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/profile", profileRouter);

// ───────────────────────────────────────────────
// GET /api/ping
// Kiểm tra server + python agent
// (Không cần check DB vì lưu local)
// ───────────────────────────────────────────────
app.get("/api/ping", async (_req, res) => {
  const pythonReady = await checkPythonAgentHealth();

  res.json({
    status: "ok",
    service: "FamilyCare API",
    storage: "local (privacy-first)",
    pythonAgent: pythonReady ? "ready" : "not ready",
    timestamp: new Date().toISOString(),
  });
});

// ───────────────────────────────────────────────
// Error handler
// ───────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("❌ Lỗi server:", err.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  },
);

// ───────────────────────────────────────────────
// Khởi động server
// ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 FamilyCare API chạy tại http://localhost:${PORT}`);
  console.log(`🔒 Chế độ: Privacy-First (lưu dữ liệu local)`);
  console.log(`📁 Dữ liệu lưu tại: ./data/\n`);
});
