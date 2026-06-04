"use client";

import { useEffect, useRef, useState } from "react";
import { FolderPlus, RefreshCw, Trash2, Loader2, Plug, CheckCircle2, UploadCloud, FileText, BookText, CalendarDays, Users, HeartPulse, Image, MessagesSquare } from "lucide-react";

const SUPPORTED = "txt, md, html, csv, tsv, json, rtf · pdf, docx · images (OCR)";
type Kind = "markdown" | "files" | "calendar" | "contacts" | "health" | "linkedin" | "email" | "meta" | "twitter" | "google" | "photos" | "chatgpt";

interface Connector {
  id: number;
  type: string;
  path: string;
  label: string | null;
  last_sync: string | null;
  chunk_count: number;
  status: string;
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [path, setPath] = useState("");
  const [kind, setKind] = useState<Kind>("markdown");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await fetch("/api/connectors");
    const data = await res.json();
    setConnectors(data.connectors || []);
  };
  useEffect(() => { load(); }, []);

  const post = async (body: any) => {
    const res = await fetch("/api/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const add = async () => {
    if (!path.trim()) return;
    setBusy("add"); setError(""); setToast("");
    const data = await post({ action: "add", type: kind, path: path.trim() });
    setBusy(null);
    if (data.error) { setError(data.error); return; }
    setPath("");
    setToast(`Connected — embedded ${data.indexed}, skipped ${data.skipped} unchanged.`);
    load();
  };

  const uploadFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy("drop"); setError(""); setToast("");
    const form = new FormData();
    for (const f of Array.from(list)) form.append("files", f);
    try {
      const res = await fetch("/api/ingest/file", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Upload failed"); return; }
      const note = data.skipped?.length ? ` · couldn't read ${data.skipped.length}` : "";
      setToast(`Dropped ${data.docs} file(s) — embedded ${data.indexed}, ${data.unchanged ?? 0} unchanged${note}.`);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const sync = async (id: number) => {
    setBusy(`sync-${id}`); setError(""); setToast("");
    const data = await post({ action: "sync", id });
    setBusy(null);
    if (data.error) { setError(data.error); return; }
    setToast(`Synced — embedded ${data.indexed}, skipped ${data.skipped} unchanged.`);
    load();
  };

  const remove = async (id: number) => {
    setBusy(`rm-${id}`); setError("");
    await post({ action: "remove", id });
    setBusy(null);
    load();
  };

  return (
    <div className="page-container">
      <div className="page-content animate-fade-in">
        <header className="page-header">
          <h1 className="page-title flex items-center gap-2"><Plug size={20} /> Connectors</h1>
          <p className="page-subtitle">
            Connect a folder and Rudder indexes it into your local memory — re-syncs only what changed. Everything stays on your machine.
          </p>
        </header>

        {/* Add a folder */}
        <div className="rounded-xl border p-4 mb-4" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-dim)" }}>
            Connect a folder
          </label>

          {/* Source type */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {([
              { k: "markdown" as Kind, label: "Markdown / Obsidian", icon: <BookText size={13} /> },
              { k: "files" as Kind, label: "Files (universal)", icon: <FileText size={13} /> },
              { k: "calendar" as Kind, label: "Calendar (.ics)", icon: <CalendarDays size={13} /> },
              { k: "contacts" as Kind, label: "Contacts (.vcf)", icon: <Users size={13} /> },
              { k: "health" as Kind, label: "Apple Health", icon: <HeartPulse size={13} /> },
              { k: "linkedin" as Kind, label: "LinkedIn", icon: <FileText size={13} /> },
              { k: "email" as Kind, label: "Email (.mbox)", icon: <FileText size={13} /> },
              { k: "meta" as Kind, label: "Meta (FB/IG)", icon: <FileText size={13} /> },
              { k: "twitter" as Kind, label: "X / Twitter", icon: <FileText size={13} /> },
              { k: "google" as Kind, label: "Google Takeout", icon: <FileText size={13} /> },
              { k: "photos" as Kind, label: "Photos", icon: <Image size={13} /> },
              { k: "chatgpt" as Kind, label: "ChatGPT export", icon: <MessagesSquare size={13} /> },
            ]).map(({ k, label, icon }) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                style={
                  kind === k
                    ? { background: "var(--color-accent-dim)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }
                    : { background: "var(--color-background)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
                }
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={
                kind === "files" ? "/Users/you/Documents"
                : kind === "calendar" ? "/Users/you/Downloads/calendar.ics"
                : kind === "contacts" ? "/Users/you/Downloads/contacts.vcf"
                : kind === "health" ? "/Users/you/apple_health_export/export.xml"
                : kind === "linkedin" ? "/Users/you/Downloads/Basic_LinkedInDataExport"
                : kind === "email" ? "/Users/you/Downloads/All mail.mbox"
                : kind === "meta" ? "/Users/you/Downloads/facebook-export"
                : kind === "twitter" ? "/Users/you/Downloads/twitter-archive"
                : kind === "google" ? "/Users/you/Downloads/Takeout"
                : kind === "photos" ? "/Users/you/Downloads/Takeout/Google Photos"
                : kind === "chatgpt" ? "/Users/you/Downloads/conversations.json"
                : "/Users/you/Documents/Notes"
              }
              className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: "var(--color-background)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
            />
            <button
              onClick={add}
              disabled={busy === "add" || !path.trim()}
              className="px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-opacity disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-background)" }}
            >
              {busy === "add" ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
              Connect
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--color-text-dim)" }}>
            {kind === "files"
              ? <>Indexes every supported file in the folder: {SUPPORTED}. Subfolders included; <code>node_modules</code>, <code>.git</code>, etc. skipped.</>
              : kind === "calendar"
              ? <>Point at an exported <code>.ics</code> file or a folder of them. Each event is indexed with its date and attendees.</>
              : kind === "contacts"
              ? <>Point at an exported <code>.vcf</code> file or a folder of them. Each contact becomes a person Rudder can recall.</>
              : kind === "health"
              ? <>Unzip your Health export and point at <code>export.xml</code>. Indexed as weekly per-metric summaries — nothing leaves your machine.</>
              : kind === "linkedin"
              ? <>Export your data (LinkedIn → Settings → Data Privacy → <em>Get a copy of your data</em>), unzip it, and point at the folder. Your Profile, Positions, Education &amp; Skills become memory — parsed locally, no scraping.</>
              : kind === "email"
              ? <>Export your mail (Google Takeout for Gmail, or your mail app&apos;s &ldquo;Export to mbox&rdquo;) and point at the <code>.mbox</code> file. Each message becomes memory — streamed locally, Spam/Trash skipped. For huge archives, export one focused label.</>
              : kind === "meta"
              ? <>Request your data in <strong>JSON</strong> (Facebook/Instagram → Settings → <em>Download your information</em>), unzip it, and point at the folder. Your posts and conversations become memory — parsed locally, no scraping.</>
              : kind === "twitter"
              ? <>Download your archive (X → Settings → <em>Download an archive of your data</em>), unzip it, and point at the folder. Your tweets &amp; DMs become memory — parsed locally; retweets skipped.</>
              : kind === "google"
              ? <>Export from <a href="https://takeout.google.com" target="_blank" rel="noreferrer">takeout.google.com</a> (pick <strong>JSON</strong>), unzip, and point at the Takeout folder. Search / YouTube / Chrome activity becomes one memory per day. (For contacts &amp; calendar, use those connectors on the exported files.)</>
              : kind === "photos"
              ? <>Export <strong>Google Photos</strong> via <a href="https://takeout.google.com" target="_blank" rel="noreferrer">takeout.google.com</a> (it includes a JSON next to each photo), unzip, and point at the <em>Google Photos</em> folder. Dates, places, captions &amp; tagged people become one memory per day — parsed locally, no images uploaded, no face model.</>
              : kind === "chatgpt"
              ? <>Point at your OpenAI data export <code>conversations.json</code>. Each conversation becomes searchable memory with cited turns.</>
              : <>Paste the full path to a folder on this computer. Subfolders are included; <code>node_modules</code>, <code>.git</code>, etc. are skipped.</>}
          </p>
          {error && <p className="text-[12px] mt-2" style={{ color: "var(--color-danger)" }}>{error}</p>}
          {toast && (
            <p className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: "var(--color-accent)" }}>
              <CheckCircle2 size={13} /> {toast}
            </p>
          )}
        </div>

        {/* Universal drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
          className="rounded-xl border border-dashed p-6 mb-6 text-center cursor-pointer transition-colors"
          style={{
            borderColor: dragging ? "var(--color-accent)" : "var(--color-border)",
            background: dragging ? "var(--color-accent-dim)" : "transparent",
          }}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
          {busy === "drop" ? (
            <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: "var(--color-accent)" }} />
          ) : (
            <UploadCloud size={20} className="mx-auto mb-2" style={{ color: "var(--color-text-dim)" }} />
          )}
          <p className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>
            {busy === "drop" ? "Ingesting…" : "Drop files here, or click to choose"}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-dim)" }}>
            One-off capture — parsed and indexed locally. {SUPPORTED}
          </p>
        </div>

        {/* Connected sources */}
        {connectors.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-dim)" }}>
            <Plug size={22} className="mx-auto mb-2" />
            <p className="text-[13px]">No sources connected yet. Add a folder above to start building your memory.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {connectors.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3.5"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>
                  <Plug size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{c.path}</div>
                  <div className="text-[11px]" style={{ color: "var(--color-text-dim)" }}>
                    {c.type} · {c.chunk_count} chunks · {c.last_sync ? `synced ${c.last_sync} UTC` : "never synced"}
                  </div>
                </div>
                <button onClick={() => sync(c.id)} disabled={busy === `sync-${c.id}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }} title="Re-sync">
                  {busy === `sync-${c.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
                <button onClick={() => remove(c.id)} disabled={busy === `rm-${c.id}`}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }} title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
