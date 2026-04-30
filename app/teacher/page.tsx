import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { 
  Users, 
  BookOpen, 
  FileCheck, 
  AlertCircle 
} from "lucide-react";

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions);
  
  // Fetch some basic stats
  const [batchesCount, examsCount, totalSubmissions] = await Promise.all([
    prisma.batch.count({ where: { teacherId: session?.user.id } }),
    prisma.exam.count({ where: { batch: { teacherId: session?.user.id } } }),
    prisma.submission.count({ 
      where: { session: { exam: { batch: { teacherId: session?.user.id } } } } 
    }),
  ]);

  const stats = [
    { label: "Active Batches", value: batchesCount, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Total Exams", value: examsCount, icon: BookOpen, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Submissions", value: totalSubmissions, icon: FileCheck, color: "text-green-600", bg: "bg-green-100" },
    { label: "Cheat Alerts", value: 0, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
  ];

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Welcome back, {session?.user.name}</h2>
        <p className="text-gray-500">Here's what's happening with your exams today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border flex items-center">
            <div className={`p-3 rounded-lg ${stat.bg} mr-4`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Recent Exams</h3>
          <div className="text-center py-10 text-gray-400">
            <p>No recent exams found.</p>
            <button className="mt-4 text-blue-600 font-medium hover:underline">Create your first exam</button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Upcoming Schedule</h3>
          <div className="text-center py-10 text-gray-400">
            <p>Your schedule is clear for now.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
