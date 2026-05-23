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

  // Fetch teacher's department
  const teacher = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { department: true }
  });

  const teacherDept = teacher?.department || null;

  // Create the batch
  const batch = await prisma.batch.create({
    data: {
      name: name.trim(),
      teacherId: session.user.id,
      department: teacherDept,
    },
  });

  // Attempt to parse name to auto-enroll students (e.g., "TY AIML A")
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 3) {
    const yearCode = parts[0].toUpperCase();
    const deptCode = parts[1].toUpperCase();
    const divCode = parts[parts.length - 1].toUpperCase();

    const yearMapInverse: Record<string, string> = {
      "FY": "First Year",
      "SY": "Second Year",
      "TY": "Third Year",
      "BE": "Fourth Year"
    };

    const resolvedYear = yearMapInverse[yearCode];
    if (resolvedYear) {
      // Find all students in this year, department, division
      const matchingStudents = await prisma.user.findMany({
        where: {
          role: "STUDENT",
          year: resolvedYear,
          department: deptCode,
          division: divCode
        },
        select: { id: true }
      });

      if (matchingStudents.length > 0) {
        await prisma.batch.update({
          where: { id: batch.id },
          data: {
            students: {
              connect: matchingStudents.map(s => ({ id: s.id }))
            }
          }
        });
      }
    }
  }

  revalidatePath("/teacher/batches");
  return batch;
}

export async function getTeacherBatches() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Fetch teacher's department
  const teacher = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { department: true }
  });

  const teacherDept = teacher?.department;

  return await prisma.batch.findMany({
    where: {
      OR: [
        { teacherId: session.user.id },
        ...(teacherDept ? [{ 
          department: teacherDept,
          teacherId: null
        }] : [])
      ]
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
