"use client";

import { useState } from "react";
import { Edit2, X, Loader2, BookOpen, Code2, Save, Plus } from "lucide-react";
import { updateQuestion } from "@/app/actions/exam";
import { useRouter } from "next/navigation";

interface Question {
  id: string;
  type: "MCQ" | "CODING";
  content: string;
  options: Record<string, string> | null;
  correctAnswer: string | null;
  testCases: { input: string; output: string }[] | null;
  points: number;
}

export default function EditQuestionModal({ 
  examId, 
  question 
}: { 
  examId: string; 
  question: Question;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    type: question.type,
    content: question.content,
    options: (question.options as Record<string, string>) || { A: "", B: "", C: "", D: "" },
    correctAnswer: question.correctAnswer || "A",
    testCases: (question.testCases as { input: string; output: string }[]) || [{ input: "", output: "" }],
    points: question.points,
  });

  const handleAddTestCase = () => {
    setFormData({
      ...formData,
      testCases: [...formData.testCases, { input: "", output: "" }]
    });
  };

  const handleRemoveTestCase = (index: number) => {
    const newTestCases = [...formData.testCases];
    newTestCases.splice(index, 1);
    setFormData({ ...formData, testCases: newTestCases });
  };

  const handleTestCaseChange = (index: number, field: "input" | "output", value: string) => {
    const newTestCases = [...formData.testCases];
    newTestCases[index][field] = value;
    setFormData({ ...formData, testCases: newTestCases });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        type: formData.type,
        content: formData.content,
        options: formData.type === "MCQ" ? formData.options : undefined,
        correctAnswer: formData.type === "MCQ" ? formData.correctAnswer : undefined,
        testCases: formData.type === "CODING" ? formData.testCases : undefined,
        points: formData.points,
      };

      await updateQuestion(examId, question.id, data);
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to update question:", err);
      alert("Failed to update question. Please check your data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
        title="Edit question"
      >
        <Edit2 className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-8 py-6 bg-gray-50 border-b flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Edit Question</h3>
                <p className="text-sm text-gray-500">Update the details for this assessment item.</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Type Selector */}
              <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "MCQ" })}
                  className={`flex items-center px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    formData.type === "MCQ" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  MCQ
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "CODING" })}
                  className={`flex items-center px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    formData.type === "CODING" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Code2 className="w-4 h-4 mr-2" />
                  Coding
                </button>
              </div>

              {/* Question Content */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Question Content</label>
                <textarea
                  required
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter question text (Markdown supported)..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 outline-none transition-all resize-none bg-white text-black font-semibold"
                />
              </div>

              {formData.type === "MCQ" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {["A", "B", "C", "D"].map((opt) => (
                      <div key={opt} className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Option {opt}</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={formData.options[opt]}
                            onChange={(e) => setFormData({
                              ...formData,
                              options: { ...formData.options, [opt]: e.target.value }
                            })}
                            className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white text-black font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, correctAnswer: opt })}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all ${
                              formData.correctAnswer === opt ? "bg-green-100 text-green-600" : "text-gray-300 hover:text-gray-400"
                            }`}
                          >
                            <Save className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <span className="text-sm font-medium text-blue-700">Correct Answer Selected:</span>
                    <span className="px-4 py-1 bg-blue-600 text-white font-bold rounded-lg">Option {formData.correctAnswer}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Test Cases</label>
                    <button
                      type="button"
                      onClick={handleAddTestCase}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center bg-blue-50 px-2 py-1 rounded"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Case
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {formData.testCases.map((tc, index) => (
                      <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-100 relative group">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            placeholder="Input"
                            value={tc.input}
                            onChange={(e) => handleTestCaseChange(index, "input", e.target.value)}
                            className="w-full px-3 py-1.5 border rounded bg-white text-black font-semibold text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Expected Output"
                            value={tc.output}
                            onChange={(e) => handleTestCaseChange(index, "output", e.target.value)}
                            className="w-full px-3 py-1.5 border rounded bg-white text-black font-semibold text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        {formData.testCases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTestCase(index)}
                            className="text-gray-400 hover:text-red-600 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="w-48">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider block mb-2">Points</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseFloat(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white text-black font-bold"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-8 py-6 border-t bg-gray-50 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
