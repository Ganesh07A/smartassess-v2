"use client";

import { useState } from "react";
import { Plus, X, Loader2, BookOpen, Code2 } from "lucide-react";
import { uploadQuestions } from "@/app/actions/exam";
import { useRouter } from "next/navigation";

export default function ManualQuestionAdder({ examId }: { examId: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<"MCQ" | "CODING">("MCQ");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [mcqData, setMcqData] = useState({
    content: "",
    options: { A: "", B: "", C: "", D: "" },
    correctAnswer: "A",
    points: 1,
  });

  const [codingData, setCodingData] = useState({
    content: "",
    testCases: [{ input: "", output: "" }],
    points: 5,
  });

  const handleAddTestCase = () => {
    setCodingData({
      ...codingData,
      testCases: [...codingData.testCases, { input: "", output: "" }]
    });
  };

  const handleRemoveTestCase = (index: number) => {
    const newTestCases = [...codingData.testCases];
    newTestCases.splice(index, 1);
    setCodingData({ ...codingData, testCases: newTestCases });
  };

  const handleTestCaseChange = (index: number, field: "input" | "output", value: string) => {
    const newTestCases = [...codingData.testCases];
    newTestCases[index][field] = value;
    setCodingData({ ...codingData, testCases: newTestCases });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const question = type === "MCQ" 
        ? { ...mcqData, type: "MCQ" as const } 
        : { ...codingData, type: "CODING" as const };

      await uploadQuestions(examId, [question]);
      setIsModalOpen(false);
      router.refresh();
      // Reset forms
      setMcqData({ content: "", options: { A: "", B: "", C: "", D: "" }, correctAnswer: "A", points: 1 });
      setCodingData({ content: "", testCases: [{ input: "", output: "" }], points: 5 });
    } catch (err) {
      console.error("Failed to add question:", err);
      alert("Failed to add question. Please check your data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Question Manually
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-2xl w-full p-8 shadow-xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Add Question</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex space-x-4 mb-8">
              <button
                onClick={() => setType("MCQ")}
                className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center transition-all ${
                  type === "MCQ" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-100 text-gray-500 hover:border-gray-200"
                }`}
              >
                <BookOpen className="w-5 h-5 mr-2" />
                MCQ
              </button>
              <button
                onClick={() => setType("CODING")}
                className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center transition-all ${
                  type === "CODING" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-100 text-gray-500 hover:border-gray-200"
                }`}
              >
                <Code2 className="w-5 h-5 mr-2" />
                Coding
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Content (Markdown supported)</label>
                <textarea
                  required
                  rows={3}
                  value={type === "MCQ" ? mcqData.content : codingData.content}
                  onChange={(e) => type === "MCQ" 
                    ? setMcqData({ ...mcqData, content: e.target.value })
                    : setCodingData({ ...codingData, content: e.target.value })
                  }
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black font-semibold"
                />
              </div>

              {type === "MCQ" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {["A", "B", "C", "D"].map((opt) => (
                      <div key={opt}>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Option {opt}</label>
                        <input
                          type="text"
                          required
                          value={mcqData.options[opt as keyof typeof mcqData.options]}
                          onChange={(e) => setMcqData({
                            ...mcqData,
                            options: { ...mcqData.options, [opt]: e.target.value }
                          })}
                          className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black font-semibold"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                      <select
                        value={mcqData.correctAnswer}
                        onChange={(e) => setMcqData({ ...mcqData, correctAnswer: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black font-semibold"
                      >
                        {["A", "B", "C", "D"].map(opt => <option key={opt} value={opt}>Option {opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={mcqData.points}
                        onChange={(e) => setMcqData({ ...mcqData, points: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black font-bold"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Test Cases</label>
                    <button
                      type="button"
                      onClick={handleAddTestCase}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center bg-blue-50 px-2 py-1 rounded"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Case
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {codingData.testCases.map((tc, index) => (
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
                        {codingData.testCases.length > 1 && (
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input
                      type="number"
                      min="1"
                      value={codingData.points}
                      onChange={(e) => setCodingData({ ...codingData, points: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black font-bold"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
