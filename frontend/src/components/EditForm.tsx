"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { ProcessedResult } from "../types";
import { updateResult } from "../lib/api";

const CATEGORY_OPTIONS = ["PDF Document", "Text File", "Word Document", "Spreadsheet", "Data File", "Other"];

function effectiveFromResult(result: ProcessedResult | null): {
  title: string;
  category: string;
  summary: string;
  keywords: string[];
} {
  if (!result) {
    return { title: "", category: "", summary: "", keywords: [] };
  }
  const edits = result.user_edits ?? {};
  return {
    title: (edits.title as string) ?? result.title,
    category: (edits.category as string) ?? result.category,
    summary: (edits.summary as string) ?? result.summary,
    keywords: (edits.keywords as string[]) ?? result.keywords,
  };
}

export default function EditForm({
  jobId,
  result,
  onCancel,
  onSaved,
}: {
  jobId: string;
  result: ProcessedResult;
  onCancel: () => void;
  onSaved?: () => void;
}) {
  const initial = useMemo(() => effectiveFromResult(result), [result]);

  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category || CATEGORY_OPTIONS[0]);
  const [summary, setSummary] = useState(initial.summary);
  const [keywords, setKeywords] = useState<string[]>(initial.keywords || []);
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addKeyword = (raw: string) => {
    const k = raw.trim();
    if (!k) return;
    setKeywords((prev) => {
      const next = [...prev, k];
      // Deduplicate preserving order.
      return Array.from(new Set(next.map((x) => x.trim()))).filter(Boolean).slice(0, 12);
    });
    setKeywordInput("");
  };

  const removeKeyword = (idx: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateResult(jobId, {
        title,
        category,
        summary,
        keywords,
      });
      toast.success("Changes saved.");
      onSaved?.();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Failed to save changes.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Edit Extracted Data</div>
          <div className="mt-1 text-xs text-slate-500">Edits are stored as user overrides until finalized/exported.</div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          disabled={saving}
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-700">Title</label>
          <input
            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700">Category</label>
          <select
            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="text-xs font-semibold text-slate-700">Keywords</label>
          <div className="mt-1 flex gap-2">
            <input
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              value={keywordInput}
              placeholder="Type keyword and press Enter"
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword(keywordInput);
                }
              }}
            />
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              disabled={saving}
              onClick={() => addKeyword(keywordInput)}
            >
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.map((k, idx) => (
              <span
                key={`${k}-${idx}`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
              >
                {k}
                <button
                  type="button"
                  className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-300"
                  disabled={saving}
                  onClick={() => removeKeyword(idx)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-700">Summary</label>
          <textarea
            className="mt-1 min-h-[120px] w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

