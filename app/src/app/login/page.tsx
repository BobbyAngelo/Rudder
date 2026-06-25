"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Login — Sovereign Authentication Gate
   Minimal password-only login
   ═══════════════════════════════════════════════════════ */

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = "/";
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-background)" }}>
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black mx-auto mb-4"
            style={{
              background: "var(--color-accent-dim)",
              color: "var(--color-accent)",
              border: "1px solid rgba(52, 211, 153, 0.2)",
            }}
          >
            R
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Rudder
          </h1>
          <p className="text-[11px] font-mono mt-1" style={{ color: "var(--color-text-dim)" }}>
            Sovereign Operating System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-text-primary)",
                border: error ? "1px solid #ef4444" : "1px solid var(--color-border)",
              }}
            />
            {error && (
              <p className="text-[11px] mt-1.5 px-1" style={{ color: "#ef4444" }}>{error}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: "var(--color-accent)",
              color: "#000",
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Authenticate"}
          </button>
        </form>
      </div>
    </div>
  );
}
