"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { FileText, FileSpreadsheet, FileJson, FileCode2, Trash2, RotateCcw } from "lucide-react";
import type { DocumentJobListItem, JobStatus } from "../types";
import StatusBadge from "./StatusBadge";

function FileIcon({ fileType }: { fileType: string }) {
  const ft = fileType.toLowerCase();
  if (ft.includes("csv")) return <FileSpreadsheet className="h-5 w-5 text-indigo-700" />;
  if (ft.includes("json")) return <FileJson className="h-5 w-5 text-emerald-700" />;
  if (ft.includes("pdf")) return <FileCode2 className="h-5 w-5 text-slate-700" />;
  return <FileText className="h-5 w-5 text-slate-700" />;
}

export default function JobCard({
  job,
  onRetry,
  onDelete,
}: {
  job: DocumentJobListItem;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();

  const createdAtText = (() => {
    try {
      return formatDistanceToNow(new Date(job.created_at), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  const status: JobStatus = job.status;

  return (
    <div
      className="group rounded border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow"
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/documents/${job.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/documents/${job.id}`);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <FileIcon fileType={job.file_type} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{job.filename}</div>
              <div className="mt-1 text-xs text-slate-500">{Math.max(1, Math.round(job.file_size / 1024))} KB</div>
              <div className="mt-1 text-xs text-slate-500">{createdAtText}</div>
              {status === "failed" ? (
                <div className="mt-2 text-xs text-red-700">
                  Retry count: <span className="font-semibold">{job.retry_count}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === "processing" ? (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="mt-2 text-xs text-slate-500">Processing in progress…</div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/documents/${job.id}`);
          }}
          className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          View
        </button>
        <div className="flex items-center gap-2">
          {status === "failed" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.(job.id);
              }}
              className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5" />
                Retry
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(job.id);
            }}
            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
          >
            <span className="inline-flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

