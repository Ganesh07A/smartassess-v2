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
      const pool = new pg.Pool({ connectionString });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: ["query"],
      });
    }
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
