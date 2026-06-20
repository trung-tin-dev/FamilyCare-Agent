// apps/api/src/index.ts
// ═══════════════════════════════════════════════
// Server chính của Express API
// Khởi động và kết nối tất cả routes
// ═══════════════════════════════════════════════
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import checkinRouter from "./routes/checkin";
import alertsRouter from "./routes/alerts";
import reportsRouter from "./routes/reports";
import { checkPythonAgentHealth } from "./services/pythonAgent";
import { prisma } from "./lib/db";

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

// Routes
app.use("/api/checkin", checkinRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/reports", reportsRouter);

// GET /api/ping
// Kiểm tra server + database + python agent
app.get("/api/ping", async (_req, res) => {
  // Kiểm tra Python Agent
  const pythonReady = await checkPythonAgentHealth();

  // Kiểm tra Database
  let dbReady = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }

  res.json({
    status: "ok",
    service: "FamilyCare API",
    database: dbReady ? "connected" : "error",
    pythonAgent: pythonReady ? "ready" : "not ready",
    timestamp: new Date().toISOString(),
  });
});

// Error handler
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

// Khởi động server
app.listen(PORT, async () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);

  // Kiểm tra Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Neon Database đã kết nối");
  } catch (err: any) {
    console.error("Lỗi kết nối Database:", err.message);
  }

});
