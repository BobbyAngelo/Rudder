"use client";

import Link from "next/link";
import { Puzzle, Palette, Database, Info, Plug } from "lucide-react";
import { Card, CardBody } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div className="page-container">
      <div className="page-content space-y-8 animate-fade-in" style={{ maxWidth: 680 }}>

        <header className="space-y-1">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Settings
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Configure your Rudder experience.
          </p>
        </header>

        <div className="space-y-2">
          <SettingsLink
            href="/settings/connectors"
            icon={<Plug size={18} />}
            title="Connectors"
            description="Connect folders and sources to your local memory"
            color="#34d399"
          />
          <SettingsLink
            href="/settings/modules"
            icon={<Puzzle size={18} />}
            title="Modules"
            description="Enable or disable sections of Rudder"
            color="#60a5fa"
          />
          <SettingsLink
            href="/settings/personalization"
            icon={<Palette size={18} />}
            title="Personalization"
            description="Theme, accent color, fonts, and layout"
            color="#a78bfa"
            comingSoon
          />
          <SettingsLink
            href="/settings/integrations"
            icon={<Database size={18} />}
            title="Integrations & Connectors"
            description="Manage data sources, MCP servers, and AI routing"
            color="#60a5fa"
          />
          <SettingsLink
            href="/settings/about"
            icon={<Info size={18} />}
            title="About Rudder"
            description="Version info, changelog, and diagnostics"
            color="#94a3b8"
            comingSoon
          />
        </div>
      </div>
    </div>
  );
}

function SettingsLink({
  href,
  icon,
  title,
  description,
  color,
  comingSoon,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  comingSoon?: boolean;
}) {
  return (
    <Link href={comingSoon ? "#" : href}>
      <Card>
        <CardBody className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${color}15`,
              color,
            }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[13px] font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {title}
              </span>
              {comingSoon && (
                <span
                  className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(148, 163, 184, 0.1)", color: "#94a3b8" }}
                >
                  soon
                </span>
              )}
            </div>
            <span
              className="text-[11px]"
              style={{ color: "var(--color-text-dim)" }}
            >
              {description}
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
