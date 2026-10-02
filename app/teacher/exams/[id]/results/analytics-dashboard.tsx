"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CheckCircle2,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
} from "lucide-react";
import type { ItemFlag, DistractorMetric } from "@/lib/analytics/psychometrics";
import type { TopicMetric } from "@/lib/analytics/topics";
import { ITEM_FLAG_LABELS } from "@/lib/analytics/thresholds";

export interface QuestionAnalysisRow {
  questionId: string;
  order: number;
  content: string;
  type: string;
  topic: string;
  tags?: string[];
  explanation?: string | null;
  declaredDifficulty?: string;
  successRate: number;
  facility: number;
  discrimination: number | null;
  discriminationUpperLower: number | null;
  flags: ItemFlag[];
  distractors?: DistractorMetric[];
  attempted: number;
  avgScore: number;
  difficulty: string;
  totalPoints: number;
}

interface AnalyticsDashboardProps {
  analytics: {
    totalCompleted: number;
    questionMetrics: QuestionAnalysisRow[];
    scores: number[];
    maxPossibleScore: number;
    analysis?: {
      n: number;
      alpha: number | null;
      mean: number;
      median: number;
      sd: number;
      min: number;
      max: number;
      truncated: boolean;
    };
    topicBreakdown?: TopicMetric[];
    truncated?: boolean;
  };
  examId?: string;
}

function getAlphaBadge(alpha: number | null): { label: string; color: string; desc: string } {
  if (alpha === null) {
    return {
      label: "Insufficient Data",
      color: "bg-slate-100 text-slate-600 border-slate-200",
      desc: "Requires at least 10 completed submissions.",
    };
  }
  if (alpha >= 0.8) {
    return {
      label: "Good (α ≥ 0.80)",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      desc: "Test shows strong internal consistency.",
    };
  }
  if (alpha >= 0.7) {
    return {
      label: "Acceptable (α ≥ 0.70)",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      desc: "Adequate reliability for classroom assessments.",
    };
  }
  if (alpha >= 0.6) {
    return {
      label: "Questionable (0.60–0.69)",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      desc: "Some questions may measure divergent skills.",
    };
  }
  return {
    label: "Low (α < 0.60)",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    desc: "Results may be noisy. Review flagged questions below.",
  };
}

export default function AnalyticsDashboard({
  analytics,
  examId,
}: AnalyticsDashboardProps) {
  const {
    totalCompleted,
    questionMetrics = [],
    scores = [],
    maxPossibleScore = 0,
    analysis,
    topicBreakdown = [],
    truncated = false,
  } = analytics;

  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
  const [selectedFlagFilter, setSelectedFlagFilter] = useState<string>("ALL");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const n = analysis?.n ?? totalCompleted;
  const isInsufficientN = n < 10;
  const alphaInfo = getAlphaBadge(analysis?.alpha ?? null);

  // SVG Histogram calculations
  const histogramBins = useMemo(() => {
    if (scores.length === 0 || maxPossibleScore === 0) return [];
    const binCount = 5;
    const step = maxPossibleScore / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${Math.round(i * step)}–${Math.round((i + 1) * step)}`,
      count: 0,
    }));

    for (const score of scores) {
      const idx = Math.min(Math.floor(score / (step || 1)), binCount - 1);
      if (bins[idx]) bins[idx].count++;
    }

    const maxCount = Math.max(...bins.map((b) => b.count), 1);
    return bins.map((b) => ({
      ...b,
      heightPct: (b.count / maxCount) * 100,
    }));
  }, [scores, maxPossibleScore]);

  // "Items Needing Attention" prioritization
  const flaggedItems = useMemo(() => {
    const list: {
      question: QuestionAnalysisRow;
      priority: number;
      reasonTitle: string;
      reasonDesc: string;
      badgeColor: string;
    }[] = [];

    for (const q of questionMetrics) {
      if (q.flags.includes("NEGATIVE_DISCRIMINATION")) {
        list.push({
          question: q,
          priority: 1,
          reasonTitle: "Negative Discrimination (Critical)",
          reasonDesc:
            "High-scoring students got this question wrong more often than low-scoring students. Check if the answer key is reversed or the question is ambiguous.",
          badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
        });
      } else if (q.flags.includes("NON_FUNCTIONING_DISTRACTOR")) {
        list.push({
          question: q,
          priority: 2,
          reasonTitle: "Non-functioning Distractor",
          reasonDesc:
            "One or more options were selected by 0 students or chosen more by top students than struggling students.",
          badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        });
      } else if (q.flags.includes("TOO_HARD")) {
        list.push({
          question: q,
          priority: 3,
          reasonTitle: "Very Difficult (Facility ≤ 0.25)",
          reasonDesc:
            "Fewer than 25% of students solved this question successfully. Verify if concepts were covered.",
          badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
        });
      } else if (q.flags.includes("TOO_EASY")) {
        list.push({
          question: q,
          priority: 4,
          reasonTitle: "Very Easy (Facility ≥ 0.85)",
          reasonDesc:
            "Over 85% of students solved this item. It provides minimal discrimination between high and average performers.",
          badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
        });
      } else if (q.flags.includes("WEAK_DISCRIMINATION")) {
        list.push({
          question: q,
          priority: 5,
          reasonTitle: "Weak Discrimination (r < 0.10)",
          reasonDesc:
            "Performance on this question does not strongly correlate with overall exam score.",
          badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
        });
      }
    }

    return list.sort((a, b) => a.priority - b.priority);
  }, [questionMetrics]);

  // Filtered item list for the table
  const displayedQuestions = useMemo(() => {
    return questionMetrics.filter((q) => {
      if (selectedTopicFilter && q.topic !== selectedTopicFilter) return false;
      if (selectedFlagFilter !== "ALL") {
        if (selectedFlagFilter === "FLAGGED" && q.flags.length === 0) return false;
        if (selectedFlagFilter !== "FLAGGED" && !q.flags.includes(selectedFlagFilter as ItemFlag)) {
          return false;
        }
      }
      return true;
    });
  }, [questionMetrics, selectedTopicFilter, selectedFlagFilter]);

  if (totalCompleted === 0) {
    return (
      <div className="bg-slate-50 p-12 rounded-3xl border border-slate-200 text-center space-y-3">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
          <TrendingUp className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Waiting for Submissions</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Comprehensive psychometric analysis, distractor statistics, and topic mastery will automatically compute once students complete this examination.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 mb-16">
      {/* Insufficient Data Warning Banner */}
      {isInsufficientN && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-800">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-900">
              Preliminary Data Notice (Only {n} completed submissions)
            </p>
            <p className="leading-relaxed">
              Standard psychometric statistics (Cronbach&apos;s alpha, corrected item-total correlation, and upper-lower discrimination) require at least 10 completed submissions to prevent statistical noise. Raw facility and points are displayed below.
            </p>
          </div>
        </div>
      )}

      {/* Truncation Notice */}
      {truncated && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-xs text-blue-800 font-medium">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Analysing the first 2,000 completed submissions for optimal database responsiveness.</span>
        </div>
      )}

      {/* Test Health Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* N & Class Average */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cohort Average</span>
          <div className="my-2">
            <div className="text-3xl font-black text-slate-900">
              {maxPossibleScore > 0 ? ((analysis?.mean ?? 0) / maxPossibleScore * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Mean: {analysis?.mean?.toFixed(1) ?? "0"} / {maxPossibleScore} pts (N = {n})
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Median: {analysis?.median?.toFixed(1) ?? "0"} • SD: {analysis?.sd?.toFixed(2) ?? "0"}
          </div>
        </div>

        {/* Reliability / Cronbach's Alpha */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Test Reliability</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${alphaInfo.color}`}>
              {alphaInfo.label}
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-slate-900">
              {analysis?.alpha !== null && analysis?.alpha !== undefined ? analysis.alpha.toFixed(2) : "—"}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">Cronbach&apos;s Alpha (α)</div>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">{alphaInfo.desc}</p>
        </div>

        {/* Score Range */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Score Range</span>
          <div className="my-2">
            <div className="text-3xl font-black text-slate-900">
              {analysis?.min?.toFixed(0) ?? 0} – {analysis?.max?.toFixed(0) ?? 0}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">Min & Max Marks Scored</div>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Spread: {((analysis?.max ?? 0) - (analysis?.min ?? 0)).toFixed(1)} points
          </div>
        </div>

        {/* Distribution Histogram */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Score Distribution</span>
          <div className="h-16 flex items-end justify-between gap-1.5 pt-2">
            {histogramBins.map((bin, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-md transition-all"
                  style={{ height: `${Math.max(bin.heightPct, 8)}%` }}
                />
                <span className="text-[9px] font-bold text-slate-400">{bin.range}</span>
                {/* Tooltip */}
                <div className="absolute -top-7 hidden group-hover:block bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow">
                  {bin.count} students
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* "Items Needing Attention" Panel */}
      {flaggedItems.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Items Needing Attention ({flaggedItems.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Advisory diagnostics sorted by severity
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {flaggedItems.slice(0, 5).map(({ question, reasonTitle, reasonDesc, badgeColor }) => (
              <div key={question.questionId} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Q#{question.order}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                      {reasonTitle}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">{question.type}</span>
                  </div>
                  <p className="text-slate-700 font-medium line-clamp-1">{question.content}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{reasonDesc}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-slate-900">Facility: {(question.facility * 100).toFixed(0)}%</div>
                    <div className="text-[10px] text-slate-400">
                      r = {question.discrimination !== null ? question.discrimination.toFixed(2) : "—"}
                    </div>
                  </div>
                  {examId && (
                    <Link
                      href={`/teacher/exams/${examId}`}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                    >
                      Review
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cohort Topic Performance Section (§7.2) */}
      {topicBreakdown.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Cohort Topic Mastery</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Weakest topics listed first • Click topic to filter questions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topicBreakdown.map((t) => {
              const isSelected = selectedTopicFilter === t.topic;
              return (
                <button
                  type="button"
                  key={t.topic}
                  onClick={() => setSelectedTopicFilter(isSelected ? null : t.topic)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20"
                      : "bg-slate-50/40 hover:bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                        <span>{t.topic}</span>
                        {t.lowConfidence && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700">
                            Low confidence (&lt; 3 items)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {t.itemCount} question{t.itemCount > 1 ? "s" : ""} • {t.studentsBelowHalf ?? 0} student(s) below 50%
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-900">{t.percentage.toFixed(1)}%</span>
                  </div>

                  <div className="mt-3 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.percentage >= 70
                          ? "bg-emerald-500"
                          : t.percentage >= 50
                            ? "bg-blue-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, t.percentage)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Item Analysis Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Item Psychometrics & Distractor Table</h3>
            <p className="text-xs text-slate-400">
              Detailed facility, point-biserial discrimination, and option choices per question
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedTopicFilter && (
              <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                <span>Topic: {selectedTopicFilter}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTopicFilter(null)}
                  className="hover:text-indigo-900"
                >
                  ×
                </button>
              </span>
            )}

            <select
              value={selectedFlagFilter}
              onChange={(e) => setSelectedFlagFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700"
            >
              <option value="ALL">All Questions</option>
              <option value="FLAGGED">Only Flagged Questions</option>
              <option value="NEGATIVE_DISCRIMINATION">Negative Discrimination</option>
              <option value="NON_FUNCTIONING_DISTRACTOR">Distractor Issues</option>
              <option value="TOO_HARD">Very Difficult</option>
              <option value="TOO_EASY">Very Easy</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 w-12">#</th>
                <th className="px-5 py-3">Question</th>
                <th className="px-5 py-3">Topic</th>
                <th className="px-5 py-3">Observed Facility</th>
                <th className="px-5 py-3">Discrimination (r)</th>
                <th className="px-5 py-3">Discrimination (D)</th>
                <th className="px-5 py-3">Advisory Flags</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedQuestions.map((q) => {
                const isExpanded = expandedQuestionId === q.questionId;
                return (
                  <tr key={q.questionId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-400">Q#{q.order}</td>
                    <td className="px-5 py-4 max-w-sm">
                      <div className="font-semibold text-slate-800 line-clamp-2">{q.content}</div>
                      <div className="text-[10px] text-slate-400 mt-1 uppercase">
                        {q.type} • {q.totalPoints} pt{q.totalPoints > 1 ? "s" : ""} • Declared: {q.declaredDifficulty || "MEDIUM"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]">
                        {q.topic}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-24">
                        <div className="font-bold text-slate-800">{(q.facility * 100).toFixed(0)}%</div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${
                              q.facility >= 0.85
                                ? "bg-blue-500"
                                : q.facility <= 0.25
                                  ? "bg-rose-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: `${q.facility * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold">
                      {q.discrimination !== null ? (
                        <span
                          className={
                            q.discrimination < 0
                              ? "text-rose-600 font-black"
                              : q.discrimination < 0.1
                                ? "text-amber-600"
                                : "text-emerald-700"
                          }
                        >
                          {q.discrimination.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold">
                      {q.discriminationUpperLower !== null ? (
                        <span
                          className={
                            q.discriminationUpperLower < 0
                              ? "text-rose-600 font-black"
                              : q.discriminationUpperLower < 0.1
                                ? "text-amber-600"
                                : "text-slate-700"
                          }
                        >
                          {q.discriminationUpperLower.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {q.flags.length === 0 ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Good Item
                          </span>
                        ) : (
                          q.flags.map((f) => (
                            <span
                              key={f}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                f === "NEGATIVE_DISCRIMINATION"
                                  ? "bg-rose-100 text-rose-700"
                                  : f === "NON_FUNCTIONING_DISTRACTOR"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {ITEM_FLAG_LABELS[f] || f}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {q.type === "MCQ" && q.distractors && q.distractors.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedQuestionId(isExpanded ? null : q.questionId)}
                          className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Distractors</span>
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Distractor Drawer / Expanded view */}
        {expandedQuestionId && (() => {
          const q = questionMetrics.find((item) => item.questionId === expandedQuestionId);
          if (!q || !q.distractors) return null;

          return (
            <div className="p-6 bg-slate-50/80 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs">
                  Option Choice Breakdown for Q#{q.order}
                </h4>
                <button
                  type="button"
                  onClick={() => setExpandedQuestionId(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {q.distractors.map((d) => (
                  <div
                    key={d.key}
                    className={`p-3.5 rounded-2xl border text-xs ${
                      d.isKey
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : d.count === 0 || d.upperCount > d.lowerCount
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>Option {d.key}</span>
                      {d.isKey && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px]">
                          Correct Key
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xl font-black">{d.count} picks</div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Top 27%: {d.upperCount} • Bottom 27%: {d.lowerCount}
                    </div>
                  </div>
                ))}
              </div>

              {q.explanation && (
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-slate-700">Author Explanation:</span>
                  <p className="text-slate-600 leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
