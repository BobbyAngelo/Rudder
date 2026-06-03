"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════
   Orbit Ring — The Star of the Show
   
   A radial visualization showing active modules as dots
   orbiting around a central Reality Ledger count.
   Pure CSS/SVG — zero dependencies.
   ═══════════════════════════════════════════════════════ */

interface OrbitDot {
  label: string;
  color: string;
  angle: number;  // Starting angle in degrees
}

const MODULE_DOTS: OrbitDot[] = [
  { label: "Identity",  color: "#f59e0b", angle: 0 },
  { label: "Health",    color: "#34d399", angle: 60 },
  { label: "Writing",   color: "#a78bfa", angle: 120 },
  { label: "Tasks",     color: "#3b82f6", angle: 180 },
  { label: "People",    color: "#f472b6", angle: 240 },
  { label: "Media",     color: "#f97316", angle: 300 },
];

export function OrbitRing({ ledgerCount }: { ledgerCount: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const size = 240;
  const center = size / 2;
  const orbitRadius = 90;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      
      {/* Emerald glow behind everything */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 65%)",
        }}
      />

      {/* Orbit track */}
      <svg width={size} height={size} className="absolute inset-0" style={{ animation: "orbitSpin 90s linear infinite" }}>
        {/* Track circle */}
        <circle
          cx={center}
          cy={center}
          r={orbitRadius}
          fill="none"
          stroke="rgba(52,211,153,0.06)"
          strokeWidth="1"
        />
        
        {/* Module dots */}
        {MODULE_DOTS.map((dot, i) => {
          const rad = (dot.angle * Math.PI) / 180;
          const x = center + orbitRadius * Math.cos(rad);
          const y = center + orbitRadius * Math.sin(rad);
          
          return (
            <g key={dot.label}>
              {/* Glow */}
              <circle cx={x} cy={y} r="8" fill={dot.color} opacity="0.08" />
              {/* Dot */}
              <circle
                cx={x}
                cy={y}
                r="3.5"
                fill={dot.color}
                opacity={mounted ? 1 : 0}
                style={{
                  transition: `opacity 0.5s ease ${i * 0.1}s`,
                  filter: `drop-shadow(0 0 4px ${dot.color})`,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <span
          className="text-[28px] font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-primary)",
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.6s ease 0.3s",
          }}
        >
          {mounted ? ledgerCount.toLocaleString() : "—"}
        </span>
        <span
          className="text-[9px] font-mono uppercase tracking-[0.15em]"
          style={{ color: "var(--color-text-dim)" }}
        >
          Memory
        </span>
      </div>

      {/* Inner orbit CSS animation */}
      <style jsx>{`
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
