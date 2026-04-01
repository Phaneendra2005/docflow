import "./globals.css";
import type { ReactNode } from "react";
import Navbar from "../components/Navbar";
import Providers from "./providers";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}