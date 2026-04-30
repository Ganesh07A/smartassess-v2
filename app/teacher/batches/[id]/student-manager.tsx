"use client";

import { useState } from "react";
import { UserPlus, Loader2, UserMinus } from "lucide-react";
import { addStudentToBatch, removeStudentFromBatch } from "@/app/actions/batch";

interface Student {
  id: string;
  name: string | null;
  email: string | null;
  prn: string | null;
}

export default function StudentManager({ 
  batchId, 
  initialStudents 
}: { 
  batchId: string; 
  initialStudents: Student[] 
}) {
  const [emailOrPrn, setEmailOrPrn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPrn.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      await addStudentToBatch(batchId, emailOrPrn);
      setEmailOrPrn("");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to add student";
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm("Remove this student from the batch?")) return;

    try {
      await removeStudentFromBatch(batchId, studentId);
    } catch (err) {
      console.error("Failed to remove student:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-blue-600" />
          Add Student
        </h3>
        <form onSubmit={handleAddStudent} className="flex gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={emailOrPrn}
              onChange={(e) => setEmailOrPrn(e.target.value)}
              placeholder="Enter student email or PRN"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {error && <p className="text-red-500 text-xs mt-1 absolute">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={submitting || !emailOrPrn.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center h-10"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">Enrolled Students ({initialStudents.length})</h3>
        </div>
        <div className="divide-y">
          {initialStudents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No students enrolled in this batch yet.
            </div>
          ) : (
            initialStudents.map((student) => (
              <div key={student.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">{student.name || "Unnamed Student"}</p>
                  <div className="flex space-x-4 text-sm text-gray-500">
                    <span>{student.email}</span>
                    {student.prn && <span>PRN: {student.prn}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveStudent(student.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Remove student"
                >
                  <UserMinus className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
