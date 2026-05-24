"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { removeQuestionFromExam } from "@/app/actions/exam";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DeleteQuestionButton({ 
  examId, 
  questionId 
}: { 
  examId: string; 
  questionId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this question from the exam?")) {
      return;
    }

    setLoading(true);
    try {
      await removeQuestionFromExam(examId, questionId);
      router.refresh();
    } catch (err) {
      console.error("Failed to delete question:", err);
      toast.error("Failed to delete question.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
      title="Remove question"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Trash2 className="w-5 h-5" />
      )}
    </button>
  );
}
