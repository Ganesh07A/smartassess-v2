"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  User as UserIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  Maximize,
  AlertTriangle,
  Send
} from "lucide-react";
import { saveSubmission, submitExam, logTabSwitch } from "@/app/actions/exam";
import { runCode } from "@/app/actions/judge0";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";

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
  const [isBlurred, setIsBlurred] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    status?: { id: number; description: string };
    message?: string;
    stdout?: string;
    stderr?: string;
    compile_output?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = questions[currentIdx];

  const handleFinishExam = useCallback(async () => {
    if (confirm("Are you sure you want to finish the exam? All your answers will be evaluated and submitted.")) {
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
        alert("Failed to submit exam. Please check your connection.");
        setIsSubmitting(false);
      }
    }
  }, [session.id, exam.id, router]);

  const handleIdxChange = useCallback((newIdx: number) => {
    setCurrentIdx(newIdx);
    setExecutionResult(null);
  }, []);

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
      saveSubmission(session.id, questionId, {
        mcqAnswer: mcqAnswer ?? undefined,
        codeAnswer: codeAnswer ?? undefined,
        language: language ?? undefined,
      }).catch(err => {
        console.error("Failed to save answer:", err);
      });

      return { ...prev, [questionId]: fullAnswer };
    });
  }, [session.id, questions, selectedLanguage]);

  const handleRunCode = async () => {
    const code = submissions[currentQuestion.id]?.codeAnswer;
    if (!code) return;

    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const result = await runCode(code, selectedLanguage);
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

  // Anti-Cheat: Visibility Change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        setIsBlurred(true);
        try {
          await logTabSwitch(session.id);
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
          await logTabSwitch(session.id);
        } catch (err) {
          console.error("Failed to log full-screen exit:", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, [session.id]);

  const handleEnterFullScreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
      setIsBlurred(false);
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
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[150] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Evaluating Your Exam</h2>
        <p className="text-gray-600 max-w-md">
          Please wait while we run your code against test cases and calculate your final score. This may take a moment.
        </p>
      </div>
    );
  }

  if (!isFullScreen || isBlurred) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-6" />
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Security Protocol Active</h2>
        <p className="text-gray-600 max-w-md mb-8">
          This exam must be taken in full-screen mode. Your screen has been blurred to protect exam integrity. 
          All tab switches are being logged.
        </p>
        <button 
          onClick={handleEnterFullScreen}
          className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center"
        >
          <Maximize className="w-5 h-5 mr-2" />
          Enter Secure Mode
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 select-none overflow-hidden">
      {/* Header - Fixed Height */}
      <header className="h-20 bg-white border-b px-12 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center space-x-10">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border shadow-inner">
              <UserIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800 leading-tight">{student.name}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">PRN: {student.prn || "NOT ASSIGNED"}</div>
            </div>
          </div>
          <div className="h-10 w-px bg-gray-200"></div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-0.5">Examination</div>
            <div className="text-base font-bold text-blue-600 leading-tight">{exam.title}</div>
          </div>
        </div>

        <div className="flex items-center space-x-8">
          <div className={`flex flex-col items-center px-6 py-1.5 rounded-xl border-2 ${timeLeft < 300 ? 'border-red-500 bg-red-50 text-red-600 animate-pulse' : 'border-blue-100 bg-blue-50 text-blue-600'}`}>
            <div className="text-[8px] font-bold uppercase tracking-widest opacity-70">Time Remaining</div>
            <div className="text-xl font-mono font-bold flex items-center">
              <Clock className="w-4 h-4 mr-1.5" />
              {formatTime(timeLeft)}
            </div>
          </div>
          <button 
            onClick={handleFinishExam}
            className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all flex items-center text-sm"
          >
            <Send className="w-4 h-4 mr-2" />
            Finish Exam
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6">
          {/* Question Header */}
          <div className="mb-4 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              Question {currentIdx + 1} of {questions.length}
            </span>
            <span className="text-[10px] font-bold px-3 py-1 bg-gray-100 text-gray-600 rounded-full border">
              {currentQuestion.points} Points
            </span>
          </div>

          {/* Question Content Area */}
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {currentQuestion.type === "MCQ" ? (
              <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6 pr-2">
                <div className="bg-white rounded-3xl shadow-sm border p-8">
                  <p className="text-xl text-gray-800 font-semibold leading-relaxed">
                    {currentQuestion.content}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(currentQuestion.options || {}).map(([key, value]) => {
                    const isSelected = submissions[currentQuestion.id]?.mcqAnswer === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSaveAnswer(currentQuestion.id, { mcqAnswer: key })}
                        className={`group flex items-center p-5 rounded-2xl border-2 transition-all text-left ${
                          isSelected 
                            ? "border-blue-600 bg-blue-50 text-blue-700 shadow-md shadow-blue-100" 
                            : "border-gray-100 hover:border-blue-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold mr-4 transition-colors text-sm ${
                          isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500"
                        }`}>
                          {key}
                        </div>
                        <span className="text-base font-medium">{value as string}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                {/* Question Text (Scrollable if long) */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 overflow-y-auto scrollbar-hide max-h-[25%] flex-shrink-0">
                  <p className="text-lg text-gray-800 font-semibold leading-relaxed">
                    {currentQuestion.content}
                  </p>
                </div>

                {/* Editor Section */}
                <div className="flex-1 flex flex-col bg-gray-900 rounded-2xl overflow-hidden border-4 border-gray-800 shadow-2xl min-h-0">
                  {/* Editor Top Bar */}
                  <div className="bg-gray-800 px-6 py-2 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center space-x-4">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code Editor</span>
                      <select 
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="bg-gray-700 text-gray-200 text-[10px] font-bold px-3 py-1 rounded border-none outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="python">Python 3</option>
                        <option value="c">C (GCC)</option>
                        <option value="cpp">C++ (G++)</option>
                        <option value="java">Java 17</option>
                        <option value="javascript">Node.js</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-3">
                      {exam.allowRunCode && (
                        <button 
                          onClick={handleRunCode}
                          disabled={isExecuting}
                          className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-4 py-1 rounded-full font-bold transition-colors disabled:opacity-50"
                        >
                          {isExecuting ? "Running..." : "Run Code"}
                        </button>
                      )}
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase font-bold">Ready</span>
                    </div>
                  </div>

                  {/* Monaco Editor */}
                  <div className="flex-1 min-h-0">
                    <Editor
                      height="100%"
                      language={selectedLanguage === 'javascript' ? 'javascript' : selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage === 'c' ? 'c' : selectedLanguage}
                      theme="vs-dark"
                      value={submissions[currentQuestion.id]?.codeAnswer || ""}
                      onChange={(value) => handleSaveAnswer(currentQuestion.id, { codeAnswer: value || "" })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                      }}
                    />
                  </div>
                  
                  {/* Execution Output Window */}
                  <div className="bg-black/50 border-t border-gray-800 p-4 h-[180px] overflow-y-auto scrollbar-hide font-mono text-xs flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Execution Output</span>
                      {executionResult && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                          executionResult.status?.id === 3 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {executionResult.status?.description}
                        </span>
                      )}
                    </div>
                    
                    {isExecuting ? (
                      <div className="text-gray-500 animate-pulse">Running code against Judge0...</div>
                    ) : executionResult ? (
                      <div className="space-y-3">
                        {executionResult.stdout && (
                          <div className="space-y-1">
                            <div className="text-[9px] text-gray-600 font-bold uppercase">stdout</div>
                            <pre className="text-gray-300 whitespace-pre-wrap">{executionResult.stdout}</pre>
                          </div>
                        )}
                        {executionResult.stderr && (
                          <div className="space-y-1">
                            <div className="text-[9px] text-red-900 font-bold uppercase">stderr</div>
                            <pre className="text-red-400 whitespace-pre-wrap">{executionResult.stderr}</pre>
                          </div>
                        )}
                        {executionResult.compile_output && (
                          <div className="space-y-1">
                            <div className="text-[9px] text-yellow-900 font-bold uppercase">Compilation Error</div>
                            <pre className="text-yellow-400 whitespace-pre-wrap">{executionResult.compile_output}</pre>
                          </div>
                        )}
                        {executionResult.message && (
                          <div className="text-red-400 text-xs italic">{executionResult.message}</div>
                        )}
                        {!executionResult.stdout && !executionResult.stderr && !executionResult.compile_output && !executionResult.message && (
                          <div className="text-gray-600 italic">No output produced.</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-600 italic">Click &quot;Run Code&quot; to see results.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls - Fixed Height */}
          <div className="mt-6 flex justify-between items-center flex-shrink-0">
            <button
              disabled={currentIdx === 0}
              onClick={() => handleIdxChange(currentIdx - 1)}
              className="flex items-center px-6 py-2.5 bg-white border-2 border-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm text-sm"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={() => handleSaveAnswer(currentQuestion.id, { mcqAnswer: undefined, codeAnswer: undefined })}
                className="px-6 py-2.5 text-gray-400 hover:text-red-500 font-bold transition-colors text-sm"
              >
                Clear Selection
              </button>
              {currentIdx < questions.length - 1 ? (
                <button
                  onClick={() => handleIdxChange(currentIdx + 1)}
                  className="flex items-center px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all text-sm"
                >
                  Next Question
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  onClick={handleFinishExam}
                  className="flex items-center px-8 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all text-sm"
                >
                  Finish Exam
                  <CheckCircle className="w-4 h-4 ml-2" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Sidebar - Fixed Width */}
        <aside className="w-80 bg-white border-l flex flex-col shadow-inner flex-shrink-0 overflow-hidden">
          <div className="p-6 border-b flex-shrink-0">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-6 flex items-center justify-between">
              Question Palette
              <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{questions.length} Total</span>
            </h3>
            <div className="grid grid-cols-4 gap-2.5 max-h-[400px] overflow-y-auto scrollbar-hide pr-1">
              {questions.map((q, i) => {
                const isAnswered = submissions[q.id]?.mcqAnswer || submissions[q.id]?.codeAnswer;
                const isCurrent = currentIdx === i;
                return (
                  <button
                    key={q.id}
                    onClick={() => handleIdxChange(i)}
                    className={`w-11 h-11 rounded-xl text-xs font-bold transition-all border-2 flex items-center justify-center ${
                      isCurrent 
                        ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-100" 
                        : isAnswered 
                          ? "border-green-500 bg-green-50 text-green-600" 
                          : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="flex-1 p-6 space-y-4 overflow-y-auto scrollbar-hide">
            <div className="p-4 bg-gray-50 rounded-2xl border">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center text-[10px] font-medium text-gray-600">
                  <div className="w-2.5 h-2.5 rounded bg-blue-600 mr-2"></div> Current
                </div>
                <div className="flex items-center text-[10px] font-medium text-gray-600">
                  <div className="w-2.5 h-2.5 rounded bg-green-500 mr-2"></div> Answered
                </div>
                <div className="flex items-center text-[10px] font-medium text-gray-600">
                  <div className="w-2.5 h-2.5 rounded bg-gray-200 mr-2"></div> Not Visited
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
