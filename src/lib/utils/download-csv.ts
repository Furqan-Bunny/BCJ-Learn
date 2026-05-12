"use client";

// Tiny client-side helper to download a CSV string returned from a server
// action. Usage:
//
//   const res = await exportResultsCsv(...);
//   if (res.ok) downloadCsv(res.csv, "results.csv");

export function downloadCsv(csv: string, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
