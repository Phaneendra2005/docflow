"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDocumentList, useDocumentMutations } from "../../hooks/useDocuments";
import SearchAndFilter from "../../components/SearchAndFilter";
import JobCard from "../../components/JobCard";

export default function DashboardPage() {
  const pageSize = 10;
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState<{
    search?: string;
    status?: "queued" | "processing" | "completed" | "failed" | "finalized";
    sort_by: "created_at" | "updated_at" | "name";
    sort_order: "asc" | "desc";
  }>({
    search: undefined,
    status: undefined,
    sort_by: "created_at",
    sort_order: "desc",
  });

  const query = useDocumentList({
    search: filters.search,
    // 🔥 backend does NOT support finalized → send undefined
    status:
  filters.status && filters.status !== "finalized"
    ? filters.status
    : undefined,
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
    skip: page * pageSize,
    limit: pageSize,
  });

  const { retry, delete: deleteMutation, export: exportsApi } = useDocumentMutations();
  const [bulkExportLoading, setBulkExportLoading] = useState(false);

  const totalPages = useMemo(() => {
    const total = query.data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [query.data?.total]);

  const anyProcessing = (query.data?.processing_count ?? 0) > 0;

  useEffect(() => {
    if (!anyProcessing) return;
    const t = window.setInterval(() => {
      query.refetch();
    }, 10_000);
    return () => window.clearInterval(t);
  }, [anyProcessing]);

  const onRetry = async (id: string) => {
    try {
      await retry.mutateAsync(id);
      toast.success("Job retried.");
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Retry failed.";
      toast.error(msg);
    }
  };

  const onDelete = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Delete failed");
      }

      toast.success("Document deleted.");
      query.refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Delete failed.");
    }
  };

  const stats = query.data;

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

  const onBulkExport = async () => {
    try {
      setBulkExportLoading(true);
      const blob = await exportsApi.exportBulk("csv");
      downloadBlob(blob, "docflow_export_bulk.csv");
      toast.success("Bulk CSV export started.");
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Bulk export failed.";
      toast.error(msg);
    } finally {
      setBulkExportLoading(false);
    }
  };

  // 🔥 FINALIZED FILTER LOGIC
  const filteredJobs = (query.data?.items ?? []).filter((job) => {
    if (filters.status === "finalized") {
      return job.status === "completed"; // 🔥 TEMP FIX
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Document Dashboard</h1>
        <div className="mt-1 text-sm text-slate-600">
          Async jobs with live progress streaming via SSE.
        </div>
      </div>

      {/* 🔥 STATS */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <StatCard label="Total" value={stats?.total ?? 0} />
          <StatCard label="Queued" value={stats?.queued_count ?? 0} />
          <StatCard label="Processing" value={stats?.processing_count ?? 0} />
          <StatCard label="Completed" value={stats?.completed_count ?? 0} />
          <StatCard label="Failed" value={stats?.failed_count ?? 0} />
          <StatCard label="Finalized" value={(stats as any)?.finalized_count ?? 0} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBulkExport}
            disabled={bulkExportLoading}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {bulkExportLoading ? "Exporting…" : "Export Bulk CSV"}
          </button>
          <div className="text-xs text-slate-600">Exports finalized documents only.</div>
        </div>
      </div>

      <SearchAndFilter
        initial={{
          search: filters.search,
          status: filters.status,
          sort_by: filters.sort_by,
          sort_order: filters.sort_order,
        }}
        onChange={(next) => {
          const nextStatus =
            next.status && next.status !== "all" ? (next.status as any) : undefined;

            setFilters({
              search: next.search,
              status:
                next.status === "finalized"
                  ? "finalized"
                  : next.status && next.status !== "all"
                  ? (next.status as any)
                  : undefined,
              sort_by: next.sort_by,
              sort_order: next.sort_order,
            });
          setPage(0);
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {query.isLoading ? "Loading…" : `Showing page ${page + 1} of ${totalPages}`}
        </div>
        <a href="/upload">
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Upload New
          </button>
        </a>
      </div>

      {query.isLoading ? (
        <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Loading documents…
        </div>
      ) : filteredJobs.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} onRetry={onRetry} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-sm font-semibold text-slate-700">No documents found</div>
          <div className="mt-1 text-sm text-slate-600">
            Upload your first document to start processing.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={page <= 0 || query.isFetching}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages - 1 || query.isFetching}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}