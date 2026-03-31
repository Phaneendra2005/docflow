"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentJob, ListResponse } from "../types";
import { deleteDocument, exportBulk, exportDocument, finalizeResult, getDocument, listDocuments, retryJob, updateResult } from "../lib/api";

type SortBy = "created_at" | "updated_at" | "name";
type SortOrder = "asc" | "desc";

export type DocumentListFilters = {
  search?: string;
  status?: string;
  sort_by: SortBy;
  sort_order: SortOrder;
  skip: number;
  limit: number;
};

export function useDocumentList(filters: DocumentListFilters) {
  return useQuery<ListResponse, Error, ListResponse>({
    queryKey: ["documents", filters],
    queryFn: () => listDocuments(filters),
  });
}

export function useDocument(id: string | null | undefined) {
  return useQuery<DocumentJob, Error, DocumentJob>({
    queryKey: ["document", id],
    queryFn: () => {
      if (!id) throw new Error("Missing document id");
      return getDocument(id);
    },
    enabled: !!id,
  });
}

export function useDocumentMutations() {
  const qc = useQueryClient();

  const retry = useMutation({
    mutationFn: (id: string) => retryJob(id),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", job.id] });
    },
  });

  const updateResultMutation = useMutation({
    mutationFn: (args: { id: string; data: Parameters<typeof updateResult>[1] }) =>
      updateResult(args.id, args.data),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", job.id] });
    },
  });

  const finalize = useMutation({
    mutationFn: (id: string) => finalizeResult(id),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", job.id] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  return {
    retry,
    updateResult: updateResultMutation,
    finalize,
    delete: del,
    export: {
      exportDocument,
      exportBulk,
    },
  };
}

