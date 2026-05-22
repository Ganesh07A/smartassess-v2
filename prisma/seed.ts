import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

async function main() {
  let prisma: PrismaClient;
  let pool: pg.Pool | undefined;

  if (connectionString?.startsWith("prisma+postgres://")) {
    prisma = new PrismaClient();
  } else {
    pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  }

  const teacherPassword = await bcrypt.hash("teacher123", 10);
  const studentPassword = await bcrypt.hash("student123", 10);

  try {
    // Create Teacher
    const teacher = await prisma.user.upsert({
      where: { email: "teacher@test.com" },
      update: {},
      create: {
        email: "teacher@test.com",
        name: "Test Teacher",
        password: teacherPassword,
        role: Role.TEACHER,
      },
    });

    // Create Student
    const student = await prisma.user.upsert({
      where: { email: "student@test.com" },
      update: {},
      create: {
        email: "student@test.com",
        name: "Test Student",
        password: studentPassword,
        role: Role.STUDENT,
        prn: "PRN123456",
      },
    });

    console.log("Seeding successful:");
    console.log({ teacher, student });
  } finally {
    await prisma.$disconnect();
    if (pool) await pool.end();
  }
}

main().catch((e) => {
  console.error("Seeding failed:");
  console.error(e);
  process.exit(1);
});
