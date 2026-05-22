"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export default function ManualQuestionAdder({ examId }: { examId: string }) {
  return (
    <Link
      href={`/teacher/exams/${examId}/add-question`}
      className="flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl shadow-lg shadow-indigo-650/15 hover:shadow-indigo-650/25 active:scale-[0.98] transition-all duration-200 font-bold text-xs"
    >
      <Plus className="w-4.5 h-4.5 mr-1.5" />
      Add Question Manually
    </Link>
  );
}

