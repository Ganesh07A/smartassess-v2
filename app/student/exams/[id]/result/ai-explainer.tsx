"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { explainCodeSubmission } from "@/app/actions/ai";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface AIExplainerProps {
  questionContent: string;
  code: string;
  pointsAwarded: number;
  totalPoints: number;
}

export default function AIExplainer({ 
  questionContent, 
  code, 
  pointsAwarded, 
  totalPoints 
}: AIExplainerProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleGetFeedback = async () => {
    if (explanation) {
      setIsOpen(!isOpen);
      return;
    }

    setIsLoading(true);
    try {
      const feedback = await explainCodeSubmission(questionContent, code, pointsAwarded, totalPoints);
      setExplanation(feedback);
      setIsOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to get AI feedback. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleGetFeedback}
        disabled={isLoading}
        className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100 shadow-sm disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 mr-2" />
        )}
        {explanation ? (isOpen ? "Hide AI Feedback" : "Show AI Feedback") : "Get AI Feedback"}
        {explanation && (isOpen ? <ChevronUp className="w-3.5 h-3.5 ml-2" /> : <ChevronDown className="w-3.5 h-3.5 ml-2" />)}
      </button>

      {isOpen && explanation && (
        <div className="mt-4 p-6 bg-blue-50/50 border border-blue-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center mb-4 text-blue-800">
            <Sparkles className="w-4 h-4 mr-2" />
            <span className="text-[10px] font-black uppercase tracking-widest">AI Tutor Insights</span>
          </div>
          <div className="prose prose-sm prose-blue max-w-none text-gray-700 font-medium leading-relaxed">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
