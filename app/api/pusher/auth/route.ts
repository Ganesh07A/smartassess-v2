import { NextResponse, type NextRequest } from "next/server";
import { isPusherConfigured, pusherServer } from "@/app/lib/pusher-server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { assertExamAccess, requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { prisma } from "@/app/db";

/**
 * Pusher channel authorization.
 *
 * Without this endpoint the app could only use *public* channels, which anybody with the app key
 * (shipped to every browser) could subscribe to — leaking the student names, PRNs and IP
 * addresses that the live monitor publishes.
 */
export async function POST(request: NextRequest) {
  if (!isPusherConfigured) {
    return NextResponse.json({ error: "Realtime is not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.formData().catch(() => null);
  const socketId = body?.get("socket_id")?.toString();
  const channel = body?.get("channel_name")?.toString();

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  const authorized = channel.startsWith("private-exam-")
    ? await canAccessExamChannel(channel, session.user.id, session.user.role)
    : channel.startsWith("private-session-")
      ? await canAccessSessionChannel(channel, session.user.id, session.user.role)
      : false;

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}

async function canAccessExamChannel(channel: string, userId: string, role: string) {
  const examId = channel.replace("private-exam-", "");

  if (role === "TEACHER") {
    try {
      const teacher = await requireTeacher();
      await assertExamAccess(examId, teacher, { id: true });
      return true;
    } catch {
      return false;
    }
  }

  if (role === "STUDENT") {
    // Students may watch their own live session state, never the whole cohort feed.
    const session = await prisma.studentExamSession.findFirst({
      where: { examId, studentId: userId },
      select: { id: true },
    });
    return Boolean(session);
  }

  return false;
}

async function canAccessSessionChannel(channel: string, userId: string, role: string) {
  const sessionId = channel.replace("private-session-", "");
  const session = await prisma.studentExamSession.findFirst({
    where: { id: sessionId, ...(role === "STUDENT" ? { studentId: userId } : {}) },
    select: { id: true, examId: true, exam: { select: { batchId: true } } },
  });

  if (!session) return false;
  if (role === "STUDENT") return true;

  if (role === "TEACHER") {
    const teacher = await requireTeacher();
    const allowed = await prisma.exam.count({
      where: { AND: [{ id: session.examId }, teacherExamScope(teacher)] },
    });
    return allowed > 0;
  }

  return false;
}
