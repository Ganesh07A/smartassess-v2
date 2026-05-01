import { PrismaClient } from "./generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    if (connectionString?.startsWith("prisma+postgres://")) {
      // For Prisma Postgres, we don't use the pg adapter directly
      return new PrismaClient({
        log: ["query"],
      });
    } else {
      const pool = new pg.Pool({ 
        connectionString,
        max: process.env.NODE_ENV === "production" ? 1 : 10, // Limit connections in production
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });
    }
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
