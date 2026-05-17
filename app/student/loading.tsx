
export default function StudentLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-blue-50 rounded-full"></div>
        <div className="w-12 h-12 border-4 border-t-blue-600 rounded-full animate-spin absolute top-0 left-0"></div>
      </div>
      <p className="mt-4 text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">
        Preparing your portal...
      </p>
    </div>
  );
}
