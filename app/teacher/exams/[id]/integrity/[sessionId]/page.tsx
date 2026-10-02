import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Hash, FileQuestion } from "lucide-react";
import LocalTime from "@/ui/local-time";
import { getSessionIntegrityTimeline } from "@/app/actions/integrity-actions";
import { ExportEvidenceButton } from "@/ui/integrity/export-evidence-button";
import { requireTeacher } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

export default async function StudentIntegrityTimelinePage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: examId, sessionId } = await params;
  const teacher = await requireTeacher();

  const data = await getSessionIntegrityTimeline(examId, sessionId);
  if (!data) {
    notFound();
  }

  const { exam, session, timeline, canonicalHash } = data;
  const student = session.student;

  // Calculate duration used
  const startTime = session.startTime ? new Date(session.startTime).getTime() : null;
  const submittedTime = session.submittedAt ? new Date(session.submittedAt).getTime() : null;
  const durationUsedMins =
    startTime && submittedTime
      ? Math.max(1, Math.round((submittedTime - startTime) / 60000))
      : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={`/teacher/exams/${examId}/integrity`}
          className="flex items-center text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors py-1.5 px-3 hover:bg-slate-100 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Integrity Console
        </Link>

        <ExportEvidenceButton
          examTitle={exam.title}
          studentName={student.name || "Student"}
          studentPrn={student.prn}
          studentEmail={student.email}
          sessionId={session.id}
          startedAt={session.startTime}
          submittedAt={session.submittedAt}
          totalScore={session.totalScore}
          percentage={session.percentage}
          ipAddress={session.ipAddress}
          userAgent={session.userAgent}
          events={session.events}
          submissions={session.submissions}
          canonicalHash={canonicalHash}
          teacherName={teacher.name || "Teacher"}
        />
      </div>

      {/* Student Identity and Session Header Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 space-y-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-md">
              Audit Trail Record
            </span>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
              {student.name || "Student Candidate"}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              {student.prn && (
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                  PRN: {student.prn}
                </span>
              )}
              <span>{student.email}</span>
              {student.department && <span>• {student.department}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Score</p>
              <p className="text-xl font-black text-slate-800">
                {session.totalScore.toFixed(1)} / {session.maxScore.toFixed(0)}
              </p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
              <p className="text-xs font-bold text-indigo-500 uppercase">Percentage</p>
              <p className="text-xl font-black text-indigo-700">
                {session.percentage.toFixed(1)}%
              </p>
            </div>
            <div
              className={`p-3.5 rounded-2xl text-center border ${
                session.riskScore >= 70
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : session.riskScore >= 40
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              <p className="text-xs font-bold uppercase">Risk Score</p>
              <p className="text-xl font-black">{session.riskScore}/100</p>
            </div>
          </div>
        </div>

        {/* Environmental Metadata Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Time Window
            </span>
            <span className="font-semibold text-slate-800">
              {durationUsedMins ? `${durationUsedMins} minutes used` : "In Progress"}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Client IP
            </span>
            <span className="font-mono font-semibold text-slate-800">
              {session.ipAddress || "Unknown"}
            </span>
          </div>
          <div className="md:col-span-2">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              User Agent
            </span>
            <span className="font-mono text-[11px] truncate block text-slate-700" title={session.userAgent || ""}>
              {session.userAgent || "Unknown Browser"}
            </span>
          </div>
        </div>

        {/* Audit Hash Strip */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3.5 py-2 rounded-xl text-[11px] text-slate-500 font-mono">
          <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-bold text-slate-600">Verification Hash:</span>
          <span className="truncate">{canonicalHash}</span>
        </div>
      </div>

      {/* Interleaved Timeline Stream */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-black text-slate-800">
            Chronological Proctor & Answer Stream
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Interleaved events and question answers showing correlation between violations and activity.
          </p>
        </div>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {timeline.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">No events recorded during this session.</p>
          ) : (
            timeline.map((item, idx) => {
              const isProctor = item.kind === "proctor";

              return (
                <div key={item.id || idx} className="relative flex items-start gap-4 group">
                  {/* Marker Dot */}
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white ${
                      isProctor
                        ? item.severity >= 3
                          ? "border-rose-500 text-rose-500"
                          : item.severity >= 2
                            ? "border-amber-500 text-amber-500"
                            : "border-blue-500 text-blue-500"
                        : "border-teal-500 text-teal-600"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isProctor
                          ? item.severity >= 3
                            ? "bg-rose-500"
                            : item.severity >= 2
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          : "bg-teal-500"
                      }`}
                    />
                  </div>

                  {/* Content Container */}
                  <div className="flex-1 bg-slate-50/70 border border-slate-100 rounded-2xl p-4 space-y-1.5 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isProctor ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              item.severity >= 3
                                ? "bg-rose-100 text-rose-800"
                                : item.severity >= 2
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {item.type.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 flex items-center gap-1">
                            <FileQuestion className="w-3 h-3" />
                            Submitted Answer
                          </span>
                        )}

                        {!isProctor && item.pointsAwarded !== null && (
                          <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                            {item.pointsAwarded} pts
                          </span>
                        )}

                        {!isProctor && (
                          <span className="text-xs font-bold text-slate-500">
                            Item ID: {item.questionId.slice(0, 8)}...
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 font-bold">
                        <LocalTime dateString={item.timestamp} />
                      </div>
                    </div>

                    {/* Metadata rendering for proctor events */}
                    {isProctor && item.metadata && (
                      <div className="text-xs font-mono text-slate-600 bg-white border border-slate-100 p-2.5 rounded-xl space-y-1">
                        {Object.entries(item.metadata).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="font-bold text-slate-400">{k}:</span>
                            <span className="text-slate-800">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
