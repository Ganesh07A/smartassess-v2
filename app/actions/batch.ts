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

/**
 * Fetches paginated, filtered, and sorted batches for the teacher.
 */
export async function getTeacherBatchesPaged(
  input: Partial<import("@/lib/filters/schemas").BatchFilter> = {},
): Promise<import("@/lib/filters/pagination").PagedResult<import("@/lib/filters/builders/batches").BatchListRow>> {
  const teacher = await requireTeacher();
  const { batchFilterSchema } = await import("@/lib/filters/schemas");
  const {
    buildBatchWhere,
    buildBatchOrderBy,
    BATCH_LIST_SELECT,
  } = await import("@/lib/filters/builders/batches");
  const { pageCount, paginationArgs } = await import("@/lib/filters/pagination");

  const filter = batchFilterSchema.parse(input);
  const scope = teacherBatchScope(teacher);
  const where = buildBatchWhere(filter, scope);
  const orderBy = buildBatchOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  const whereWithoutDept = buildBatchWhere({ ...filter, department: undefined }, scope);
  const whereWithoutYear = buildBatchWhere({ ...filter, year: undefined }, scope);

  const [
    rows,
    total,
    deptGroups,
    fyCount,
    syCount,
    tyCount,
    beCount,
  ] = await Promise.all([
    prisma.batch.findMany({
      where,
      orderBy,
      skip,
      take,
      select: BATCH_LIST_SELECT,
    }),
    prisma.batch.count({ where }),
    prisma.batch.groupBy({
      by: ["department"],
      where: whereWithoutDept,
      _count: { _all: true },
    }),
    prisma.batch.count({
      where: {
        AND: [
          whereWithoutYear,
          {
            OR: [
              { name: { startsWith: "FY ", mode: "insensitive" } },
              { name: { startsWith: "FY-", mode: "insensitive" } },
              { name: { startsWith: "FY", mode: "insensitive" } },
            ],
          },
        ],
      },
    }),
    prisma.batch.count({
      where: {
        AND: [
          whereWithoutYear,
          {
            OR: [
              { name: { startsWith: "SY ", mode: "insensitive" } },
              { name: { startsWith: "SY-", mode: "insensitive" } },
              { name: { startsWith: "SY", mode: "insensitive" } },
            ],
          },
        ],
      },
    }),
    prisma.batch.count({
      where: {
        AND: [
          whereWithoutYear,
          {
            OR: [
              { name: { startsWith: "TY ", mode: "insensitive" } },
              { name: { startsWith: "TY-", mode: "insensitive" } },
              { name: { startsWith: "TY", mode: "insensitive" } },
            ],
          },
        ],
      },
    }),
    prisma.batch.count({
      where: {
        AND: [
          whereWithoutYear,
          {
            OR: [
              { name: { startsWith: "BE ", mode: "insensitive" } },
              { name: { startsWith: "BE-", mode: "insensitive" } },
              { name: { startsWith: "BE", mode: "insensitive" } },
            ],
          },
        ],
      },
    }),
  ]);

  const departmentFacets = deptGroups
    .filter((g) => g.department !== null)
    .map((g) => ({
      value: g.department as string,
      label: g.department as string,
      count: g._count._all,
    }));

  const yearFacets = [
    { value: "FY", label: "First Year (FY)", count: fyCount },
    { value: "SY", label: "Second Year (SY)", count: syCount },
    { value: "TY", label: "Third Year (TY)", count: tyCount },
    { value: "BE", label: "Fourth Year (BE)", count: beCount },
  ];

  return {
    rows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      department: departmentFacets,
      year: yearFacets,
    },
  };
}

/**
 * Fetches paginated roster of enrolled students in a batch with filters and facets.
 */
export async function getBatchRosterPaged(
  batchId: string,
  input: Partial<import("@/lib/filters/schemas").RosterFilter> = {},
): Promise<import("@/lib/filters/pagination").PagedResult<import("@/lib/filters/builders/roster").RosterRow>> {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, batchId);
  await assertBatchAccess(id, teacher, { id: true });

  const { rosterFilterSchema } = await import("@/lib/filters/schemas");
  const {
    buildRosterWhere,
    buildRosterOrderBy,
    ROSTER_ROW_SELECT,
  } = await import("@/lib/filters/builders/roster");
  const { pageCount, paginationArgs } = await import("@/lib/filters/pagination");

  const filter = rosterFilterSchema.parse(input);
  const where = buildRosterWhere(id, filter);
  const orderBy = buildRosterOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  const whereWithoutYear = buildRosterWhere(id, { ...filter, year: undefined });
  const whereWithoutDiv = buildRosterWhere(id, { ...filter, division: undefined });

  const [rows, total, yearGroups, divGroups] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take,
      select: ROSTER_ROW_SELECT,
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ["year"],
      where: whereWithoutYear,
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["division"],
      where: whereWithoutDiv,
      _count: { _all: true },
    }),
  ]);

  const yearFacets = yearGroups
    .filter((g) => g.year !== null)
    .map((g) => ({
      value: g.year as string,
      label: g.year as string,
      count: g._count._all,
    }));

  const divisionFacets = divGroups
    .filter((g) => g.division !== null)
    .map((g) => ({
      value: g.division as string,
      label: `Division ${g.division}`,
      count: g._count._all,
    }));

  return {
    rows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      year: yearFacets,
      division: divisionFacets,
    },
  };
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

/**
 * Bulk add students to a batch from a list of identifiers (emails or PRNs).
 * Authorization is checked once. Capped at 500 entries per call.
 */
export async function addStudentsToBatch(
  batchId: string,
  rawIdentifiers: string[],
) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, batchId);
  await assertBatchAccess(id, teacher, { id: true });

  const { enforceRateLimit } = await import("@/lib/rate-limit");
  await enforceRateLimit(`batch:bulkAdd:${teacher.id}`, 20, 60 * 1000);

  const cleanIdentifiers = Array.from(
    new Set(rawIdentifiers.map((s) => s.trim()).filter(Boolean)),
  ).slice(0, 500);

  if (cleanIdentifiers.length === 0) {
    return { added: 0, notFound: [], alreadyInBatch: [] };
  }

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      OR: [
        { email: { in: cleanIdentifiers } },
        { prn: { in: cleanIdentifiers } },
      ],
    },
    select: {
      id: true,
      email: true,
      prn: true,
      enrolledBatches: {
        where: { id },
        select: { id: true },
      },
    },
  });

  const studentEmailMap = new Map(students.map((s) => [s.email?.toLowerCase(), s]));
  const studentPrnMap = new Map(students.map((s) => [s.prn?.toLowerCase(), s]));

  const notFound: string[] = [];
  const alreadyInBatch: string[] = [];
  const toConnectIds: string[] = [];

  for (const ident of cleanIdentifiers) {
    const lower = ident.toLowerCase();
    const student = studentEmailMap.get(lower) ?? studentPrnMap.get(lower);

    if (!student) {
      notFound.push(ident);
    } else if (student.enrolledBatches.length > 0) {
      alreadyInBatch.push(ident);
    } else {
      toConnectIds.push(student.id);
    }
  }

  const uniqueConnectIds = Array.from(new Set(toConnectIds));
  if (uniqueConnectIds.length > 0) {
    await prisma.batch.update({
      where: { id },
      data: {
        students: {
          connect: uniqueConnectIds.map((sid) => ({ id: sid })),
        },
      },
    });
  }

  revalidatePath(`/teacher/batches/${batchId}`);
  return {
    added: uniqueConnectIds.length,
    notFound,
    alreadyInBatch,
  };
}

export interface CsvStudentInput {
  name: string;
  email: string;
  prn?: string;
  department?: string;
  year?: string;
  division?: string;
}

/**
 * Bulk create and enroll students from CSV data.
 * Validates each row, reports per-row errors, and never silently skips a row.
 * Capped at 500 rows.
 */
export async function importStudentsFromCsv(
  batchId: string,
  rows: CsvStudentInput[],
) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, batchId);
  await assertBatchAccess(id, teacher, { id: true });

  const { enforceRateLimit } = await import("@/lib/rate-limit");
  await enforceRateLimit(`batch:csvImport:${teacher.id}`, 10, 60 * 1000);

  const cappedRows = rows.slice(0, 500);
  const errors: { row: number; identifier: string; error: string }[] = [];
  let createdCount = 0;
  let enrolledCount = 0;

  for (let i = 0; i < cappedRows.length; i++) {
    const row = cappedRows[i];
    const rowNum = i + 1;
    const identifier = row.email || row.prn || row.name || `Row ${rowNum}`;

    if (!row.name || !row.name.trim()) {
      errors.push({ row: rowNum, identifier, error: "Name is required." });
      continue;
    }

    if (!row.email || !row.email.includes("@")) {
      errors.push({ row: rowNum, identifier, error: "Valid email is required." });
      continue;
    }

    try {
      const email = row.email.trim().toLowerCase();
      const prn = row.prn?.trim() || null;

      // Check if user already exists by email or PRN
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email }, ...(prn ? [{ prn }] : [])],
        },
        select: {
          id: true,
          enrolledBatches: { where: { id }, select: { id: true } },
        },
      });

      let studentId = existing?.id;

      if (!existing) {
        const newUser = await prisma.user.create({
          data: {
            name: row.name.trim(),
            email,
            prn,
            department: row.department?.trim() || teacher.department || null,
            year: row.year?.trim() || null,
            division: row.division?.trim() || null,
            role: "STUDENT",
            password: null, // Nullable invite-pending
          },
        });
        studentId = newUser.id;
        createdCount++;
      }

      if (studentId) {
        if (!existing || existing.enrolledBatches.length === 0) {
          await prisma.batch.update({
            where: { id },
            data: {
              students: { connect: { id: studentId } },
            },
          });
          enrolledCount++;
        }
      }
    } catch (err: unknown) {
      errors.push({
        row: rowNum,
        identifier,
        error: (err as Error)?.message || "Failed to process student row",
      });
    }
  }

  revalidatePath(`/teacher/batches/${batchId}`);
  return {
    created: createdCount,
    enrolled: enrolledCount,
    errors,
  };
}

/**
 * Bulk removes students from a batch in one operation.
 */
export async function bulkRemoveStudentsFromBatch(
  batchId: string,
  studentIds: string[],
) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, batchId);
  await assertBatchAccess(id, teacher, { id: true });

  if (studentIds.length === 0) return { count: 0 };

  await prisma.batch.update({
    where: { id },
    data: {
      students: {
        disconnect: studentIds.map((sid) => ({ id: sid })),
      },
    },
  });

  revalidatePath(`/teacher/batches/${batchId}`);
  return { count: studentIds.length };
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
