"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { DocumentJob } from "../types";
import { useRouter } from "next/navigation";

const ALLOWED_EXTS = new Set([".txt", ".pdf", ".docx", ".csv", ".json", ".md"]);

type UploadItem = {
  id: string;
  file: File;
  progress: number; // 0-100
};

export default function UploadZone() {
  const router = useRouter();

  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const accepted = useMemo(() => Array.from(ALLOWED_EXTS).join(", "), []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filtered = acceptedFiles.filter((f) => {
      const ext = (f.name.includes(".") ? f.name.substring(f.name.lastIndexOf(".")) : "").toLowerCase();
      return ALLOWED_EXTS.has(ext);
    });

    if (filtered.length === 0) {
      toast.error(`Unsupported file types. Accept: ${accepted}`);
      return;
    }

    const nextItems = filtered.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
    }));
    setItems((prev) => [...prev, ...nextItems]);
  }, [accepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: false,
    noKeyboard: true,
  });

  const removeItem = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  const upload = async () => {
    if (items.length === 0) {
      toast.error("No files selected.");
      return;
    }
    setUploading(true);
    try {
      const createdJobs: DocumentJob[] = [];

      for (const item of items) {
        const formData = new FormData();
        formData.append("files", item.file);

        await new Promise<void>(async (resolve, reject) => {
          try {
            await api
              .post<DocumentJob[]>("/documents/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (evt) => {
                  const total = evt.total ?? 0;
                  const loaded = evt.loaded ?? 0;
                  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
                  setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)));
                },
              })
              .then((res) => {
                const jobs = res.data;
                createdJobs.push(...jobs);
                setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, progress: 100 } : x)));
                resolve();
              })
              .catch((err) => {
                reject(err);
              });
          } catch (e) {
            reject(e);
          }
        });
      }

      toast.success(`Uploaded ${createdJobs.length} document${createdJobs.length === 1 ? "" : "s"}.`);
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Upload failed.";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={[
          "rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragActive ? "border-slate-900 bg-slate-50" : "border-slate-300 bg-white",
        ].join(" ")}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-start gap-3">
          <div className="text-sm font-semibold">Drag & drop documents</div>
          <div className="text-xs text-slate-600">Accepted: {accepted}</div>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Selected files</div>
            <div className="text-xs text-slate-500">{items.length} file(s)</div>
          </div>
          <div className="mt-3 space-y-3">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.file.name}</div>
                  <div className="text-xs text-slate-500">{Math.max(1, Math.round(it.file.size / 1024))} KB</div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-100">
                    <div className="h-full bg-slate-900 transition-[width] duration-200" style={{ width: `${it.progress}%` }} />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => removeItem(it.id)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={items.length === 0 || uploading}
          onClick={upload}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <div className="text-xs text-slate-500">Processing starts automatically after upload.</div>
      </div>
    </div>
  );
}

