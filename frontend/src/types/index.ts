export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type ExportFormat = "json" | "csv";

export interface ProcessedResult {
  id: string;
  job_id: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  extracted_metadata: Record<string, any>;
  raw_text: string;
  is_finalized: boolean;
  finalized_at: string | null;
  user_edits: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentJob {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  celery_task_id: string | null;
  error_message: string | null;
  retry_count: number;
  result: ProcessedResult | null;
}

export interface DocumentJobListItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: JobStatus;
  created_at: string;
  retry_count: number;
  error_message: string | null;
}

export interface ListResponse {
  items: DocumentJobListItem[];
  total: number;
  queued_count: number;
  processing_count: number;
  completed_count: number;
  failed_count: number;
  skip: number;
  limit: number;
}

export interface ProgressEvent {
  job_id: string;
  event_type: string;
  message: string;
  progress_percent: number;
  timestamp: string;
}

