"use server";

import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { revalidatePath } from "next/cache";

export async function createBatch(name: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  const batch = await prisma.batch.create({
    data: {
      name,
      teacherId: session.user.id,
    },
  });

  revalidatePath("/teacher/batches");
  return batch;
}

export async function getTeacherBatches() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  return await prisma.batch.findMany({
    where: {
      teacherId: session.user.id,
    },
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
  });
}

export async function deleteBatch(id: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Ensure the teacher owns this batch
  const batch = await prisma.batch.findUnique({
    where: { id, teacherId: session.user.id },
  });

  if (!batch) {
    throw new Error("Batch not found or unauthorized");
  }

  await prisma.batch.delete({
    where: { id },
  });

  revalidatePath("/teacher/batches");
}

export async function getBatchDetails(id: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  return await prisma.batch.findUnique({
    where: { id, teacherId: session.user.id },
    include: {
      students: {
        select: {
          id: true,
          name: true,
          email: true,
          prn: true,
        },
      },
    },
  });
}

export async function addStudentToBatch(batchId: string, emailOrPrn: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Find the student
  const student = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrPrn },
        { prn: emailOrPrn }
      ],
      role: "STUDENT"
    }
  });

  if (!student) {
    throw new Error("Student not found");
  }

  await prisma.batch.update({
    where: { id: batchId, teacherId: session.user.id },
    data: {
      students: {
        connect: { id: student.id }
      }
    }
  });

  revalidatePath(`/teacher/batches/${batchId}`);
}

export async function removeStudentFromBatch(batchId: string, studentId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  await prisma.batch.update({
    where: { id: batchId, teacherId: session.user.id },
    data: {
      students: {
        disconnect: { id: studentId }
      }
    }
  });

  revalidatePath(`/teacher/batches/${batchId}`);
}
