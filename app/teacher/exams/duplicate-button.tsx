"use client";

import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { duplicateExam } from "@/app/actions/exam";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DuplicateButton({ examId }: { examId: string }) {
  const [isDuplicating, setIsDuplicating] = useState(false);
  const router = useRouter();

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDuplicating(true);
    const toastId = toast.loading("Duplicating exam and questions...");
    try {
      await duplicateExam(examId);
      toast.success("Exam duplicated successfully! Check the top of the list.", { id: toastId });
      router.refresh();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to duplicate exam", { id: toastId });
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <button
      onClick={handleDuplicate}
      disabled={isDuplicating}
      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center border border-transparent hover:border-blue-100"
      title="Duplicate Exam"
    >
      {isDuplicating ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Copy className="w-5 h-5" />
      )}
    </button>
  );
}
