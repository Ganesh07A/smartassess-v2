"use client";

import { 
  TrendingUp, 
  Target, 
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from "lucide-react";

interface QuestionMetric {
  questionId: string;
  content: string;
  type: string;
  successRate: number;
  avgScore: number;
  difficulty: string;
  totalPoints: number;
}

interface AnalyticsDashboardProps {
  analytics: {
    totalCompleted: number;
    questionMetrics: QuestionMetric[];
    scores: number[];
    maxPossibleScore: number;
  };
}

export default function AnalyticsDashboard({ analytics }: AnalyticsDashboardProps) {
  const { totalCompleted, questionMetrics, scores, maxPossibleScore } = analytics;

  if (totalCompleted === 0) {
    return (
      <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100 text-center">
        <TrendingUp className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-blue-800 mb-1">Waiting for Submissions</h3>
        <p className="text-blue-600">Analytics will be available once students complete the exam.</p>
      </div>
    );
  }

  const avgExamScore = scores.reduce((a, b) => a + b, 0) / totalCompleted;
  const avgPercentage = (avgExamScore / maxPossibleScore) * 100;

  return (
    <div className="space-y-8 mb-12">
      {/* High-Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Class Average</div>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-bold text-blue-600">{avgPercentage.toFixed(1)}%</div>
            <div className="text-sm font-bold text-gray-500 mb-1">{avgExamScore.toFixed(1)} / {maxPossibleScore}</div>
          </div>
          <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${avgPercentage}%` }} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Total Completes</div>
          <div className="text-3xl font-bold text-gray-800">{totalCompleted}</div>
          <p className="text-xs text-gray-500 mt-2 font-medium">Verified submissions</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Success Rate</div>
          <div className="text-3xl font-bold text-green-600">
            {((scores.filter(s => (s/maxPossibleScore) >= 0.4).length / totalCompleted) * 100).toFixed(0)}%
          </div>
          <p className="text-xs text-gray-500 mt-2 font-medium">Students scoring {">"}40%</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Reliability</div>
          <div className="text-3xl font-bold text-purple-600">High</div>
          <p className="text-xs text-gray-500 mt-2 font-medium">Based on {totalCompleted} data points</p>
        </div>
      </div>

      {/* Question Performance Analysis */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center">
            <Target className="w-5 h-5 mr-2 text-red-500" />
            Question Performance Analysis
          </h3>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Official Metrics</span>
        </div>
        <div className="divide-y">
          {questionMetrics.map((q, i) => (
            <div key={q.questionId} className="p-8 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1 mr-8">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-xs font-black text-gray-400 uppercase">Q{i + 1} • {q.type}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                      q.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : 
                      q.difficulty === 'Hard' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <p className="text-gray-800 font-bold leading-relaxed">{q.content}</p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-black ${q.successRate > 70 ? 'text-green-600' : q.successRate < 40 ? 'text-red-600' : 'text-blue-600'}`}>
                    {q.successRate.toFixed(0)}%
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Success Rate</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="flex-1">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        q.successRate > 70 ? 'bg-green-500' : q.successRate < 40 ? 'bg-red-500' : 'bg-blue-500'
                      }`} 
                      style={{ width: `${q.successRate}%` }} 
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center space-x-12">
                  <div className="text-center">
                    <div className="text-sm font-black text-gray-800">{q.avgScore.toFixed(1)}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Avg Pts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-black text-gray-800">{q.totalPoints}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Max Pts</div>
                  </div>
                </div>
                <div className="flex justify-end">
                  {q.successRate < 30 ? (
                    <div className="flex items-center text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Critical: Low Performance
                    </div>
                  ) : q.successRate > 85 ? (
                    <div className="flex items-center text-green-600 text-xs font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Excellent Mastery
                    </div>
                  ) : (
                    <div className="flex items-center text-blue-600 text-xs font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Normal Distribution
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
