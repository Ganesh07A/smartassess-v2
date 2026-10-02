"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExam } from "@/app/actions/exam";
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  Code, 
  Shuffle, 
  Loader2, 
  AlertCircle, 
  Sparkles, 
  Lock,
  ArrowRight,
  HelpCircle
} from "lucide-react";

interface Batch {
  id: string;
  name: string;
}

export default function NewExamForm({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    batchId: batches[0]?.id || "",
    startTime: "",
    endTime: "",
    duration: 60,
    allowRunCode: true,
    shuffleOptions: true,
    answerReveal: "AFTER_RELEASE" as "NEVER" | "AFTER_EXAM_END" | "AFTER_RELEASE" | "IMMEDIATELY",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate times
    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError("Please specify valid start and end times.");
      setLoading(false);
      return;
    }

    if (start >= end) {
      setError("Start Time must be before End Time.");
      setLoading(false);
      return;
    }

    if (formData.duration <= 0) {
      setError("Duration must be a positive number of minutes.");
      setLoading(false);
      return;
    }

    // The exam window closes at End Time, so a longer duration would never be usable.
    if (formData.duration * 60_000 > end.getTime() - start.getTime()) {
      setError("Duration cannot be longer than the time between Start Time and End Time.");
      setLoading(false);
      return;
    }

    try {
      const exam = await createExam({
        ...formData,
        startTime: start,
        endTime: end,
        duration: parseInt(formData.duration.toString()),
      });
      router.push(`/teacher/exams/${exam.id}`);
      router.refresh();
    } catch (err) {
      console.error("Failed to create exam:", err);
      setError("Failed to create the exam. Please check all fields and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to get batch name for live preview
  const selectedBatchName = batches.find(b => b.id === formData.batchId)?.name || "Selected Batch";

  // Helper to format date for live preview
  const formatPreviewDate = (dateStr: string) => {
    if (!dateStr) return "Not scheduled";
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return "Invalid Date";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* LEFT PANE - LIVE PREVIEW & DETAILS (4 cols on large screens) */}
      <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
            Configure Exam
          </h1>
          <p className="text-gray-500 text-xs mt-1 leading-relaxed">
            Configure dates, duration, target batch, and security proctoring preferences for the assessment.
          </p>
        </div>

        {/* Live Preview Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 space-y-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent -z-10 rounded-bl-full transition-transform duration-300 group-hover:scale-110"></div>
          
          <div className="flex justify-between items-start">
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg">
              {selectedBatchName}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
              Live Preview
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-800 leading-tight truncate">
              {formData.title || "Untitled Assessment"}
            </h3>
            <p className="text-slate-400 text-xs line-clamp-2 min-h-[2rem]">
              {formData.description || "No description provided yet."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Duration</p>
                <p className="font-bold">{formData.duration} Minutes</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Questions</p>
                <p className="font-bold">0 Questions</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
              <span className="flex items-center text-slate-400 font-medium">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Starts
              </span>
              <span className="font-bold text-slate-800">{formatPreviewDate(formData.startTime)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
              <span className="flex items-center text-slate-400 font-medium">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Ends
              </span>
              <span className="font-bold text-slate-800">{formatPreviewDate(formData.endTime)}</span>
            </div>
          </div>

          {/* Feature Flags Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {formData.allowRunCode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-100">
                <Code className="w-3 h-3 mr-1" /> Code Sandbox
              </span>
            )}
            {formData.shuffleOptions && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Shuffle className="w-3 h-3 mr-1" /> Shuffle Options
              </span>
            )}
          </div>

          <button
            type="button"
            disabled
            className="w-full mt-2 py-2.5 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center cursor-not-allowed border border-slate-200/50"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            Locked Until Exam Starts
          </button>
        </div>

        {/* Info card */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-xs text-slate-500 space-y-3">
          <p className="font-black text-slate-700 uppercase tracking-widest flex items-center">
            <HelpCircle className="w-4 h-4 mr-1 text-slate-400" /> Setup Tips
          </p>
          <ul className="list-disc pl-4 space-y-1.5">
            <li>Ensure the **End Time** provides enough buffer for all students to use their full duration limit.</li>
            <li>Enable the **Code Sandbox** if you are planning to add code execution questions (Judge0 integration).</li>
            <li>Turning on **Shuffle Options** randomizes multiple-choice options for every student, reducing cheating risks.</li>
          </ul>
        </div>
      </div>

      {/* RIGHT PANE - FORM CONTROLS (8 cols on large screens) */}
      <form onSubmit={handleSubmit} className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-8 space-y-8">
        
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl flex items-start space-x-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-50">
            1. Basic Information
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Exam Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Mid-Term Programming Fundamentals"
                className="w-full px-5 py-3.5 bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-800 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Description / Instructions
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Provide directions, rules, or references for the students. Supports plaintext."
                className="w-full px-5 py-3.5 bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-800 placeholder-slate-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Allocation & Timing */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-50">
            2. Allocation & Timing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Target Batch <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.batchId}
                onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                className="w-full px-5 py-3.5 bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-800"
              >
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Duration (Minutes) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  className="w-full pl-12 pr-5 py-3.5 bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-800"
                />
                <Clock className="w-4 h-4 text-slate-400 absolute left-4.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Start Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full pl-12 pr-5 py-3.5 bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-800"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-4.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full pl-12 pr-5 py-3.5 bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-800"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-4.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Assessment Options & Sandbox */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-50">
            3. Environment & Security settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Allow Run Code Card Toggle */}
            <label 
              htmlFor="allowRunCode" 
              className={`flex items-start p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                formData.allowRunCode 
                  ? "bg-teal-50/30 border-teal-200 hover:border-teal-300" 
                  : "bg-white border-slate-100 hover:bg-slate-50/50 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center h-5 mr-4 mt-0.5">
                <input
                  type="checkbox"
                  id="allowRunCode"
                  checked={formData.allowRunCode}
                  onChange={(e) => setFormData({ ...formData, allowRunCode: e.target.checked })}
                  className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 flex items-center">
                  <Code className="w-4 h-4 mr-1 text-teal-600" />
                  Enable Code Sandbox
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Allows students to run and test code snippets inside the browser during active programming tests.
                </p>
              </div>
            </label>

            {/* Shuffle Options Card Toggle */}
            <label 
              htmlFor="shuffleOptions" 
              className={`flex items-start p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                formData.shuffleOptions 
                  ? "bg-indigo-50/30 border-indigo-200 hover:border-indigo-300" 
                  : "bg-white border-slate-100 hover:bg-slate-50/50 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center h-5 mr-4 mt-0.5">
                <input
                  type="checkbox"
                  id="shuffleOptions"
                  checked={formData.shuffleOptions}
                  onChange={(e) => setFormData({ ...formData, shuffleOptions: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 flex items-center">
                  <Shuffle className="w-4 h-4 mr-1 text-indigo-600" />
                  Shuffle MCQ Options
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Randomizes the choices order (A, B, C, D) for each student individually to deter local copying.
                </p>
              </div>
            </label>
          </div>

          <div className="mt-4 p-5 bg-slate-50/50 rounded-2xl border border-slate-200/80 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Answer Reveal & Score Visibility Policy
            </label>
            <select
              value={formData.answerReveal}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  answerReveal: e.target.value as "NEVER" | "AFTER_EXAM_END" | "AFTER_RELEASE" | "IMMEDIATELY",
                })
              }
              className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-800 text-xs"
            >
              <option value="AFTER_RELEASE">After Teacher Releases Results (Recommended for strict exams)</option>
              <option value="AFTER_EXAM_END">After Exam Window Ends (Automatic when schedule finishes)</option>
              <option value="IMMEDIATELY">Immediately on Student Submission (Practice tests only)</option>
              <option value="NEVER">Never Reveal Correct Answers (Strict certification)</option>
            </select>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong>After Teacher Releases:</strong> Scores and explanations remain private until you click &quot;Release Results&quot; on the dashboard.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-8">
          <button
            type="button"
            onClick={() => router.push("/teacher/exams")}
            className="px-6 py-3 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 active:scale-[0.98] flex items-center disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Exam...
              </>
            ) : (
              <>
                Create & Add Questions
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
