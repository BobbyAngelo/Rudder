"use client";

import { useRef, useState } from "react";
import { Download, Upload, Share2, Check } from "lucide-react";
import { Card, CardBody } from "@/components/ui";

/**
 * Settings card: export your knowledge as a portable Open Knowledge
 * Format (OKF) bundle, and import external OKF bundles into Rudder's
 * retrieval layer. People contacts and Health data are excluded from
 * exports by design.
 */
export default function OKFExportCard() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/export/okf");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rudder-okf-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setImportErr(null);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/okf", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      setImportMsg(`Imported "${data.bundle}" - ${data.conceptCount} concepts. Searchable on next query.`);
    } catch (err: unknown) {
      setImportErr(err instanceof Error ? err.message : String(err));
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Share2 size={18} className="text-amber-400" />
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Knowledge (Open Knowledge Format)</h2>
      </div>

      <Card>
        <CardBody>
          {/* Export */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-[var(--color-text-primary)]">Export as OKF</p>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                A portable bundle of cross-linked markdown (career, identity, notes, knowledge graph)
                any agent or tool can read. People and health data are excluded.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={busy}
              className="shrink-0 flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-md font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              style={{ background: "var(--color-accent)", color: "#000" }}
            >
              {done ? <Check size={14} /> : <Download size={14} />}
              {busy ? "Exporting..." : done ? "Downloaded" : "Export OKF"}
            </button>
          </div>
          {error && <div className="mt-3 text-[11px] text-red-400">{error}</div>}

          <div className="my-4 h-px bg-[var(--color-border-subtle)]" />

          {/* Import */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-[var(--color-text-primary)]">Import an OKF bundle</p>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Add knowledge from another OKF producer (a .zip). Concepts are embedded into
                Rudder&apos;s retrieval layer and become searchable.
              </p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importBusy}
              className="shrink-0 flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-md font-medium border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 border-[var(--color-border)] text-[var(--color-text-primary)]"
            >
              <Upload size={14} />
              {importBusy ? "Importing..." : "Import .zip"}
            </button>
            <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />
          </div>
          {importMsg && <div className="mt-3 text-[11px] text-emerald-400">{importMsg}</div>}
          {importErr && <div className="mt-3 text-[11px] text-red-400">{importErr}</div>}
        </CardBody>
      </Card>
    </section>
  );
}
