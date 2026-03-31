"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { JobStatus, ProgressEvent } from "../types";
import { useSSE } from "../hooks/useSSE";

type Props = {
  jobId: string;
  initialStatus: JobStatus;
};

export default function ProgressTracker({ jobId, initialStatus }: Props) {
  const isTerminal = initialStatus === "completed" || initialStatus === "failed";

  const [progressPercent, setProgressPercent] = useState<number>(isTerminal ? 100 : 0);
  const [stageLabel, setStageLabel] = useState<string>(() => {
    if (initialStatus === "completed") return "Completed";
    if (initialStatus === "failed") return "Failed";
    return "Starting…";
  });
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const enabled = useMemo(() => !isTerminal, [isTerminal]);

  useSSE(
    jobId,
    (evt: ProgressEvent) => {
      setProgressPercent(evt.progress_percent ?? 0);

      if (evt.event_type === "document_parsing_started") {
        setStageLabel("Parsing document…");
      } else if (evt.event_type === "document_parsing_completed") {
        setStageLabel("Parsing complete");
        setCompletedSteps((prev) => ({ ...prev, parsing: true }));
      } else if (evt.event_type === "field_extraction_started") {
        setStageLabel("Extracting fields…");
      } else if (evt.event_type === "field_extraction_completed") {
        setStageLabel("Extraction complete");
        setCompletedSteps((prev) => ({ ...prev, extraction: true }));
      } else if (evt.event_type === "job_completed") {
        setProgressPercent(100);
        setStageLabel("Completed");
        setCompletedSteps((prev) => ({ ...prev, parsing: prev.parsing ?? true, extraction: prev.extraction ?? true }));
      } else if (evt.event_type === "job_failed") {
        setProgressPercent(100);
        setStageLabel("Failed");
      }
    },
    enabled
  );

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Processing Progress</div>
        <div className="text-xs text-slate-600">{stageLabel}</div>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
          <div
            className="h-full rounded bg-slate-900 transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-slate-600">{progressPercent}%</div>
      </div>

      <div className="mt-4 space-y-2">
        <StepRow done={!!completedSteps.parsing} label="Parsing document" />
        <StepRow done={!!completedSteps.extraction} label="Extracting fields" />
        {initialStatus === "failed" ? (
          <div className="flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>Job failed</span>
          </div>
        ) : null}
        {initialStatus === "completed" ? (
          <div className="flex items-center gap-2 text-xs text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>Job completed</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-700">
      {done ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <span className="inline-block h-4 w-4" />}
      <span>{label}</span>
    </div>
  );
}

