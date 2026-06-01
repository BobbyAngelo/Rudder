"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Workflow, Search, Filter } from "lucide-react";

// Force-graph requires window/canvas, must disable SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-[var(--color-text-dim)]">Loading Graph Engine...</div>
});

export default function KnowledgeGraphPage() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<any>(null);

  useEffect(() => {
    // Resize handler
    const updateDimensions = () => {
      const container = document.getElementById("graph-container");
      if (container) {
        setDimensions({ width: container.clientWidth, height: container.clientHeight });
      }
    };
    
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    
    // Fetch data
    fetch("/api/graph")
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });

    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden page-container animate-fade-in" style={{ padding: 0 }}>
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/40 backdrop-blur-md" style={{ color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
            <Workflow size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold drop-shadow-md" style={{ color: "var(--color-text-primary)" }}>Knowledge Graph</h1>
            <p className="text-[12px] drop-shadow-md" style={{ color: "var(--color-text-dim)" }}>
              {data.nodes.length} nodes, {data.links.length} edges
            </p>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/40 backdrop-blur-md transition-colors hover:bg-black/60" style={{ color: "var(--color-text-dim)", border: "1px solid var(--color-border)" }}>
            <Search size={16} />
          </button>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/40 backdrop-blur-md transition-colors hover:bg-black/60" style={{ color: "var(--color-text-dim)", border: "1px solid var(--color-border)" }}>
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* Graph Container */}
      <div id="graph-container" className="flex-1 bg-black relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-dim)] font-mono text-[12px] uppercase tracking-wider">
            Initializing Holographic Array...
          </div>
        ) : (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={data}
            nodeLabel="label"
            nodeColor="color"
            nodeRelSize={4}
            linkColor={() => "rgba(255,255,255,0.1)"}
            linkWidth={1.5}
            onNodeHover={setHoverNode}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.label;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

              ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
              ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = node.color;
              ctx.fillText(label, node.x, node.y);

              node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
            }}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color;
              const bckgDimensions = node.__bckgDimensions;
              bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
            }}
          />
        )}
      </div>

      {/* Hover Info Panel */}
      {hoverNode && (
        <div className="absolute bottom-6 left-6 z-10 w-64 p-4 rounded-xl bg-black/60 backdrop-blur-md pointer-events-none transition-all" style={{ border: "1px solid var(--color-border)" }}>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: hoverNode.color }}>
            {hoverNode.type}
          </div>
          <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {hoverNode.label}
          </div>
        </div>
      )}
    </div>
  );
}
