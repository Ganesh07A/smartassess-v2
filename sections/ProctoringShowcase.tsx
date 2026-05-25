"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldAlert, CheckCircle, AlertTriangle, Play } from "lucide-react";

export default function ProctoringShowcase() {
  const [tabSwitches, setTabSwitches] = useState(0);
  const [status, setStatus] = useState<"ACTIVE" | "WARNING" | "SUBMITTED">("ACTIVE");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const simulateTabSwitch = () => {
    if (status === "SUBMITTED") return;

    setTabSwitches((prev) => {
      const nextCount = prev + 1;
      if (nextCount >= 3) {
        setStatus("SUBMITTED");
        setToastMessage("CRITICAL: Tab switch limit exceeded. Exam automatically force-submitted.");
        return 3;
      } else {
        setStatus("WARNING");
        setToastMessage(`Warning: Tab switch or focus loss detected. Remaining attempts: ${3 - nextCount}`);
        return nextCount;
      }
    });

    // Auto-clear toast after 4s
    setTimeout(() => {
      setToastMessage((current) => {
        if (current && !current.includes("CRITICAL")) {
          return null;
        }
        return current;
      });
    }, 4000);
  };

  const resetSimulation = () => {
    setTabSwitches(0);
    setStatus("ACTIVE");
    setToastMessage(null);
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-gray-150 rounded-3xl p-6 shadow-xl w-full max-w-md mx-auto space-y-6 text-gray-900 relative overflow-hidden">
      
      {/* Toast Notification Simulation Area */}
      <div className="absolute top-2 left-0 right-0 px-4 z-50 pointer-events-none">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3 rounded-xl shadow-lg border text-xs font-bold pointer-events-auto flex items-center space-x-2 ${
                status === "SUBMITTED"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              {status === "SUBMITTED" ? (
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Header controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h4 className="text-sm font-black text-slate-800">Secure Proctoring Simulator</h4>
          <p className="text-[10px] text-slate-400 font-semibold">Interactive anti-cheat demo</p>
        </div>
        <div className="flex space-x-2">
          {status !== "SUBMITTED" ? (
            <button
              onClick={simulateTabSwitch}
              className="flex items-center px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 mr-1" />
              Trigger Tab Switch
            </button>
          ) : (
            <button
              onClick={resetSimulation}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Reset Demo
            </button>
          )}
        </div>
      </div>

      {/* Mock Exam Dashboard Status Card */}
      <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
        
        {/* Exam Title Block */}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs font-black text-slate-700">Data Structures Final</div>
            <div className="text-[9px] text-slate-400 font-medium">Batch: SY AIML B</div>
          </div>
          
          {/* Main Status Badge */}
          {status === "ACTIVE" && (
            <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 text-[10px] font-black rounded-lg flex items-center">
              <Shield className="w-3.5 h-3.5 mr-1" /> Secure
            </span>
          )}
          {status === "WARNING" && (
            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black rounded-lg flex items-center">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Warning
            </span>
          )}
          {status === "SUBMITTED" && (
            <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-100 text-[10px] font-black rounded-lg flex items-center">
              <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Terminated
            </span>
          )}
        </div>

        {/* Proctoring Rules Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tab Switches</div>
            <div className={`text-xl font-black mt-1 ${
              tabSwitches === 0 ? "text-slate-800" : tabSwitches === 1 ? "text-amber-500" : tabSwitches === 2 ? "text-orange-500" : "text-red-600"
            }`}>
              {tabSwitches} / 3
            </div>
            <div className="text-[8px] text-slate-400 font-medium mt-1">3 switch limit</div>
          </div>

          <div className="bg-white border rounded-xl p-3 text-center">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fullscreen Lock</div>
            <div className="text-sm font-black text-slate-800 mt-1 flex items-center justify-center">
              {status !== "SUBMITTED" ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-1" /> Enforced
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-red-500 mr-1" /> Bypassed
                </>
              )}
            </div>
            <div className="text-[8px] text-slate-400 font-medium mt-1">Auto-blur triggers</div>
          </div>

        </div>

        {/* Dynamic Warning Message */}
        <div className={`p-3 rounded-xl border text-center text-xs font-semibold ${
          status === "ACTIVE"
            ? "bg-slate-100 border-slate-200 text-slate-600"
            : status === "WARNING"
            ? "bg-amber-50 border-amber-200 text-amber-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {status === "ACTIVE" && "Exam interface is secured. Click the button above to simulate tab change."}
          {status === "WARNING" && `Warning state active. ${3 - tabSwitches} attempts left before auto-submit.`}
          {status === "SUBMITTED" && "This exam session was automatically submitted and terminated."}
        </div>

      </div>

    </div>
  );
}
