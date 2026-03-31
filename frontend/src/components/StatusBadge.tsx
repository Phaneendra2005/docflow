"use client";

import type { JobStatus } from "../types";

export default function StatusBadge({ status }: { status: JobStatus }) {
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold";

  if (status === "queued") {
    return <span className={`${base} bg-slate-100 text-slate-700`}>Queued</span>;
  }
  if (status === "processing") {
    return (
      <span className={`${base} bg-blue-50 text-blue-700`}>
        <span className="inline-flex h-2 w-2 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Processing
      </span>
    );
  }
  if (status === "completed") {
    return <span className={`${base} bg-green-50 text-green-700`}>Completed</span>;
  }
  return <span className={`${base} bg-red-50 text-red-700`}>Failed</span>;
}

