"use client";

import { useSyncExternalStore } from "react";

type LocalTimeMode = "time" | "date" | "datetime";

const subscribe = () => () => {};

/**
 * Renders a timestamp in the *viewer's* timezone.
 *
 * Server components render with the server's timezone (UTC on Vercel), which silently shifted
 * every exam start/end time for IST users. Anything the user reads must go through this component.
 */
export default function LocalTime({
  dateString,
  mode = "time",
  className = "font-black text-gray-900",
}: {
  dateString: string | Date;
  mode?: LocalTimeMode;
  className?: string;
}) {
  // `false` during SSR and the hydration pass, `true` afterwards — avoids both a hydration
  // mismatch and a setState-in-effect (which the react-hooks lint rules reject).
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!isHydrated) {
    return <span className={className}>…</span>;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return <span className={className}>—</span>;
  }

  const datePart = date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const formatted = mode === "date" ? datePart : mode === "datetime" ? `${datePart}, ${timePart}` : timePart;

  return <span className={className}>{formatted}</span>;
}
