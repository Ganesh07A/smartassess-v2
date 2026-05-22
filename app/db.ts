import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    const dummyUrl = "postgresql://postgres:postgres@localhost:5432/postgres";
    if (!connectionString) {
      console.warn("DATABASE_URL is missing. Using a dummy Prisma client for build.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new PrismaClient({ datasources: { db: { url: dummyUrl } } } as any);
    }
    if (connectionString?.startsWith("prisma+postgres://")) {
      // For Prisma Postgres, we don't use the pg adapter directly
      return new PrismaClient({
        log: ["query"],
      });
    } else {
      const pool = new pg.Pool({ 
        connectionString,
        max: process.env.NODE_ENV === "production" ? 10 : 10, // Increased from 1 to 10 for better concurrency
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased from 2000 to 10000 to prevent cold-start timeouts
      });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });
    }
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
