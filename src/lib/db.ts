import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

export const db =
  globalForPrisma.prisma ??
  (url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
