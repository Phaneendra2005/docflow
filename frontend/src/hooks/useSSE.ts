"use client";

import { useEffect, useRef } from "react";
import type { ProgressEvent } from "../types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

type SSECallback = (event: ProgressEvent) => void;

export function useSSE(jobId: string | null | undefined, onEvent: SSECallback, enabled: boolean) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const esRef = useRef<EventSource | null>(null);
  const closedTerminalRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !jobId) return;

    closedTerminalRef.current = false;
    reconnectAttemptRef.current = 0;

    const url = `${API_BASE_URL}/documents/${jobId}/progress`;

    const connect = () => {
      if (closedTerminalRef.current) return;

      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as ProgressEvent;
          onEventRef.current(parsed);
          if (parsed.event_type === "job_completed" || parsed.event_type === "job_failed") {
            closedTerminalRef.current = true;
            es.close();
          }
        } catch {
          // Ignore malformed SSE messages.
        }
      };

      es.onerror = () => {
        if (closedTerminalRef.current) return;
        try {
          es.close();
        } catch {
          // ignore
        }

        reconnectAttemptRef.current += 1;
        const attempt = reconnectAttemptRef.current;
        const delayMs = Math.min(10_000, 1000 * 2 ** (attempt - 1));

        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => {
          connect();
        }, delayMs);
      };
    };

    connect();

    return () => {
      closedTerminalRef.current = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      try {
        esRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, [jobId, enabled]);
}

