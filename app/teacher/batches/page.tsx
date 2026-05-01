import { getTeacherBatches } from "@/app/actions/batch";
import BatchClient from "./batch-client";

interface Batch {
  id: string;
  name: string;
  _count: {
    students: number;
    exams: number;
  };
}

export const dynamic = 'force-dynamic';

export default async function BatchesPage() {
  const batches = await getTeacherBatches();

  return <BatchClient initialBatches={batches as unknown as Batch[]} />;
}
