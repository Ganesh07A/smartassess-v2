"use client";

import { useEffect, useState } from "react";

export default function LocalTime({ dateString }: { dateString: string | Date }) {
  const [formattedTime, setFormattedTime] = useState<string>("");

  useEffect(() => {
    const date = new Date(dateString);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const timer = setTimeout(() => {
      setFormattedTime(time);
    }, 0);
    return () => clearTimeout(timer);
  }, [dateString]);

  // Initially render a skeleton/empty tag, then mount the client formatted time.
  // This avoids hydration mismatch warnings.
  return <span className="font-black text-gray-900">{formattedTime || "..."}</span>;
}
