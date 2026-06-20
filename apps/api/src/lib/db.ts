// apps/api/src/lib/db.ts
// ═══════════════════════════════════════════════
// Kết nối Prisma + Neon PostgreSQL
// Dùng Neon adapter cho Prisma 7.x
// ═══════════════════════════════════════════════
import { PrismaClient } from "../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Cần thiết cho môi trường Node.js

neonConfig.webSocketConstructor = ws;

// Tạo adapter kết nối Neon
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter } as any);
}

// Singleton pattern
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
