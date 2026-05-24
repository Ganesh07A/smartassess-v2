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
        max: process.env.NODE_ENV === "production" ? 2 : 10, // Max 2 connections in production serverless to prevent Neon connection limit exhaustion
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
