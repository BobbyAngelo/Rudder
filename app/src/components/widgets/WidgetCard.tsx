import React from "react";
import { Loader2 } from "lucide-react";

interface WidgetCardProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function WidgetCard({ title, icon, children, className = "", loading = false }: WidgetCardProps) {
  return (
    <div 
      className={`relative rounded-2xl flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg ${className}`}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.02)"
      }}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          {icon && <span style={{ color: "var(--color-text-dim)" }}>{icon}</span>}
          {title && <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-primary)" }}>{title}</h3>}
          {loading && <Loader2 size={12} className="animate-spin ml-auto" style={{ color: "var(--color-text-dim)" }} />}
        </div>
      )}
      <div className="flex-1 p-5 relative overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
