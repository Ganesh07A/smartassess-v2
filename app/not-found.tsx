import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-3xl border shadow-sm p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center mx-auto mb-6">
          <SearchX className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Not found</h1>
        <p className="text-gray-500 mb-8">
          This page does not exist, or you do not have access to it.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
