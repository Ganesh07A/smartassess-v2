import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Configure pg type parser for TIMESTAMP WITHOUT TIME ZONE (OID 1114).
// PostgreSQL returns timestamp strings in UTC without timezone offset (e.g. '2026-11-03 18:25:00').
// By default, node-pg parses strings without 'Z' using the local machine timezone (e.g. IST +05:30),
// which unintentionally shifts dates. Appending 'Z' ensures node-pg parses them as UTC correctly.
pg.types.setTypeParser(1114, (stringValue: string) => {
  return new Date(stringValue.endsWith("Z") ? stringValue : `${stringValue.replace(" ", "T")}Z`);
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = process.env.DATABASE_URL;
const isProductionRuntime = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    if (!connectionString) {
      // Fail loudly at startup instead of silently booting against a dummy database and then
      // throwing confusing errors on the first query.
      if (isProductionRuntime) {
        throw new Error(
          "DATABASE_URL is not configured. Set it in the deployment environment before starting the app.",
        );
      }
      console.warn("DATABASE_URL is missing. Using a dummy Prisma client for build/development.");
      const dummyClient = new PrismaClient({
        datasources: { db: { url: "postgresql://postgres:postgres@localhost:5432/postgres" } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return dummyClient;
    }
    if (connectionString.startsWith("prisma+postgres://")) {
      // For Prisma Postgres, we don't use the pg adapter directly
      return new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    } else {
      const pool = new pg.Pool({
        connectionString,
        max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX, 10) : 10, // Default 10 pool connections (backed by Supabase Transaction Pooler)
        idleTimeoutMillis: 15000, // Close idle connections faster (15s) to free resources
        connectionTimeoutMillis: 15000, // 15s connection timeout to allow Neon database to wake up if suspended
      });

      // Handle errors on idle pool connections to prevent app crashes
      pool.on("error", (err) => {
        console.error("Unexpected error on idle pg pool client:", err);
      });

      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });
    }
  })();

// Cache the Prisma client instance globally in all environments (including production serverless)
// to prevent pool recreation on serverless container reuse.
globalForPrisma.prisma = prisma;
