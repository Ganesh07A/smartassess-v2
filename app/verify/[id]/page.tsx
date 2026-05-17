import { prisma } from "@/app/db";
import { notFound } from "next/navigation";
import { CheckCircle, ShieldCheck, Calendar, User, BookOpen, Award } from "lucide-react";

export default async function VerifyCertificatePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  // Search by either ID or verificationCode
  const certificate = await prisma.certificate.findFirst({
    where: {
      OR: [
        { id: id },
        { verificationCode: id },
        { certificateId: id }
      ]
    },
    include: {
      student: {
        select: { name: true, prn: true }
      },
      exam: {
        select: { title: true }
      }
    }
  });

  if (!certificate) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-8 text-center text-white relative overflow-hidden">
          <ShieldCheck className="w-24 h-24 absolute -right-6 -bottom-6 opacity-10" />
          <Award className="w-12 h-12 mx-auto mb-4 opacity-80" />
          <h1 className="text-3xl font-black tracking-tight">Verified Certificate</h1>
          <p className="text-blue-100 mt-2 font-medium">SmartAssess Official Verification</p>
        </div>

        <div className="p-10 space-y-8">
          <div className="flex items-center justify-center space-x-2 text-green-600 bg-green-50 py-3 rounded-2xl border border-green-100">
            <CheckCircle className="w-5 h-5" />
            <span className="font-bold uppercase tracking-widest text-xs">Authenticity Confirmed</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                <User className="w-3 h-3 mr-1" /> Student Name
              </p>
              <p className="text-lg font-bold text-gray-800">{certificate.student.name}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                <BookOpen className="w-3 h-3 mr-1" /> Examination
              </p>
              <p className="text-lg font-bold text-gray-800">{certificate.exam.title}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                <Calendar className="w-3 h-3 mr-1" /> Issue Date
              </p>
              <p className="text-lg font-bold text-gray-800">{new Date(certificate.issueDate).toLocaleDateString()}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1" /> Certificate ID
              </p>
              <p className="text-lg font-bold text-gray-800">{certificate.certificateId}</p>
            </div>
          </div>

          <div className="pt-8 border-t border-dashed border-gray-200">
            <div className="bg-gray-50 p-6 rounded-2xl border flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Verification Code</p>
                <p className="text-xl font-mono font-black text-blue-600 tracking-wider">{certificate.verificationCode}</p>
              </div>
              <div className="shrink-0">
                {/* A real QR code would be great here, but for now we'll use a placeholder or icon */}
                <div className="w-16 h-16 bg-white rounded-xl border-2 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-blue-100" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t text-center">
          <p className="text-xs text-gray-400 font-medium italic">
            This digital certificate has been issued by SmartAssess and can be verified anytime via this link.
          </p>
        </div>
      </div>
    </div>
  );
}
