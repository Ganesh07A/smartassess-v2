export default function StudentDashboard() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Available Exams</h2>
        <p className="mt-2 text-gray-500">You don&apos;t have any exams scheduled at the moment.</p>
        
        <div className="mt-8 border-t pt-8">
          <p className="text-sm text-gray-400">Please check back later or contact your instructor if you believe this is an error.</p>
        </div>
      </div>
    </div>
  );
}
