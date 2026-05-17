
export default function TeacherLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-100 rounded-full"></div>
        <div className="w-12 h-12 border-4 border-t-gray-900 rounded-full animate-spin absolute top-0 left-0"></div>
      </div>
      <p className="mt-4 text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">
        Loading Dashboard...
      </p>
    </div>
  );
}
