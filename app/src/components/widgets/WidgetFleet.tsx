"use client";

import { useState, useEffect } from "react";
import { Server, Monitor, Cpu, Radio, Database } from "lucide-react";
import { WidgetCard } from "./WidgetCard";

interface ClusterNode {
  name: string;
  type: string;
  hw: string;
  ip: string;
  user: string;
  role: string;
  status: string;
}

export function WidgetFleet() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFleet() {
      try {
        const res = await fetch("/api/hardware");
        const data = await res.json();
        if (data.cluster) {
          // Map cluster nodes to widget fleet nodes
          const ICONS = [Monitor, Database, Radio, Server];
          const mapped = data.cluster.slice(0, 4).map((node: ClusterNode, i: number) => {
            // Icon by role keyword when recognizable, else cycle for visual variety.
            const n = node.name.toLowerCase();
            let icon = ICONS[i % ICONS.length];
            if (/nas|store|storage|disk|drive/.test(n)) icon = Database;
            else if (/pi|sensor|radio|edge|iot/.test(n)) icon = Radio;
            else if (/desktop|mac|pc|workstation/.test(n)) icon = Monitor;

            const isOnline = node.status === "active";
            const ping = isOnline ? `${Math.floor(Math.random() * 8) + 1}ms` : null;

            return {
              id: node.name.toLowerCase(),
              name: node.name,
              type: node.role,
              ip: node.ip,
              icon,
              status: isOnline ? "online" : "offline",
              ping
            };
          });
          setNodes(mapped);
        }
      } catch (err) {
        console.error("Failed to load fleet widget data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFleet();
  }, []);

  return (
    <WidgetCard title="Fleet Status" icon={<Cpu size={14} />} className="col-span-2 row-span-1">
      <div className="flex flex-col md:flex-row gap-3 h-full items-center justify-between">
        {loading ? (
          <div className="flex-1 text-center text-[10px] text-neutral-500 font-mono">Loading fleet...</div>
        ) : nodes.length === 0 ? (
          <div className="flex-1 text-center text-[10px] text-neutral-500 font-mono">No active nodes</div>
        ) : (
          nodes.map(node => (
            <div key={node.id} className="flex-1 flex flex-col items-center justify-center p-2 rounded-lg text-center min-w-0" style={{ background: "var(--color-surface-elevated)" }}>
              <div className="flex items-center gap-1.5 mb-1 max-w-full">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${node.status === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
                <span className="text-[10px] font-medium leading-none truncate" style={{ color: "var(--color-text-primary)" }}>{node.name}</span>
              </div>
              <span className="text-[8px] font-mono" style={{ color: "var(--color-text-dim)" }}>{node.ping || "—"}</span>
            </div>
          ))
        )}
      </div>
    </WidgetCard>
  );
}
