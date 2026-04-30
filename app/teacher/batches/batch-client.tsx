"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users, Trash2, Loader2 } from "lucide-react";
import { createBatch, deleteBatch } from "@/app/actions/batch";

interface Batch {
  id: string;
  name: string;
  _count: {
    students: number;
    exams: number;
  };
}

export default function BatchClient({ initialBatches }: { initialBatches: Batch[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    setSubmitting(true);
    try {
      await createBatch(newBatchName);
      setNewBatchName("");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to create batch:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!confirm("Are you sure you want to delete this batch? All associated data will be lost.")) return;

    try {
      await deleteBatch(id);
    } catch (error) {
      console.error("Failed to delete batch:", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Batches</h2>
          <p className="text-gray-500">Manage your student groups and their enrollments.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Batch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialBatches.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No batches yet</h3>
            <p className="text-gray-500 mt-1">Create your first batch to start organizing students.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-blue-600 font-medium hover:underline"
            >
              Get started
            </button>
          </div>
        ) : (
          initialBatches.map((batch) => (
            <div key={batch.id} className="bg-white p-6 rounded-xl shadow-sm border group hover:shadow-md transition-shadow relative">
              <Link href={`/teacher/batches/${batch.id}`} className="absolute inset-0 z-0" aria-label={`View ${batch.name} details`}></Link>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-xl font-semibold text-gray-800">{batch.name}</h3>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteBatch(batch.id);
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500 relative z-10 pointer-events-none">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {batch._count.students} Students
                </div>
                <div className="flex items-center">
                  <Plus className="w-4 h-4 mr-1" />
                  {batch._count.exams} Exams
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Batch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Create New Batch</h3>
            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g., CS-2024-A"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newBatchName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {submitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
