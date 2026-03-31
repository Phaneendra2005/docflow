"use client";

import { useParams } from "next/navigation";
import { useDocument } from "../../../hooks/useDocuments";
import DocumentDetail from "../../../components/DocumentDetail";

export default function DocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const query = useDocument(id);

  if (query.isLoading) {
    return (
      <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Loading document…
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {query.error?.message || "Failed to load document."}
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Document not found.
      </div>
    );
  }

  return <DocumentDetail job={query.data} />;
}