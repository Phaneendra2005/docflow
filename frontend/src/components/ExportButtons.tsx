"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { ExportFormat } from "../types";
import { exportDocument } from "../lib/api";

export default function ExportButtons({ jobId, isFinalized }: { jobId: string; isFinalized: boolean }) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onExport = async (format: ExportFormat) => {
    if (!isFinalized) return;
    setLoading(format);
    try {
      const blob = await exportDocument(jobId, format);
      const ext = format === "json" ? "json" : "csv";
      downloadBlob(blob, `docflow_export_${jobId}.${ext}`);
      toast.success(`Exported ${format.toUpperCase()}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Export failed.";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="button"
        disabled={!isFinalized || loading !== null}
        onClick={() => onExport("json")}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading === "json" ? "Exporting…" : "Export JSON"}
      </button>
      <button
        type="button"
        disabled={!isFinalized || loading !== null}
        onClick={() => onExport("csv")}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading === "csv" ? "Exporting…" : "Export CSV"}
      </button>
    </div>
  );
}

