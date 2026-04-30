import { getStudentExams } from "@/app/actions/exam";
import Link from "next/link";
import { BookOpen, Clock, Calendar, ArrowRight, CheckCircle, Lock } from "lucide-react";

export default async function StudentDashboard() {
  const exams = await getStudentExams();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">My Exams</h2>
        <p className="text-gray-500 mt-2">View and take your scheduled examinations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm border p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800">No Exams Found</h3>
            <p className="text-gray-500 mt-2">You don&apos;t have any exams scheduled at the moment.</p>
          </div>
        ) : (
          exams.map((exam) => {
            const session = exam.sessions[0];
            const isCompleted = session?.status === "COMPLETED";
            const isStarted = session?.status === "STARTED";
            const now = new Date();
            const startTime = new Date(exam.startTime);
            const endTime = new Date(exam.endTime);
            const isUpcoming = now < startTime;
            const isExpired = now > endTime;
            const canStart = !isCompleted && !isExpired && !isUpcoming;

            return (
              <div key={exam.id} className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full uppercase tracking-wider">
                      {exam.batch.name}
                    </span>
                    {isCompleted ? (
                      <span className="flex items-center text-green-600 text-xs font-bold uppercase tracking-wider">
                        <CheckCircle className="w-4 h-4 mr-1" /> Completed
                      </span>
                    ) : isUpcoming ? (
                      <span className="flex items-center text-gray-400 text-xs font-bold uppercase tracking-wider">
                        <Lock className="w-4 h-4 mr-1" /> Upcoming
                      </span>
                    ) : isExpired ? (
                      <span className="text-red-500 text-xs font-bold uppercase tracking-wider">Expired</span>
                    ) : (
                      <span className="flex items-center text-blue-600 text-xs font-bold animate-pulse uppercase tracking-wider">
                        Active Now
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h3>
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-2" /> {exam.duration} Minutes
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-2" /> {startTime.toLocaleDateString()} at {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t mt-auto">
                  {isCompleted ? (
                    <Link 
                      href={`/student/exams/${exam.id}/result`}
                      className="w-full py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 flex items-center justify-center transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      View Result
                    </Link>
                  ) : canStart ? (
                    <Link 
                      href={`/student/exams/${exam.id}`}
                      className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center transition-colors"
                    >
                      {isStarted ? "Resume Exam" : "Start Exam"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  ) : isUpcoming ? (
                    <button disabled className="w-full py-2 bg-gray-100 text-gray-400 font-bold rounded-lg cursor-not-allowed">
                      Opens at {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ) : (
                    <button disabled className="w-full py-2 bg-gray-100 text-gray-400 font-bold rounded-lg cursor-not-allowed">
                      Exam Closed
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
