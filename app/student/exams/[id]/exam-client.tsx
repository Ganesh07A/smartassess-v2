"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  Maximize,
  AlertTriangle,
  Send,
  Layers
} from "lucide-react";
import { saveSubmission, submitExam, logTabSwitch, updateBlurState } from "@/app/actions/exam";
import { runCode } from "@/app/actions/judge0";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";

interface Question {
  id: string;
  type: "MCQ" | "CODING";
  content: string;
  options?: Record<string, string> | null;
  testCases?: { input: string; output: string }[] | null;
  points: number;
}

interface Exam {
  id: string;
  title: string;
  endTime: Date | string;
  duration: number;
  allowRunCode: boolean;
}

interface ExamSession {
  id: string;
  startTime: Date | string | null;
  optionsMapping?: Record<string, string[]> | null;
  isBlurred?: boolean;
  tabSwitches?: number;
}

interface Submission {
  questionId: string;
  mcqAnswer?: string | null;
  codeAnswer?: string | null;
  language?: string | null;
}

interface Student {
  name?: string | null;
  prn?: string | null;
  image?: string | null;
}

interface ExamClientProps {
  exam: Exam;
  session: ExamSession;
  questions: Question[];
  initialSubmissions: Submission[];
  student: Student;
}

export default function ExamClient({ 
  exam, 
  session, 
  questions, 
  initialSubmissions,
  student 
}: ExamClientProps) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [submissions, setSubmissions] = useState<Record<string, Submission>>(() => {
    const map: Record<string, Submission> = {};
    initialSubmissions.forEach(s => {
      map[s.questionId] = { questionId: s.questionId, mcqAnswer: s.mcqAnswer, codeAnswer: s.codeAnswer, language: s.language };
    });
    return map;
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(session.isBlurred ?? false);
  const [tabSwitches, setTabSwitches] = useState(session.tabSwitches ?? 0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const activeSavesRef = useRef(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    status?: { id: number; description: string };
    message?: string;
    stdout?: string;
    stderr?: string;
    compile_output?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  // Monaco Editor Local State & Custom Stdin
  const [editorCode, setEditorCode] = useState(() => {
    const q0 = questions[0];
    if (q0 && q0.type === "CODING") {
      const initialSub = initialSubmissions.find(s => s.questionId === q0.id);
      return initialSub?.codeAnswer || "";
    }
    return "";
  });
  const [customInput, setCustomInput] = useState(() => {
    const q0 = questions[0];
    if (q0 && q0.type === "CODING") {
      return q0.testCases?.[0]?.input || "";
    }
    return "";
  });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = questions[currentIdx];

  // Helper to save code answer to database
  const saveCodeToDb = useCallback((qId: string, code: string, lang: string) => {
    setSaveState("saving");
    activeSavesRef.current += 1;
    saveSubmission(session.id, qId, {
      codeAnswer: code,
      language: lang,
    })
    .then(() => {
      activeSavesRef.current -= 1;
      if (activeSavesRef.current === 0) {
        setSaveState("saved");
      }
    })
    .catch(err => {
      activeSavesRef.current -= 1;
      setSaveState("error");
      console.error("Failed to save code:", err);
    });
  }, [session.id]);

  // Flush any pending unsaved code updates immediately
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      saveCodeToDb(currentQuestion.id, editorCode, selectedLanguage);
    }
  }, [currentQuestion.id, editorCode, selectedLanguage, saveCodeToDb]);

  const handleFinishExam = useCallback(async () => {
    if (confirm("Are you sure you want to finish the exam? All your answers will be evaluated and submitted.")) {
      flushSave();
      setIsSubmitting(true);
      try {
        await submitExam(session.id);
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        router.push(`/student/exams/${exam.id}/result`);
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("Failed to submit exam. Please check your connection.");
        setIsSubmitting(false);
      }
    }
  }, [session.id, exam.id, router, flushSave]);

  const handleIdxChange = useCallback((newIdx: number) => {
    flushSave();
    setCurrentIdx(newIdx);
    setExecutionResult(null);

    const newQuestion = questions[newIdx];
    if (newQuestion) {
      if (newQuestion.type === "CODING") {
        setEditorCode(submissions[newQuestion.id]?.codeAnswer || "");
        setCustomInput(newQuestion.testCases?.[0]?.input || "");
      } else {
        setEditorCode("");
        setCustomInput("");
      }
    }
  }, [flushSave, questions, submissions]);

  const handleSaveAnswer = useCallback(async (questionId: string, answer: Partial<Submission>) => {
    setSubmissions(prev => {
      const fullAnswer: Submission = {
        ...prev[questionId],
        questionId,
        ...answer,
        language: questions.find(q => q.id === questionId)?.type === "CODING" ? selectedLanguage : undefined
      };
      
      // Call async save in the background
      const { mcqAnswer, codeAnswer, language } = fullAnswer;
      setSaveState("saving");
      activeSavesRef.current += 1;
      saveSubmission(session.id, questionId, {
        mcqAnswer: mcqAnswer ?? undefined,
        codeAnswer: codeAnswer ?? undefined,
        language: language ?? undefined,
      })
      .then(() => {
        activeSavesRef.current -= 1;
        if (activeSavesRef.current === 0) {
          setSaveState("saved");
        }
      })
      .catch(err => {
        activeSavesRef.current -= 1;
        setSaveState("error");
        console.error("Failed to save answer:", err);
      });

      return { ...prev, [questionId]: fullAnswer };
    });
  }, [session.id, questions, selectedLanguage]);

  // Handle live changes in the editor
  const handleEditorChange = (value: string | undefined) => {
    const newVal = value || "";
    setEditorCode(newVal);

    // Keep state in sync locally
    setSubmissions(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        questionId: currentQuestion.id,
        codeAnswer: newVal,
        language: selectedLanguage
      }
    }));

    // Debounce save submission to prevent overloading server/db
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveCodeToDb(currentQuestion.id, newVal, selectedLanguage);
    }, 1500);
  };

  const handleRunCode = async () => {
    if (!editorCode.trim()) {
      toast.warning("Please write some code first before running.");
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const result = await runCode(editorCode, selectedLanguage, customInput);
      setExecutionResult(result);
    } catch (err) {
      setExecutionResult({
        status: { id: 0, description: "Error" },
        message: err instanceof Error ? err.message : "Unknown error"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Synchronized via handleIdxChange on transitions and initial state load

  // Initialize Timer
  useEffect(() => {
    const examEndTime = new Date(exam.endTime).getTime();
    const sessionEndTime = new Date(new Date(session.startTime as string | Date).getTime() + exam.duration * 60 * 1000).getTime();
    const actualEndTime = Math.min(examEndTime, sessionEndTime);
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((actualEndTime - now) / 1000));
      setTimeLeft(diff);
      
      if (diff === 0) {
        handleFinishExam();
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [exam.endTime, exam.duration, session.startTime, handleFinishExam]);

  // Anti-Cheat: Visibility Change & Clipboard Blocking
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        setIsBlurred(true);
        try {
          const res = await logTabSwitch(session.id);
          if (res) {
            setTabSwitches(res.tabSwitches);
            if (res.status === "FORCE_SUBMITTED") {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              }
              router.push(`/student/exams/${exam.id}/result`);
              router.refresh();
            }
          }
        } catch (err) {
          console.error("Failed to log tab switch:", err);
        }
      }
    };

    const handleFullScreenChange = async () => {
      const isCurrentlyFull = !!document.fullscreenElement;
      setIsFullScreen(isCurrentlyFull);
      if (!isCurrentlyFull) {
        setIsBlurred(true);
        try {
          const res = await logTabSwitch(session.id);
          if (res) {
            setTabSwitches(res.tabSwitches);
            if (res.status === "FORCE_SUBMITTED") {
              router.push(`/student/exams/${exam.id}/result`);
              router.refresh();
            }
          }
        } catch (err) {
          console.error("Failed to log full-screen exit:", err);
        }
      }
    };

    const preventClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to exit the exam? Your progress will be saved but this is highly discouraged.";
      return e.returnValue;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        toast.error("Developer tools are disabled during the exam.");
        return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C" || e.key === "i" || e.key === "j" || e.key === "c")) {
        e.preventDefault();
        toast.error("Developer tools are disabled during the exam.");
        return;
      }
      if (e.ctrlKey && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        toast.error("Viewing source is disabled during the exam.");
        return;
      }
      if (e.ctrlKey && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey && (e.key === "R" || e.key === "r")) || e.key === "F5") {
        e.preventDefault();
        toast.error("Refreshing the page is disabled. Please navigate using the exam interface.");
        return;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("copy", preventClipboard);
    document.addEventListener("paste", preventClipboard);
    document.addEventListener("cut", preventClipboard);
    document.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener("copy", preventClipboard);
      document.removeEventListener("paste", preventClipboard);
      document.removeEventListener("cut", preventClipboard);
      document.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [session.id, exam.id, router]);

  const handleEnterFullScreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
        .then(() => {
          setIsBlurred(false);
          setIsFullScreen(true);
          return updateBlurState(session.id, false);
        })
        .catch(err => {
          console.error("Failed to enter fullscreen:", err);
        });
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[150] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Evaluating Your Submissions</h2>
        <p className="text-slate-500 text-sm max-w-md font-medium leading-relaxed">
          Please wait while we evaluate your code solutions and record your answers. This will only take a moment.
        </p>
      </div>
    );
  }

  const showSecurityOverlay = !isFullScreen || isBlurred;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-slate-50 font-sans select-none no-scrollbar">
      
      {/* Scrollbar-hide global style tag */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}} />

      {/* Main Exam View Container (Blurred if security protocol violated) */}
      <div className={`h-full w-full flex flex-col transition-all duration-300 no-scrollbar ${
        showSecurityOverlay ? "filter blur-md pointer-events-none select-none" : ""
      }`}>
        
        {/* Header Block */}
        <header className="h-20 bg-white border-b border-slate-100 px-6 md:px-12 flex justify-between items-center shadow-sm flex-shrink-0 z-10">
          
          {/* Top Left: Exam Details */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 rounded-2xl border border-indigo-100/50">
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-black text-slate-800 tracking-tight leading-tight truncate max-w-[200px] md:max-w-xs">
                {exam.title}
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                Assessment Session
              </p>
            </div>
          </div>

          {/* Top Center: Timer & Sync Status */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center px-4 py-1.5 rounded-xl border-2 font-mono font-bold text-sm ${
              timeLeft < 300 
                ? 'border-red-500 bg-red-50 text-red-650 animate-pulse' 
                : 'border-indigo-100 bg-indigo-50/50 text-indigo-750'
            }`}>
              <Clock className="w-4 h-4 mr-1.5 shrink-0" />
              {formatTime(timeLeft)}
            </div>

            {/* Sync status indicator */}
            <div className={`flex items-center px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
              saveState === "saved" 
                ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                : saveState === "saving" 
                  ? "bg-amber-50 border-amber-100 text-amber-700 animate-pulse" 
                  : "bg-rose-50 border-rose-100 text-rose-700 animate-bounce"
            }`}>
              <div className={`w-2 h-2 rounded-full mr-1.5 ${
                saveState === "saved" ? "bg-emerald-500" : saveState === "saving" ? "bg-amber-500" : "bg-rose-500"
              }`} />
              {saveState === "saved" ? "Saved to cloud" : saveState === "saving" ? "Saving..." : "Offline - Error"}
            </div>
          </div>

          {/* Top Right: User Photo + Name / PRN + Finish Button */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 text-right">
              <div className="hidden sm:block">
                <div className="text-xs font-black text-slate-800 leading-none">{student.name}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">PRN: {student.prn || "NOT ASSIGNED"}</div>
              </div>
              {student.image ? (
                <img 
                  src={student.image} 
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200/80 shadow-inner shrink-0" 
                  alt="Student Profile" 
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-black flex items-center justify-center shadow-sm border border-indigo-200 shrink-0">
                  {student.name ? student.name[0].toUpperCase() : "S"}
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-slate-100"></div>

            <button 
              onClick={handleFinishExam}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-750 text-white font-bold rounded-xl shadow-lg shadow-green-500/10 hover:shadow-green-500/20 active:scale-[0.98] transition-all flex items-center text-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              Finish Exam
            </button>
          </div>

        </header>

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden relative no-scrollbar">
          
          {/* Mobile Palette Toggle */}
          <button 
            onClick={() => setShowPalette(!showPalette)}
            className="lg:hidden absolute bottom-6 right-6 z-[60] w-12 h-12 bg-white border-2 border-indigo-600 text-indigo-600 rounded-full shadow-2xl flex items-center justify-center"
          >
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
              <div className="w-1.5 h-1.5 bg-current rounded-sm"></div>
            </div>
          </button>

          {/* Left Panel: Question Canvas */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6 no-scrollbar">
            
            {/* Question Header */}
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className="text-[10px] font-black px-3 py-1 bg-indigo-50 border border-indigo-100/60 text-indigo-700 rounded-full">
                {currentQuestion.points} Points
              </span>
            </div>

            {/* Question Content Area */}
            <div className="flex-1 flex flex-col min-h-0 space-y-4 no-scrollbar">
              {currentQuestion.type === "MCQ" ? (
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1">
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-8">
                    <p className="text-lg text-slate-800 font-bold leading-relaxed whitespace-pre-wrap">
                      {currentQuestion.content}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {(() => {
                      const shuffledKeys = session.optionsMapping?.[currentQuestion.id] || Object.keys(currentQuestion.options || {});
                      const displayLabels = ["A", "B", "C", "D"];
                      
                      return shuffledKeys.map((originalKey, idx) => {
                        const value = currentQuestion.options?.[originalKey];
                        const isSelected = submissions[currentQuestion.id]?.mcqAnswer === originalKey;
                        const label = displayLabels[idx] || originalKey;
                        
                        return (
                          <button
                            key={originalKey}
                            onClick={() => handleSaveAnswer(currentQuestion.id, { mcqAnswer: originalKey })}
                            className={`group flex items-center p-5 rounded-2xl border-2 transition-all text-left ${
                              isSelected 
                                ? "border-indigo-500 bg-indigo-50/50 text-indigo-750 shadow-md shadow-indigo-100/50" 
                                : "border-slate-100 hover:border-slate-200 bg-white text-slate-650 hover:bg-slate-50/20"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black mr-4 transition-colors text-sm shrink-0 ${
                              isSelected 
                                ? "bg-indigo-600 text-white" 
                                : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                            }`}>
                              {label}
                            </div>
                            <span className="text-sm font-black text-slate-900 leading-relaxed">{value as string}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 space-y-4 no-scrollbar">
                  
                  {/* Code Question Prompt & Test Cases */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 overflow-y-auto no-scrollbar max-h-[35%] flex-shrink-0">
                    <p className="text-base text-slate-800 font-bold leading-relaxed whitespace-pre-wrap">
                      {currentQuestion.content}
                    </p>

                    {/* Test Cases Panel */}
                    {currentQuestion.testCases && currentQuestion.testCases.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sample Test Cases</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentQuestion.testCases.map((tc, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-mono space-y-1">
                              <div>
                                <span className="text-slate-400 font-bold">Input:</span> <span className="text-slate-700 font-semibold">{tc.input}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold">Expected Output:</span> <span className="text-slate-700 font-semibold">{tc.output}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Monaco Editor Container */}
                  <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-850 shadow-2xl min-h-0">
                    
                    {/* Editor Controller Top Bar */}
                    <div className="bg-slate-800 px-6 py-2.5 flex items-center justify-between flex-shrink-0 border-b border-slate-900">
                      <div className="flex items-center space-x-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Code Canvas</span>
                        <select 
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="python" className="bg-slate-800 text-white">Python 3</option>
                          <option value="c" className="bg-slate-800 text-white">C (GCC)</option>
                          <option value="cpp" className="bg-slate-800 text-white">C++ (G++)</option>
                          <option value="java" className="bg-slate-800 text-white">Java 17</option>
                          <option value="javascript" className="bg-slate-800 text-white">Node.js</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-3">
                        {exam.allowRunCode && (
                          <button 
                            onClick={handleRunCode}
                            disabled={isExecuting}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-full font-bold transition-all disabled:opacity-50 active:scale-[0.98] shadow-md shadow-indigo-600/10"
                          >
                            {isExecuting ? "Executing..." : "Run Code"}
                          </button>
                        )}
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">Ready</span>
                      </div>
                    </div>

                    {/* Monaco Editor Element */}
                    <div className="flex-1 min-h-0">
                      <Editor
                        height="100%"
                        language={selectedLanguage === 'javascript' ? 'javascript' : selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage === 'c' ? 'c' : selectedLanguage}
                        theme="vs-dark"
                        value={editorCode}
                        onChange={handleEditorChange}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          automaticLayout: true,
                          scrollBeyondLastLine: false,
                          padding: { top: 16, bottom: 16 },
                        }}
                      />
                    </div>
                    
                    {/* Judge0 Console Output */}
                    <div className="bg-slate-950 border-t border-slate-800 p-4 h-[190px] overflow-y-auto no-scrollbar font-mono text-xs flex-shrink-0">
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 border-b border-slate-900 pb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Execution Output</span>
                        
                        {/* Custom Stdin Input Field */}
                        <div className="flex items-center space-x-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase shrink-0">Stdin Input:</label>
                          <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="Stdin value..."
                            className="bg-slate-850 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-[10px] outline-none focus:border-indigo-500 w-32 md:w-44"
                          />
                        </div>

                        {executionResult && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                            executionResult.status?.id === 3 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-450"
                          }`}>
                            {executionResult.status?.description}
                          </span>
                        )}
                      </div>
                      
                      {isExecuting ? (
                        <div className="text-slate-500 animate-pulse">Running code against Judge0 evaluation API...</div>
                      ) : executionResult ? (
                        <div className="space-y-3">
                          {executionResult.stdout !== undefined && (
                            <div className="space-y-1">
                              <div className="text-[9px] text-slate-600 font-bold uppercase">stdout</div>
                              <pre className="text-slate-300 whitespace-pre-wrap">{executionResult.stdout || <span className="italic text-slate-600">Empty</span>}</pre>
                            </div>
                          )}
                          {executionResult.stderr && (
                            <div className="space-y-1">
                              <div className="text-[9px] text-rose-900 font-bold uppercase">stderr</div>
                              <pre className="text-rose-400 whitespace-pre-wrap">{executionResult.stderr}</pre>
                            </div>
                          )}
                          {executionResult.compile_output && (
                            <div className="space-y-1">
                              <div className="text-[9px] text-yellow-900 font-bold uppercase">Compilation Error</div>
                              <pre className="text-yellow-400 whitespace-pre-wrap">{executionResult.compile_output}</pre>
                            </div>
                          )}
                          {executionResult.message && (
                            <div className="text-rose-400 text-xs italic">{executionResult.message}</div>
                          )}
                          {!executionResult.stdout && !executionResult.stderr && !executionResult.compile_output && !executionResult.message && (
                            <div className="text-slate-650 italic">No output produced.</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-650 italic">Click &quot;Run Code&quot; to inspect standard outputs.</div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Bottom Navigation Buttons */}
            <div className="mt-6 flex justify-between items-center flex-shrink-0">
              <button
                disabled={currentIdx === 0}
                onClick={() => handleIdxChange(currentIdx - 1)}
                className="flex items-center px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-655 font-bold rounded-xl hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    if (currentQuestion.type === "CODING") {
                      handleEditorChange("");
                    } else {
                      handleSaveAnswer(currentQuestion.id, { mcqAnswer: undefined });
                    }
                  }}
                  className="px-6 py-2.5 text-slate-400 hover:text-rose-500 font-bold transition-colors text-xs"
                >
                  Clear Answer
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => handleIdxChange(currentIdx + 1)}
                    className="flex items-center px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-[0.98] transition-all text-xs"
                  >
                    Next Question
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinishExam}
                    className="flex items-center px-8 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/10 hover:shadow-green-500/20 active:scale-[0.98] transition-all text-xs"
                  >
                    Finish Exam
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Right Panel: Sidebar Question Palette */}
          <aside className={`
            fixed inset-0 z-[70] bg-white transition-transform duration-300 lg:static lg:z-0 lg:translate-x-0 lg:w-80 lg:bg-white lg:border-l lg:border-slate-100 lg:flex lg:flex-col lg:shadow-inner lg:flex-shrink-0 lg:overflow-hidden no-scrollbar
            ${showPalette ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          `}>
            
            <div className="p-6 border-b border-slate-100 flex-shrink-0 flex items-center justify-between lg:block">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 lg:mb-6 flex items-center justify-between flex-1 lg:flex-none">
                Question Palette
                <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100/50 px-2 py-0.5 rounded-full">
                  {questions.length} Items
                </span>
              </h3>
              <button onClick={() => setShowPalette(false)} className="lg:hidden p-2 text-slate-500 hover:text-slate-600">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 border-b border-slate-100 flex-shrink-0 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-5 lg:grid-cols-4 gap-2.5 max-h-[400px] lg:max-h-none pr-1">
                {questions.map((q, i) => {
                  const isAnswered = submissions[q.id]?.mcqAnswer || submissions[q.id]?.codeAnswer;
                  const isCurrent = currentIdx === i;
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        handleIdxChange(i);
                        setShowPalette(false);
                      }}
                      className={`w-11 h-11 rounded-xl text-xs font-black transition-all border-2 flex items-center justify-center ${
                        isCurrent 
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                          : isAnswered 
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="flex-1 p-6 space-y-4 overflow-y-auto no-scrollbar">
              {/* Anti-Cheat Attempts Card */}
              <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50 space-y-2">
                <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500" />
                  Security Status
                </h4>
                <div className="text-[11px] font-bold text-rose-755 text-rose-750">
                  Tab Switch Warnings: <span className="underline">{tabSwitches} / 3</span>
                </div>
                <p className="text-[9px] text-rose-500 font-medium leading-relaxed">
                  Switching tabs or exiting fullscreen 3 times will result in automatic submission. Remaining: <span className="font-extrabold">{Math.max(0, 3 - tabSwitches)}</span>
                </p>
              </div>

              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Map Legend</h4>
                <div className="space-y-2">
                  <div className="flex items-center text-[10px] font-bold text-slate-605">
                    <div className="w-2.5 h-2.5 rounded bg-indigo-600 mr-2"></div> Selected
                  </div>
                  <div className="flex items-center text-[10px] font-bold text-slate-650">
                    <div className="w-2.5 h-2.5 rounded bg-emerald-500 mr-2"></div> Answer Recorded
                  </div>
                  <div className="flex items-center text-[10px] font-bold text-slate-650">
                    <div className="w-2.5 h-2.5 rounded bg-slate-200 mr-2"></div> Not Answered
                  </div>
                </div>
              </div>
            </div>

          </aside>

        </div>

      </div>

      {/* Security Proctored Violation Modal Overlay */}
      {showSecurityOverlay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl p-8 max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle className="w-8 h-8 text-rose-500 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Security Violation</h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                You have exited secure full-screen mode or switched tabs. The exam has been blurred to protect assessment integrity. Please re-enter secure mode immediately to resume your exam.
              </p>
            </div>
            <button 
              onClick={handleEnterFullScreen}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-black rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all text-xs flex items-center justify-center"
            >
              <Maximize className="w-4.5 h-4.5 mr-2" />
              Enter Secure Mode
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
