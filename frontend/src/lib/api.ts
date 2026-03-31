import axios from "axios";
import type { DocumentJob, ExportFormat, ListResponse, ProcessedResult } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

export async function uploadDocuments(files: File[]): Promise<DocumentJob[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await api.post<DocumentJob[]>("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function listDocuments(params: {
  search?: string;
  status?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  skip?: number;
  limit?: number;
}): Promise<ListResponse> {
  const res = await api.get<ListResponse>("/documents", { params });
  return res.data;
}

export async function getDocument(id: string): Promise<DocumentJob> {
  const res = await api.get<DocumentJob>(`/documents/${id}`);
  return res.data;
}

export async function retryJob(id: string): Promise<DocumentJob> {
  const res = await api.post<DocumentJob>(`/documents/${id}/retry`);
  return res.data;
}

export async function updateResult(
  id: string,
  data: Partial<Pick<ProcessedResult, "title" | "category" | "summary" | "keywords">>
): Promise<DocumentJob> {
  const res = await api.put<DocumentJob>(`/documents/${id}/result`, data);
  return res.data;
}

export async function finalizeResult(id: string): Promise<DocumentJob> {
  const res = await api.post<DocumentJob>(`/documents/${id}/finalize`);
  return res.data;
}

export const exportDocument = async (id: string, format: "json" | "csv") => {
  const res = await fetch(`http://localhost:8000/api/documents/${id}/export/${format}`, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Export failed");
  }

  return await res.blob(); // 🔥 CRITICAL
};

export async function exportBulk(format: ExportFormat): Promise<Blob> {
  const res = await api.get(`/documents/export/bulk`, {
    params: { format },
    responseType: "blob",
  });
  return res.data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}

