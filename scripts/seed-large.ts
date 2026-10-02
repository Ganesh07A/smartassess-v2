import { PrismaClient, Difficulty, QuestionType, SessionStatus, ExamStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Refusing to run seed:large in production environment!");
    process.exit(1);
  }

  console.log("🌱 Starting large-scale test dataset seed...");
  console.time("seed-large-duration");

  const DEPARTMENT = "Computer Science - Benchmarks";
  const TEACHER_EMAIL = "benchmarks.teacher@smartassess.test";

  // 1. Create or get benchmark Teacher
  console.log("1/7 Creating benchmark Teacher & Department...");
  const teacher = await prisma.user.upsert({
    where: { email: TEACHER_EMAIL },
    update: { department: DEPARTMENT, role: "TEACHER" },
    create: {
      name: "Dr. Alan Turing",
      email: TEACHER_EMAIL,
      role: "TEACHER",
      department: DEPARTMENT,
    },
  });

  // 2. Create 8 Batches
  console.log("2/7 Creating 8 Batches...");
  const batchData = Array.from({ length: 8 }).map((_, i) => ({
    name: `CS-Bench-Batch-${String.fromCharCode(65 + i)}`,
    department: DEPARTMENT,
    teacherId: teacher.id,
  }));

  const batches = [];
  for (const b of batchData) {
    const existing = await prisma.batch.findFirst({
      where: { name: b.name, department: DEPARTMENT },
    });
    if (existing) {
      batches.push(existing);
    } else {
      const created = await prisma.batch.create({ data: b });
      batches.push(created);
    }
  }

  // 3. Create 2,000 Students in chunks
  console.log("3/7 Generating 2,000 Students...");
  const totalStudents = 2000;
  const studentIds: string[] = [];

  // Check if students already seeded
  const existingStudents = await prisma.user.findMany({
    where: {
      email: { startsWith: "student.bench." },
    },
    select: { id: true },
    take: totalStudents,
  });

  if (existingStudents.length >= totalStudents) {
    console.log(`✓ Reusing existing ${existingStudents.length} benchmark students.`);
    studentIds.push(...existingStudents.map((s) => s.id));
  } else {
    const studentsToCreate = [];
    for (let i = 1; i <= totalStudents; i++) {
      const padded = String(i).padStart(4, "0");
      studentsToCreate.push({
        name: `Benchmark Student ${padded}`,
        email: `student.bench.${padded}@smartassess.test`,
        prn: `PRN-BENCH-${padded}`,
        role: "STUDENT" as const,
        department: DEPARTMENT,
        year: `Year-${(i % 4) + 1}`,
        division: `Div-${String.fromCharCode(65 + (i % 3))}`,
      });
    }

    // Insert students in batches of 500
    for (let i = 0; i < studentsToCreate.length; i += 500) {
      const chunk = studentsToCreate.slice(i, i + 500);
      await prisma.user.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    const created = await prisma.user.findMany({
      where: { email: { startsWith: "student.bench." } },
      select: { id: true },
      take: totalStudents,
    });
    studentIds.push(...created.map((s) => s.id));
    console.log(`✓ Created and verified ${studentIds.length} benchmark students.`);
  }

  // Enroll students in batches
  console.log("Enrolling students into batches...");
  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const batch = batches[bIndex];
    // Each batch gets 250 students
    const slice = studentIds.slice(bIndex * 250, (bIndex + 1) * 250);
    if (slice.length > 0) {
      await prisma.batch.update({
        where: { id: batch.id },
        data: {
          students: {
            connect: slice.map((id) => ({ id })),
          },
        },
      });
    }
  }

  // 4. Create Question Pool (50 questions)
  console.log("4/7 Creating reusable question pool...");
  const subjects = ["DBMS", "Operating Systems", "Data Structures", "Algorithms", "Computer Networks"];
  const difficulties: Difficulty[] = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];
  const questionPool = [];

  for (let i = 1; i <= 50; i++) {
    const subject = subjects[i % subjects.length];
    const diff = difficulties[i % difficulties.length];
    const q = await prisma.question.create({
      data: {
        type: QuestionType.MCQ,
        content: `Benchmark question ${i}: What is the optimal time complexity of ${subject} operation?`,
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        correctAnswer: "O(log n)",
        difficulty: diff,
        topic: subject,
        tags: [subject.toLowerCase().replace(/\s+/g, "-"), "benchmark", diff.toLowerCase()],
        points: diff === Difficulty.HARD ? 3 : diff === Difficulty.MEDIUM ? 2 : 1,
        explanation: `Detailed explanation for question ${i} covering standard algorithmic trade-offs.`,
      },
    });
    questionPool.push(q);
  }

  // 5. Create 500 Exams
  console.log("5/7 Creating 500 benchmark exams...");
  const existingExams = await prisma.exam.findMany({
    where: { title: { startsWith: "Benchmark Exam" } },
    select: { id: true },
  });

  const examIds: string[] = existingExams.map((e) => e.id);
  const totalExams = 500;

  if (existingExams.length >= totalExams) {
    console.log(`✓ Reusing existing ${existingExams.length} benchmark exams.`);
  } else {
    const now = new Date();
    const examsNeeded = totalExams - existingExams.length;
    const examsToInsert = [];

    for (let i = 1; i <= examsNeeded; i++) {
      const idx = existingExams.length + i;
      const batch = batches[idx % batches.length];
      const subject = subjects[idx % subjects.length];

      // Distribute timestamps: past (expired), ongoing (active), future (upcoming), draft
      let startTime: Date;
      let endTime: Date;
      let published = true;
      let status: ExamStatus = ExamStatus.UPCOMING;

      const mod = idx % 5;
      if (mod === 0) {
        // Active
        startTime = new Date(now.getTime() - 30 * 60 * 1000);
        endTime = new Date(now.getTime() + 60 * 60 * 1000);
        status = ExamStatus.ACTIVE;
      } else if (mod === 1 || mod === 2) {
        // Expired
        startTime = new Date(now.getTime() - (idx * 2 + 10) * 3600 * 1000);
        endTime = new Date(now.getTime() - (idx * 2) * 3600 * 1000);
        status = ExamStatus.EXPIRED;
      } else if (mod === 3) {
        // Upcoming
        startTime = new Date(now.getTime() + (idx * 3 + 5) * 3600 * 1000);
        endTime = new Date(now.getTime() + (idx * 3 + 8) * 3600 * 1000);
        status = ExamStatus.UPCOMING;
      } else {
        // Draft
        startTime = new Date(now.getTime() + 24 * 3600 * 1000);
        endTime = new Date(now.getTime() + 27 * 3600 * 1000);
        published = false;
        status = ExamStatus.DRAFT;
      }

      examsToInsert.push({
        title: `Benchmark Exam #${String(idx).padStart(3, "0")} - ${subject}`,
        description: `Comprehensive examination covering key concepts in ${subject} for benchmark testing.`,
        startTime,
        endTime,
        duration: 60,
        batchId: batch.id,
        published,
        status,
        subjects: [subject],
        examCode: `BENCH-${idx}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      });
    }

    // Insert exams in chunks of 100
    for (let i = 0; i < examsToInsert.length; i += 100) {
      const chunk = examsToInsert.slice(i, i + 100);
      await prisma.exam.createMany({
        data: chunk,
      });
    }

    const createdExams = await prisma.exam.findMany({
      where: { title: { startsWith: "Benchmark Exam" } },
      select: { id: true },
    });
    examIds.length = 0;
    examIds.push(...createdExams.map((e) => e.id));
    console.log(`✓ Created and verified ${examIds.length} benchmark exams.`);
  }

  // Link 5 questions to each of the first 50 exams
  console.log("Linking questions to sample exams...");
  for (let i = 0; i < Math.min(50, examIds.length); i++) {
    const examId = examIds[i];
    const sampleQuestions = questionPool.slice(0, 5);
    for (let qIdx = 0; qIdx < sampleQuestions.length; qIdx++) {
      await prisma.examQuestion.upsert({
        where: {
          examId_questionId: {
            examId,
            questionId: sampleQuestions[qIdx].id,
          },
        },
        update: {},
        create: {
          examId,
          questionId: sampleQuestions[qIdx].id,
          order: qIdx + 1,
          points: sampleQuestions[qIdx].points,
        },
      });
    }
  }

  // 6. Generate ~20,000 student sessions
  console.log("6/7 Generating ~20,000 Student Exam Sessions...");
  const targetSessions = 20000;
  const existingSessionCount = await prisma.studentExamSession.count({
    where: { exam: { title: { startsWith: "Benchmark Exam" } } },
  });

  if (existingSessionCount >= targetSessions) {
    console.log(`✓ Reusing existing ${existingSessionCount} sessions.`);
  } else {
    const sessionsNeeded = targetSessions - existingSessionCount;
    const sessionChunks = [];
    const ipPool = ["192.168.1.10", "192.168.1.25", "10.0.0.4", "10.0.0.8", "172.16.0.12"];

    let count = 0;
    const now = new Date();

    for (let eIdx = 0; eIdx < examIds.length && count < sessionsNeeded; eIdx++) {
      const examId = examIds[eIdx];
      // 40 students per exam
      for (let sIdx = 0; sIdx < 40 && count < sessionsNeeded; sIdx++) {
        const studentId = studentIds[(eIdx * 40 + sIdx) % studentIds.length];
        const pct = Math.floor(Math.random() * 100);
        const violations = Math.random() < 0.15 ? Math.floor(Math.random() * 8) : 0;
        const risk = violations >= 5 ? 80 : violations >= 3 ? 50 : violations > 0 ? 20 : 0;

        let status: SessionStatus = SessionStatus.COMPLETED;
        if (sIdx % 8 === 0) status = SessionStatus.STARTED;
        else if (sIdx % 20 === 0) status = SessionStatus.FORCE_SUBMITTED;

        sessionChunks.push({
          examId,
          studentId,
          status,
          totalScore: pct * 0.5,
          maxScore: 50,
          percentage: pct,
          violationCount: violations,
          tabSwitches: violations,
          riskScore: risk,
          ipAddress: ipPool[count % ipPool.length],
          lastHeartbeatAt: new Date(now.getTime() - (count % 300) * 1000),
          submittedAt: status === SessionStatus.COMPLETED ? new Date(now.getTime() - (count % 86400) * 1000) : null,
          startTime: new Date(now.getTime() - 3600 * 1000),
        });

        count++;
      }
    }

    // Insert sessions in chunks of 1,000
    for (let i = 0; i < sessionChunks.length; i += 1000) {
      const chunk = sessionChunks.slice(i, i + 1000);
      await prisma.studentExamSession.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      console.log(`  Inserted sessions ${Math.min(i + 1000, sessionChunks.length)} / ${sessionChunks.length}`);
    }
  }

  console.log("7/7 Verification & Summary:");
  const finalExams = await prisma.exam.count({ where: { title: { startsWith: "Benchmark Exam" } } });
  const finalSessions = await prisma.studentExamSession.count({ where: { exam: { title: { startsWith: "Benchmark Exam" } } } });
  const finalStudents = await prisma.user.count({ where: { email: { startsWith: "student.bench." } } });

  console.log(`✅ Seed complete:`);
  console.log(`   - 1 Department (${DEPARTMENT})`);
  console.log(`   - 8 Batches`);
  console.log(`   - ${finalStudents} Students`);
  console.log(`   - ${finalExams} Exams`);
  console.log(`   - ${finalSessions} Sessions`);
  console.timeEnd("seed-large-duration");
}

main()
  .catch((e) => {
    console.error("Error during seed-large:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
