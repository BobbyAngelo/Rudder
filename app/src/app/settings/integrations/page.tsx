"use client";

import { useState, useEffect, useCallback } from "react";
import {
  HardDrive, Server, Cpu, Plus, Settings, CheckCircle2, ChevronLeft,
  X, Trash2, FolderOpen, Terminal, ChevronDown,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui";
import Link from "next/link";

const EXECUTION_MODES = [
  { value: "local_ollama", label: "Local Ollama", dot: "bg-emerald-400" },
  { value: "local_exo", label: "Exo Cluster", dot: "bg-teal-400" },
  { value: "cloud_gemini", label: "Gemini Ultra", dot: "bg-blue-400" },
  { value: "cloud_openai", label: "OpenAI", dot: "bg-violet-400" },
  { value: "disabled", label: "Disabled", dot: "bg-gray-500" },
];

const SOURCE_TYPES = [
  { value: "folder", label: "Local Folder", icon: FolderOpen },
  { value: "drive", label: "External Drive", icon: HardDrive },
  { value: "healthkit_export", label: "Apple Health Export", icon: CheckCircle2 },
];

export default function IntegrationsPage() {
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [executionMode, setExecutionMode] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSource, setShowAddSource] = useState(false);
  const [showAddMcp, setShowAddMcp] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((data) => {
        setDataSources(data.data_sources || []);
        setMcpServers(data.mcp_servers || []);
        setExecutionMode(data.execution);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function deleteItem(table: string, id: number) {
    await fetch(`/api/integrations?table=${table}&id=${id}`, { method: "DELETE" });
    refresh();
  }

  async function updateExecution(field: string, value: string) {
    await fetch("/api/integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    refresh();
  }

  return (
    <div className="page-container">
      <div className="page-content space-y-8 animate-fade-in" style={{ maxWidth: 720 }}>
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Integrations
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Data sources, MCP servers, and AI execution routing.
            </p>
          </div>
        </div>

        {/* ── AI Execution Mode ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Cpu size={18} className="text-purple-400" />
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">AI Execution Mode</h2>
          </div>
          <Card>
            <CardBody className="space-y-4">
              <ExecutionRow
                label="Default Model"
                sub="Where tasks run by default"
                value={executionMode?.default_execution_mode || "local_ollama"}
                onChange={(v) => updateExecution("default_execution_mode", v)}
              />
              <div className="h-px bg-[var(--color-border-subtle)]" />
              <ExecutionRow
                label="Fallback Model"
                sub="If local compute is unavailable"
                value={executionMode?.fallback_execution_mode || "cloud_gemini"}
                onChange={(v) => updateExecution("fallback_execution_mode", v)}
              />
            </CardBody>
          </Card>
        </section>

        {/* ── Local Data Sources ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-emerald-400" />
              <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Local Data Sources</h2>
            </div>
            <button onClick={() => setShowAddSource(true)} className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-dim)] transition-colors">
              <Plus size={14} /> Add Source
            </button>
          </div>
          {isLoading ? (
            <div className="text-sm text-[var(--color-text-muted)] px-1">Loading...</div>
          ) : dataSources.length === 0 ? (
            <Card hover={false}>
              <CardBody className="py-8 text-center flex flex-col items-center">
                <HardDrive size={24} className="text-[var(--color-text-dim)] mb-3" />
                <div className="text-[13px] text-[var(--color-text-primary)] font-medium mb-1">No data sources connected</div>
                <div className="text-[11px] text-[var(--color-text-muted)] max-w-xs">
                  Connect local folders or drives to feed the Reality Ledger.
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-2">
              {dataSources.map((s: any) => (
                <Card key={s.id}>
                  <CardBody className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-[var(--color-background-elevated)] flex items-center justify-center text-[var(--color-text-muted)]">
                        <HardDrive size={16} />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                          {s.name}
                          {s.status === "active" && <CheckCircle2 size={12} className="text-emerald-400" />}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)] font-mono flex flex-col gap-0.5">
                          <span>{s.path}</span>
                          {s.last_scanned && (
                            <span className="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider mt-0.5">
                              Last Scan: {new Date(s.last_scanned).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => deleteItem("data_sources", s.id)} className="text-[var(--color-text-dim)] hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── MCP Servers ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-blue-400" />
              <h2 className="text-sm font-medium text-[var(--color-text-primary)]">External MCP Servers</h2>
            </div>
            <button onClick={() => setShowAddMcp(true)} className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-dim)] transition-colors">
              <Plus size={14} /> Add Server
            </button>
          </div>
          {isLoading ? (
            <div className="text-sm text-[var(--color-text-muted)] px-1">Loading...</div>
          ) : mcpServers.length === 0 ? (
            <Card hover={false}>
              <CardBody className="py-8 text-center flex flex-col items-center">
                <Server size={24} className="text-[var(--color-text-dim)] mb-3" />
                <div className="text-[13px] text-[var(--color-text-primary)] font-medium mb-1">No MCP servers connected</div>
                <div className="text-[11px] text-[var(--color-text-muted)] max-w-xs">
                  Add third-party MCP servers to extend your AI capabilities.
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-2">
              {mcpServers.map((srv: any) => (
                <Card key={srv.id}>
                  <CardBody className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-[var(--color-background-elevated)] flex items-center justify-center text-[var(--color-text-muted)]">
                        <Terminal size={16} />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-[var(--color-text-primary)]">{srv.name}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
                          {srv.command} {srv.args?.join(" ")}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => deleteItem("mcp_servers", srv.id)} className="text-[var(--color-text-dim)] hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Add Source Modal ── */}
      {showAddSource && (
        <AddSourceModal onClose={() => setShowAddSource(false)} onSaved={refresh} />
      )}

      {/* ── Add MCP Modal ── */}
      {showAddMcp && (
        <AddMcpModal onClose={() => setShowAddMcp(false)} onSaved={refresh} />
      )}
    </div>
  );
}

/* ── Execution Row with dropdown ── */
function ExecutionRow({ label, sub, value, onChange }: {
  label: string; sub: string; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = EXECUTION_MODES.find((m) => m.value === value) || EXECUTION_MODES[0];

  return (
    <div className="flex items-center justify-between relative">
      <div>
        <div className="text-[13px] font-medium text-[var(--color-text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">{sub}</div>
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-[12px] bg-[var(--color-background-elevated)] border border-[var(--color-border-subtle)] px-3 py-1.5 rounded-md hover:border-[var(--color-text-dim)] transition-colors"
        >
          <span className={"w-2 h-2 rounded-full " + current.dot}></span>
          {current.label}
          <ChevronDown size={12} className="text-[var(--color-text-dim)]" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg overflow-hidden shadow-lg border border-[var(--color-border-subtle)]" style={{ background: "var(--color-surface)" }}>
            {EXECUTION_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => { onChange(m.value); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-[var(--color-background-elevated)] transition-colors"
                style={{ color: m.value === value ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
              >
                <span className={"w-2 h-2 rounded-full " + m.dot}></span>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Add Source Modal ── */
function AddSourceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [sourceType, setSourceType] = useState("folder");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "data_source", name: name.trim(), path: path.trim(), source_type: sourceType }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setSaving(false); return; }
      onSaved();
      onClose();
    } catch { setError("Failed to save"); setSaving(false); }
  }

  return (
    <ModalShell title="Add Data Source" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FieldGroup label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Photos Drive" autoFocus className="modal-input" />
        </FieldGroup>
        <FieldGroup label="Absolute Path">
          <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/Volumes/Drive or /Users/..." className="modal-input font-mono text-[12px]" />
        </FieldGroup>
        <FieldGroup label="Source Type">
          <div className="flex gap-2">
            {SOURCE_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setSourceType(t.value)}
                className={"flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] border transition-colors " + (sourceType === t.value ? "border-[var(--color-accent)] text-[var(--color-text-primary)] bg-[var(--color-surface-elevated)]" : "border-[var(--color-border-subtle)] text-[var(--color-text-dim)]")}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>
        </FieldGroup>
        {error && <div className="text-[11px] text-red-400">{error}</div>}
        <button type="submit" disabled={saving || !name.trim() || !path.trim()} className="w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30" style={{ background: "var(--color-accent)", color: "#000" }}>
          {saving ? "Saving..." : "Add Source"}
        </button>
      </form>
    </ModalShell>
  );
}

/* ── Add MCP Modal ── */
function AddMcpModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("npx");
  const [args, setArgs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "mcp_server",
          name: name.trim(),
          command: command.trim(),
          args: args.trim().split(/\s+/).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setSaving(false); return; }
      onSaved();
      onClose();
    } catch { setError("Failed to save"); setSaving(false); }
  }

  return (
    <ModalShell title="Add MCP Server" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FieldGroup label="Server Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Filesystem MCP" autoFocus className="modal-input" />
        </FieldGroup>
        <FieldGroup label="Command">
          <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" className="modal-input font-mono text-[12px]" />
        </FieldGroup>
        <FieldGroup label="Arguments (space-separated)">
          <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem /Users/..." className="modal-input font-mono text-[12px]" />
        </FieldGroup>
        {error && <div className="text-[11px] text-red-400">{error}</div>}
        <button type="submit" disabled={saving || !name.trim() || !command.trim()} className="w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30" style={{ background: "var(--color-accent)", color: "#000" }}>
          {saving ? "Saving..." : "Add Server"}
        </button>
      </form>
    </ModalShell>
  );
}

/* ── Shared Modal Shell ── */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 space-y-5 animate-fade-in shadow-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Field wrapper ── */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-dim)]">{label}</label>
      {children}
    </div>
  );
}
