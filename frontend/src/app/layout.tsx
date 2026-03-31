"use client";

import "./globals.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import { useState, type ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <QueryClientProvider client={queryClient}>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <Toaster position="top-right" />
        </QueryClientProvider>
      </body>
    </html>
  );
}


