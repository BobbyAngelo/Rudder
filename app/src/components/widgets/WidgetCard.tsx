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
      className={`relative rounded-2xl flex flex-col overflow-hidden transition-all duration-300 glass-panel glow-card ${className}`}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255, 255, 255, 0.04)" }}>
          {icon && <span style={{ color: "var(--color-text-dim)" }}>{icon}</span>}
          {title && <h3 className="text-[12px] font-semibold uppercase tracking-wider font-sans" style={{ color: "var(--color-text-primary)" }}>{title}</h3>}
          {loading && <Loader2 size={12} className="animate-spin ml-auto" style={{ color: "var(--color-text-dim)" }} />}
        </div>
      )}
      <div className="flex-1 p-5 relative overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
