"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  BookOpen, 
  Code2, 
  Plus, 
  X, 
  Loader2, 
  Check, 
  ChevronRight, 
  PlusCircle, 
  Trash2,
  HelpCircle
} from "lucide-react";
import { uploadQuestions } from "@/app/actions/exam";

export default function QuestionBuilderForm({ examId }: { examId: string }) {
  const [type, setType] = useState<"MCQ" | "CODING">("MCQ");
  const [loading, setLoading] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent, shouldAddAnother: boolean) => {
    e.preventDefault();
    setLoading(true);
    setAddAnother(shouldAddAnother);

    try {
      const question = type === "MCQ" 
        ? { ...mcqData, type: "MCQ" as const } 
        : { ...codingData, type: "CODING" as const };

      if (!question.content.trim()) {
        toast.error("Question content cannot be empty.");
        setLoading(false);
        return;
      }

      if (type === "MCQ") {
        const opts = mcqData.options;
        if (!opts.A.trim() || !opts.B.trim() || !opts.C.trim() || !opts.D.trim()) {
          toast.error("Please fill in all MCQ options.");
          setLoading(false);
          return;
        }
      } else {
        const emptyTC = codingData.testCases.some(tc => !tc.input.trim() || !tc.output.trim());
        if (emptyTC) {
          toast.error("Please fill in all test case fields.");
          setLoading(false);
          return;
        }
      }

      const toastId = toast.loading("Adding question...");
      await uploadQuestions(examId, [question]);
      toast.success("Question added successfully!", { id: toastId });
      
      // Reset forms
      setMcqData({ content: "", options: { A: "", B: "", C: "", D: "" }, correctAnswer: "A", points: 1 });
      setCodingData({ content: "", testCases: [{ input: "", output: "" }], points: 5 });

      if (!shouldAddAnother) {
        router.push(`/teacher/exams/${examId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to add question:", err);
      toast.error("Failed to add question. Please verify connection and data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-8 space-y-8">
      
      {/* Type Selection */}
      <div className="space-y-3">
        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
          Question Type
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setType("MCQ")}
            className={`flex items-center justify-center py-4 px-6 rounded-2xl border-2 transition-all duration-200 ${
              type === "MCQ" 
                ? "border-indigo-500 bg-indigo-50/50 text-indigo-750 font-black shadow-sm" 
                : "border-slate-100 bg-slate-50/50 text-slate-550 font-bold hover:bg-slate-100/50 hover:text-slate-700"
            }`}
          >
            <BookOpen className="w-5 h-5 mr-2.5 shrink-0" />
            Multiple Choice (MCQ)
          </button>
          <button
            type="button"
            onClick={() => setType("CODING")}
            className={`flex items-center justify-center py-4 px-6 rounded-2xl border-2 transition-all duration-200 ${
              type === "CODING" 
                ? "border-teal-500 bg-teal-50/50 text-teal-750 font-black shadow-sm" 
                : "border-slate-100 bg-slate-50/50 text-slate-550 font-bold hover:bg-slate-100/50 hover:text-slate-700"
            }`}
          >
            <Code2 className="w-5 h-5 mr-2.5 shrink-0" />
            Coding Problem
          </button>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Main Form Fields */}
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-8">
        
        {/* Content Field */}
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
            Question Statement (Markdown supported)
          </label>
          <textarea
            required
            rows={4}
            value={type === "MCQ" ? mcqData.content : codingData.content}
            onChange={(e) => type === "MCQ" 
              ? setMcqData({ ...mcqData, content: e.target.value })
              : setCodingData({ ...codingData, content: e.target.value })
            }
            placeholder={type === "MCQ" 
              ? "e.g. Which of the following is not a React Hook?\n\n- Option 1\n- Option 2" 
              : "e.g. Write a function reverseString(str: string): string that returns the reversed string."
            }
            className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 text-slate-800 font-semibold placeholder:text-slate-400 bg-slate-50/30 transition-all resize-none"
          />
        </div>

        {/* Dynamic Inner Forms */}
        {type === "MCQ" ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                Define Options & Choose Correct Answer
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["A", "B", "C", "D"] as const).map((opt) => {
                  const isCorrect = mcqData.correctAnswer === opt;
                  return (
                    <div 
                      key={opt}
                      onClick={() => setMcqData({ ...mcqData, correctAnswer: opt })}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center space-x-3 ${
                        isCorrect 
                          ? "border-emerald-500 bg-emerald-50/20 text-slate-800" 
                          : "border-slate-100 bg-white hover:border-slate-200 text-slate-600"
                      }`}
                    >
                      <button
                        type="button"
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                          isCorrect 
                            ? "bg-emerald-500 border-emerald-600 text-white" 
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isCorrect ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-black">{opt}</span>}
                      </button>

                      <input
                        type="text"
                        required
                        value={mcqData.options[opt]}
                        onChange={(e) => {
                          e.stopPropagation();
                          setMcqData({
                            ...mcqData,
                            options: { ...mcqData.options, [opt]: e.target.value }
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder={`Enter option ${opt}...`}
                        className="flex-1 bg-transparent border-0 outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400 p-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full md:w-1/3 space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                Points Allocation
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={mcqData.points}
                onChange={(e) => setMcqData({ ...mcqData, points: parseFloat(e.target.value) || 1 })}
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 text-slate-800 font-bold bg-slate-50/30"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Coding Test Cases */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  Dynamic Test Cases
                </label>
                <button
                  type="button"
                  onClick={handleAddTestCase}
                  className="inline-flex items-center text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3.5 py-1.5 rounded-xl border border-indigo-100/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Case
                </button>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {codingData.testCases.map((tc, index) => (
                  <div key={index} className="flex gap-4 items-start bg-slate-50/50 p-4 rounded-2xl border border-slate-100/80 relative group">
                    <span className="text-[10px] font-black text-slate-400 absolute top-3 right-4">
                      Case #{index + 1}
                    </span>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Input</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 'hello'"
                          value={tc.input}
                          onChange={(e) => handleTestCaseChange(index, "input", e.target.value)}
                          className="w-full px-3.5 py-2 border rounded-xl bg-white text-slate-800 font-semibold text-xs border-slate-100 outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Expected Output</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 'olleh'"
                          value={tc.output}
                          onChange={(e) => handleTestCaseChange(index, "output", e.target.value)}
                          className="w-full px-3.5 py-2 border rounded-xl bg-white text-slate-800 font-semibold text-xs border-slate-100 outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    {codingData.testCases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTestCase(index)}
                        className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-slate-100 rounded-lg self-end mt-4 md:mt-0 transition-colors"
                        title="Remove Test Case"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full md:w-1/3 space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                Points Allocation
              </label>
              <input
                type="number"
                min="1"
                required
                value={codingData.points}
                onChange={(e) => setCodingData({ ...codingData, points: parseFloat(e.target.value) || 5 })}
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl outline-none focus:border-teal-500 text-slate-800 font-bold bg-slate-50/30"
              />
            </div>

          </div>
        )}

        <hr className="border-slate-100" />

        {/* Save and Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push(`/teacher/exams/${examId}`)}
            className="px-6 py-3 border-2 border-slate-100 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors text-xs order-3 sm:order-1"
          >
            Cancel & Exit
          </button>
          
          <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, true)}
              className="inline-flex items-center justify-center px-6 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 font-black rounded-xl hover:bg-indigo-100/80 active:scale-[0.98] transition-all text-xs disabled:opacity-50"
            >
              {loading && addAnother ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4 mr-2" />
              )}
              Save & Add Another
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-indigo-600 to-indigo-750 text-white font-black rounded-xl hover:from-indigo-650 hover:to-indigo-800 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all text-xs disabled:opacity-50"
            >
              {loading && !addAnother ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save & Exit
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
