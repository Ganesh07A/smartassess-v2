import { prisma } from "@/app/db";
import { notFound } from "next/navigation";
import {
  CheckCircle,
  ShieldCheck,
  Calendar,
  User,
  BookOpen,
  Award,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";
import LocalTime from "@/ui/local-time";

export const dynamic = "force-dynamic";

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Search by either UUID, verificationCode, or certificateId
  const certificate = await prisma.certificate.findFirst({
    where: {
      OR: [
        { id: id },
        { verificationCode: id },
        { certificateId: id },
      ],
    },
    include: {
      student: {
        select: { name: true, prn: true },
      },
      exam: {
        select: { title: true, startTime: true },
      },
    },
  });

  if (!certificate) {
    notFound();
  }

  const isRevoked = Boolean(certificate.revokedAt);

  // Mask PRN to protect privacy on public verification link (e.g. PRN•••456)
  const rawPrn = certificate.student.prn;
  const maskedPrn = rawPrn
    ? rawPrn.length > 3
      ? `PRN•••${rawPrn.slice(-3)}`
      : `PRN•••`
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-6 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in duration-300">
        {/* Top Hero Banner */}
        {isRevoked ? (
          <div className="bg-rose-600 p-8 text-center text-white relative overflow-hidden">
            <AlertTriangle className="w-24 h-24 absolute -right-6 -bottom-6 opacity-10" />
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-90" />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              REVOKED CREDENTIAL
            </h1>
            <p className="text-rose-100 mt-2 font-medium text-xs md:text-sm">
              This certificate has been revoked by the issuing institution.
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 text-center text-white relative overflow-hidden">
            <ShieldCheck className="w-24 h-24 absolute -right-6 -bottom-6 opacity-10" />
            <Award className="w-12 h-12 mx-auto mb-4 opacity-90" />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Verified Certificate
            </h1>
            <p className="text-indigo-100 mt-2 font-medium text-xs md:text-sm">
              SmartAssess Official Academic Credential Verification
            </p>
          </div>
        )}

        <div className="p-8 md:p-10 space-y-8">
          {/* Status Badge */}
          {isRevoked ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-black uppercase tracking-wider text-xs">
                  Credential Nullified
                </span>
              </div>
              <p className="text-xs text-rose-700 font-medium">
                Revoked on{" "}
                <LocalTime
                  dateString={certificate.revokedAt!}
                  mode="date"
                  className="font-bold"
                />
                .
              </p>
              {certificate.revokedReason && (
                <p className="text-xs text-rose-900 bg-white/80 p-2.5 rounded-xl border border-rose-200/60 font-mono">
                  <strong>Reason:</strong> {certificate.revokedReason}
                </p>
              )}
              <p className="text-[11px] text-rose-500 pt-1">
                Please contact the issuing department or academic registrar for inquiries.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 py-3 px-4 rounded-2xl border border-emerald-100">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="font-black uppercase tracking-widest text-xs">
                Authenticity Confirmed
              </span>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-slate-400" /> Candidate
              </p>
              <p className="text-base font-black text-slate-800">
                {certificate.student.name || "Student"}
              </p>
              {maskedPrn && (
                <p className="font-mono text-xs font-bold text-slate-500">{maskedPrn}</p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                <BookOpen className="w-3.5 h-3.5 mr-1 text-slate-400" /> Examination
              </p>
              <p className="text-base font-black text-slate-800">
                {certificate.exam.title}
              </p>
              <p className="text-xs text-slate-500">
                Held: <LocalTime dateString={certificate.exam.startTime} mode="date" />
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                <GraduationCap className="w-3.5 h-3.5 mr-1 text-slate-400" /> Grade Awarded
              </p>
              <p className="text-base font-black text-indigo-700">
                {certificate.grade || "Passing Grade"}
              </p>
              {certificate.score !== null && (
                <p className="text-xs font-bold text-slate-500">
                  Earned Score: {certificate.score} pts
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Issued Date
              </p>
              <p className="text-base font-black text-slate-800">
                <LocalTime dateString={certificate.issueDate} mode="date" />
              </p>
            </div>
          </div>

          {/* Verification Code Box */}
          <div className="pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Certificate Identifier
                </p>
                <p className="text-lg font-mono font-black text-slate-800">
                  {certificate.certificateId}
                </p>
                <p className="text-xs font-mono text-indigo-600 font-bold">
                  Code: {certificate.verificationCode}
                </p>
              </div>

              <div className="shrink-0 w-14 h-14 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                <ShieldCheck className="w-8 h-8 text-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50/70 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium italic">
            This digital certificate is cryptographically recorded by SmartAssess and can be verified at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
