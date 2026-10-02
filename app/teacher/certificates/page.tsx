import { prisma } from "@/app/db";
import { requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTeacherCertificatesPaged } from "@/app/actions/certificate-admin";
import CertificatesClient from "./certificates-client";

export const dynamic = "force-dynamic";

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const teacher = await requireTeacher();
  const rawParams = await searchParams;

  const examFilterParam = Array.isArray(rawParams.exam)
    ? rawParams.exam[0]
    : rawParams.exam;

  const [pagedData, activeExam] = await Promise.all([
    getTeacherCertificatesPaged(rawParams),
    examFilterParam
      ? prisma.exam.findFirst({
          where: {
            AND: [{ id: examFilterParam }, teacherExamScope(teacher)],
          },
          select: { id: true, title: true },
        })
      : null,
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center">
        <Link
          href={activeExam ? `/teacher/exams/${activeExam.id}` : "/teacher/exams"}
          className="flex items-center text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors py-1.5 px-3 hover:bg-slate-100 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {activeExam ? `Back to ${activeExam.title}` : "Back to Examinations"}
        </Link>
      </div>

      {/* Main Hero Header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/60 px-2.5 py-1 rounded-md">
            Credentials & Verification
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-2">
            Certificates Management
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Browse, bulk issue, and manage revocations for student credentials.
          </p>
        </div>
      </div>

      <CertificatesClient
        data={pagedData}
        activeExamId={activeExam?.id}
        activeExamTitle={activeExam?.title}
      />
    </div>
  );
}
