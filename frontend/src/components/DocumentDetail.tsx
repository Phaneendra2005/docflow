"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDocumentMutations } from "../hooks/useDocuments";
import type { DocumentJob } from "../types";
import StatusBadge from "./StatusBadge";
import ProgressTracker from "./ProgressTracker";
import EditForm from "./EditForm";
import ExportButtons from "./ExportButtons";
import { useRouter } from "next/navigation";

function effectiveFields(job: DocumentJob) {
  const result = job.result;
  const edits = result?.user_edits ?? null;

  if (!result) return null;

  return {
    title: (edits?.title as string | undefined) ?? result.title,
    category: (edits?.category as string | undefined) ?? result.category,
    summary: (edits?.summary as string | undefined) ?? result.summary,
    keywords: (edits?.keywords as string[] | undefined) ?? result.keywords,
    extractedMetadata: result.extracted_metadata,
    isFinalized: result.is_finalized,
  };
}

export default function DocumentDetail({ job }: { job: DocumentJob }) {
  const fields = useMemo(() => effectiveFields(job), [job]);
  const [tab, setTab] = useState<"extracted" | "raw">("extracted");
  const [editing, setEditing] = useState(false);

  const { finalize } = useDocumentMutations();
  const jobId = job.id;
  const router = useRouter();

  const onFinalize = async () => {
    try {
      await finalize.mutateAsync(jobId);
      toast.success("Result finalized.");
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Finalize failed.";
      toast.error(msg);
    }
  };

  const canFinalize = job.status === "completed" && !!job.result && !job.result.is_finalized;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
              onClick={() => router.back()}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-slate-900">{job.original_filename}</div>
            <div className="mt-1 text-xs text-slate-600">
              Uploaded as: <span className="font-semibold">{job.filename}</span>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Type: <span className="font-semibold">{job.file_type}</span> · Size:{" "}
              <span className="font-semibold">{Math.max(1, Math.round(job.file_size / 1024))} KB</span>
            </div>
            {job.status === "failed" ? (
              <div className="mt-2 text-sm font-semibold text-red-700">
                {job.error_message || "Processing failed."}
              </div>
            ) : null}
          </div>
        </div>

        {job.status === "queued" || job.status === "processing" ? (
          <div className="mt-4">
            <ProgressTracker jobId={job.id} initialStatus={job.status} />
          </div>
        ) : null}

        {job.status === "completed" || job.status === "failed" ? (
          <div className="mt-4">
            {job.result ? (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="rounded bg-slate-100 px-2 py-1 font-semibold">
                  {job.result.is_finalized ? "Finalized" : "Not finalized"}
                </span>
                {job.result.finalized_at ? (
                  <span>Finalized at: {new Date(job.result.finalized_at).toLocaleString()}</span>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-slate-600">No processed result available.</div>
            )}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("extracted")}
            className={
              tab === "extracted"
                ? "rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                : "rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            }
          >
            Extracted Data
          </button>
          <button
            type="button"
            onClick={() => setTab("raw")}
            className={
              tab === "raw"
                ? "rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                : "rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            }
          >
            Raw Metadata
          </button>

          <div className="flex-1" />

          {job.result ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={job.status !== "completed" || !!job.result?.is_finalized}
                onClick={() => setEditing((v) => !v)}
                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {editing ? "Close" : "Edit"}
              </button>
              <button
                type="button"
                disabled={!canFinalize || finalize.isPending}
                onClick={onFinalize}
                className="rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {finalize.isPending ? "Finalizing…" : job.result.is_finalized ? "Finalized" : "Finalize"}
              </button>
            </div>
          ) : null}
        </div>

        {editing && job.result ? (
          <EditForm
            jobId={job.id}
            result={job.result}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        ) : null}

        <div className="mt-4">
          {tab === "extracted" ? (
            fields ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600">Title</div>
                  <div className="mt-1 text-base font-bold text-slate-900">{fields.title || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Category</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{fields.category || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Summary</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{fields.summary || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Keywords</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(fields.keywords || []).length ? (
                      fields.keywords.map((k) => (
                        <span key={k} className="rounded bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {k}
                        </span>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">No keywords.</div>
                    )}
                  </div>
                </div>

                <ExportButtons jobId={job.id} isFinalized={fields.isFinalized} />
              </div>
            ) : (
              <div className="text-sm text-slate-600">No extracted data yet.</div>
            )
          ) : (
            <div>
              <div className="text-xs font-semibold text-slate-600">Raw extracted metadata</div>
              <div className="mt-2 rounded bg-slate-950 p-4 text-xs text-slate-100">
                <pre className="whitespace-pre-wrap">{JSON.stringify(job.result?.extracted_metadata ?? {}, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

