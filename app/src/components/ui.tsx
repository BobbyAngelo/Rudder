import { type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════
   PageHeader — Standard page header for all sections.
   Every page in Rudder should use this for consistency.
   ═══════════════════════════════════════════════════════ */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-header flex items-start justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/* ═══════════════════════════════════════════════════════
   Card — The universal container component.
   All content blocks in Rudder should use this.
   ═══════════════════════════════════════════════════════ */

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = "", hover = true, onClick }: CardProps) {
  return (
    <div
      className={`card ${hover ? "" : "hover:bg-surface hover:border-border"} ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
}

export function CardHeader({ children }: CardHeaderProps) {
  return <div className="card-header">{children}</div>;
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════
   StatCard — Metric display card with label + value.
   ═══════════════════════════════════════════════════════ */

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
}

export function StatCard({ label, value, subtitle, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between mb-4">
          {icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: color ? `${color}15` : "var(--color-accent-dim)",
                color: color || "var(--color-accent)",
              }}
            >
              {icon}
            </div>
          )}
          <span className="section-label">{label}</span>
        </div>
        <div className="stat-value">{value}</div>
        {subtitle && <div className="stat-label">{subtitle}</div>}
      </CardBody>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
   Badge — Inline status indicator.
   ═══════════════════════════════════════════════════════ */

interface BadgeProps {
  children: ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
}

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return <span className={`badge-base badge-${variant}`}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════
   EmptyState — Shown when a section has no data yet.
   ═══════════════════════════════════════════════════════ */

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {icon && (
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{
            background: "var(--color-surface-elevated)",
            color: "var(--color-text-muted)",
          }}
        >
          {icon}
        </div>
      )}
      <h3
        className="text-sm font-medium mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h3>
      {description && (
        <p className="text-xs max-w-xs" style={{ color: "var(--color-text-dim)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
