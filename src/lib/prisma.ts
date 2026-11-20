import { PrismaClient } from "@prisma/client";

// One PrismaClient per process (hot-reload safe in dev).
const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
