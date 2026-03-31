"use client";

import { useEffect, useState } from "react";

type StatusOption = "all" | "queued" | "processing" | "completed" | "failed" | "finalized";
type SortOption = "newest" | "oldest" | "name_asc" | "name_desc";

export type Filters = {
  search?: string;
  status?: StatusOption;
  sort_by: "created_at" | "updated_at" | "name";
  sort_order: "asc" | "desc";
  skip: number;
  limit: number;
};

export default function SearchAndFilter({
  initial,
  onChange,
}: {
  initial: { search?: string; status?: string; sort_by?: string; sort_order?: string };
  onChange: (next: Omit<Filters, "skip" | "limit"> & { status?: StatusOption }) => void;
}) {
  const [search, setSearch] = useState(initial.search ?? "");
  const [status, setStatus] = useState<StatusOption>((initial.status as StatusOption) ?? "all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  useEffect(() => {
    if (initial.sort_by === "name") {
      setSortOption(initial.sort_order === "asc" ? "name_asc" : "name_desc");
    } else if (initial.sort_by === "updated_at") {
      setSortOption(initial.sort_order === "asc" ? "oldest" : "newest");
    } else {
      setSortOption(initial.sort_order === "asc" ? "oldest" : "newest");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const { sort_by, sort_order } = mapSort(sortOption);
      onChange({
        search: search.trim() ? search.trim() : undefined,
        status,
        sort_by,
        sort_order,
      });
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [search, status, sortOption, onChange]);

  const clear = () => {
    setSearch("");
    setStatus("all");
    setSortOption("newest");
    const { sort_by, sort_order } = mapSort("newest");
    onChange({
      search: undefined,
      status: "all",
      sort_by,
      sort_order,
    });
  };

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-700">Search</label>
          <input
            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filename or original filename"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700">Status</label>
          <select
            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusOption)}
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="finalized">Finalized</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700">Sort</label>
          <select
            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </div>

        <button
          type="button"
          onClick={clear}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function mapSort(option: SortOption): { sort_by: "created_at" | "updated_at" | "name"; sort_order: "asc" | "desc" } {
  if (option === "newest") return { sort_by: "created_at", sort_order: "desc" };
  if (option === "oldest") return { sort_by: "created_at", sort_order: "asc" };
  if (option === "name_asc") return { sort_by: "name", sort_order: "asc" };
  return { sort_by: "name", sort_order: "desc" };
}

