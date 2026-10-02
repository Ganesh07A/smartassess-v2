import { getTeacherBatchesPaged } from "@/app/actions/batch";
import BatchClient from "./batch-client";

export const dynamic = "force-dynamic";

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const pagedBatches = await getTeacherBatchesPaged(rawParams);

  return <BatchClient data={pagedBatches} />;
}
