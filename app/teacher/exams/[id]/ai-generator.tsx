"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, CheckCircle2, RefreshCcw } from "lucide-react";
import { generateAIQuestions } from "@/app/actions/ai";
import { uploadQuestions } from "@/app/actions/exam";
import { useRouter } from "next/navigation";

export default function AIGenerator({ examId }: { examId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const router = useRouter();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const questions = await generateAIQuestions(prompt, count);
      setGeneratedQuestions(questions);
    } catch (err: any) {
      alert(err.message || "Failed to generate questions");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await uploadQuestions(examId, generatedQuestions);
      setIsOpen(false);
      setGeneratedQuestions([]);
      setPrompt("");
      router.refresh();
    } catch (err) {
      alert("Failed to save questions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
          <Sparkles className="w-16 h-16 text-blue-600" />
        </div>
        <Sparkles className="w-10 h-10 text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2 text-gray-800">AI Generation</h3>
        <p className="text-sm text-gray-500 mb-6 px-4">Generate high-quality MCQs instantly from your notes or topics using AI.</p>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate with AI
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Sparkles className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">AI Question Generator</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {generatedQuestions.length === 0 ? (
                <div className="space-y-6">
                  <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                    <p className="text-sm font-bold text-blue-800 mb-4 uppercase tracking-widest">Input Source</p>
                    <textarea
                      placeholder="Paste your lecture notes, a specific topic (e.g., 'React Hooks and Virtual DOM'), or any text you want to generate questions from..."
                      className="w-full h-48 p-4 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-medium leading-relaxed resize-none shadow-inner"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Number of Questions</span>
                      <select 
                        value={count}
                        onChange={(e) => setCount(parseInt(e.target.value))}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[3, 5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={loading || !prompt.trim()}
                      className="flex items-center px-8 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-xl shadow-blue-200"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5 mr-2" />
                      )}
                      {loading ? "Analyzing & Generating..." : "Generate MCQs"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-100">
                    <p className="text-green-800 font-bold flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Generated {generatedQuestions.length} Questions successfully.
                    </p>
                    <button 
                      onClick={() => setGeneratedQuestions([])}
                      className="text-xs font-black text-green-700 uppercase tracking-widest hover:underline flex items-center"
                    >
                      <RefreshCcw className="w-3 h-3 mr-1" /> Re-generate
                    </button>
                  </div>

                  <div className="space-y-4">
                    {generatedQuestions.map((q, idx) => (
                      <div key={idx} className="p-6 rounded-2xl border-2 border-gray-50 bg-white">
                        <div className="flex justify-between items-start mb-4">
                          <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                            Question {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-blue-600">
                            Answer: {q.correctAnswer}
                          </span>
                        </div>
                        <p className="font-bold text-gray-800 mb-4">{q.content}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(q.options).map(([key, val]: any) => (
                            <div key={key} className={`p-3 rounded-xl border text-sm font-semibold ${q.correctAnswer === key ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                              <span className="mr-2 font-black">{key}:</span> {val}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t flex justify-end space-x-4">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAll}
                      disabled={saving}
                      className="flex items-center px-10 py-3 bg-gray-900 text-white font-black rounded-xl hover:bg-black transition-all shadow-2xl disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                      Add All to Exam
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
