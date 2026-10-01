"use server";

import { prisma } from "@/app/db";
import { revalidatePath } from "next/cache";
import {
  assertBatchAccess,
  NotFoundOrUnauthorizedError,
  requireTeacher,
  teacherBatchScope,
} from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { addStudentSchema, batchStudentSchema, createBatchSchema, idSchema } from "@/lib/validation/schemas";

const MAX_PAGE_SIZE = 200;

export async function createBatch(name: string) {
  const teacher = await requireTeacher();
  const input = parseInput(createBatchSchema, { name });

  const batch = await prisma.batch.create({
    data: {
      name: input.name,
      teacherId: teacher.id,
      department: teacher.department,
    },
  });

  // Attempt to parse name to auto-enroll students (e.g., "TY AIML A")
  const parts = input.name.split(/\s+/);
  if (parts.length >= 3) {
    const yearCode = parts[0].toUpperCase();
    const deptCode = parts[1].toUpperCase();
    const divCode = parts[parts.length - 1].toUpperCase();

    const yearMapInverse: Record<string, string> = {
      FY: "First Year",
      SY: "Second Year",
      TY: "Third Year",
      BE: "Fourth Year",
    };

    const resolvedYear = yearMapInverse[yearCode];
    if (resolvedYear) {
      const matchingStudents = await prisma.user.findMany({
        where: {
          role: "STUDENT",
          year: resolvedYear,
          department: deptCode,
          division: divCode,
        },
        select: { id: true },
        take: 1000,
      });

      if (matchingStudents.length > 0) {
        await prisma.batch.update({
          where: { id: batch.id },
          data: {
            students: {
              connect: matchingStudents.map((student) => ({ id: student.id })),
            },
          },
        });
      }
    }
  }

  revalidatePath("/teacher/batches");
  return batch;
}

export async function getTeacherBatches() {
  const teacher = await requireTeacher();

  return await prisma.batch.findMany({
    where: teacherBatchScope(teacher),
    include: {
      _count: {
        select: {
          students: true,
          exams: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_PAGE_SIZE,
  });
}

export async function deleteBatch(id: string) {
  const teacher = await requireTeacher();
  const batchId = parseInput(idSchema, id);
  await assertBatchAccess(batchId, teacher, { id: true });

  await prisma.batch.delete({
    where: { id: batchId },
  });

  revalidatePath("/teacher/batches");
}

export async function getBatchDetails(id: string) {
  const teacher = await requireTeacher();
  const batchId = parseInput(idSchema, id);
  await assertBatchAccess(batchId, teacher, { id: true });

  return await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      students: {
        select: {
          id: true,
          name: true,
          email: true,
          prn: true,
        },
        orderBy: { name: "asc" },
        take: 1000,
      },
    },
  });
}

export async function addStudentToBatch(batchId: string, emailOrPrn: string) {
  const teacher = await requireTeacher();
  const input = parseInput(addStudentSchema, { batchId, emailOrPrn });
  await assertBatchAccess(input.batchId, teacher, { id: true });

  const student = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.emailOrPrn }, { prn: input.emailOrPrn }],
      role: "STUDENT",
    },
    select: { id: true },
  });

  if (!student) {
    throw new NotFoundOrUnauthorizedError("Student not found.");
  }

  await prisma.batch.update({
    where: { id: input.batchId },
    data: {
      students: {
        connect: { id: student.id },
      },
    },
  });

  revalidatePath(`/teacher/batches/${batchId}`);
}

export async function removeStudentFromBatch(batchId: string, studentId: string) {
  const teacher = await requireTeacher();
  const input = parseInput(batchStudentSchema, { batchId, studentId });
  await assertBatchAccess(input.batchId, teacher, { id: true });

  await prisma.batch.update({
    where: { id: input.batchId },
    data: {
      students: {
        disconnect: { id: input.studentId },
      },
    },
  });

  revalidatePath(`/teacher/batches/${batchId}`);
}
