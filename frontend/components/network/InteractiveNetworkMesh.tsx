'use client';

import React, { useState } from 'react';
import { RenderGraphNode, RenderGraphEdge } from '@/lib/graph-adapter';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface NetworkMeshProps {
  nodes: RenderGraphNode[];
  edges: RenderGraphEdge[];
  onSelectNode?: (node: RenderGraphNode) => void;
  onSelectEdge?: (edge: RenderGraphEdge) => void;
}

export function InteractiveNetworkMesh({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
}: NetworkMeshProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<RenderGraphNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<RenderGraphEdge | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.4));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setPinnedNodeId(null); };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="relative w-full h-full bg-[#04060c] overflow-hidden select-none font-mono">
      
      {/* Mesh Controls Toolbar (PRD Section 4) */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900/90 border border-white/10 text-xs">
        <button onClick={handleZoomIn} className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded" title="Zoom In">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleZoomOut} className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded" title="Zoom Out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleReset} className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded" title="Fit to Screen">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SVG Canvas Viewport */}
      <svg
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox="-450 -300 900 600"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease-out',
        }}
      >
        {/* Background Grid Pattern */}
        <defs>
          <pattern id="meshGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="-600" y="-400" width="1200" height="800" fill="url(#meshGrid)" />

        {/* Render Graph Edges */}
        {edges.map((edge) => {
          const src = nodeMap.get(edge.source);
          const dst = nodeMap.get(edge.target);
          if (!src || !dst) return null;

          const isHovered = hoveredEdge?.id === edge.id;
          const isHighlighted = pinnedNodeId ? edge.source === pinnedNodeId || edge.target === pinnedNodeId : true;

          return (
            <g key={edge.id} className="cursor-pointer">
              <line
                x1={src.x || 0}
                y1={src.y || 0}
                x2={dst.x || 0}
                y2={dst.y || 0}
                stroke={edge.severityColor}
                strokeWidth={isHovered ? 4 : isHighlighted ? 2 : 0.8}
                strokeOpacity={isHighlighted ? 0.75 : 0.15}
                onMouseEnter={() => setHoveredEdge(edge)}
                onMouseLeave={() => setHoveredEdge(null)}
                onClick={() => onSelectEdge?.(edge)}
              />
            </g>
          );
        })}

        {/* Render Graph Nodes */}
        {nodes.map((node) => {
          const isPinned = pinnedNodeId === node.id;
          const isHovered = hoveredNode?.id === node.id;
          const isDimmed = pinnedNodeId && !isPinned;

          const cx = node.x || 0;
          const cy = node.y || 0;
          const r = node.kind === 'internal' ? 10 : node.kind === 'service' ? 14 : 12;

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={() => {
                setPinnedNodeId(node.id);
                onSelectNode?.(node);
              }}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              opacity={isDimmed ? 0.35 : 1}
            >
              {/* Node Outer Halo */}
              {(isPinned || isHovered) && (
                <circle cx={cx} cy={cy} r={r * 1.8} fill={node.severityColor} fillOpacity="0.25" stroke={node.severityColor} strokeWidth="1.5" />
              )}

              {/* Node Core Circle */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={node.severityColor}
                fillOpacity="0.9"
                stroke="#04060c"
                strokeWidth="2"
              />

              {/* Node Label */}
              <text
                x={cx}
                y={cy + r + 14}
                textAnchor="middle"
                fill={isPinned ? '#ffffff' : '#a1a1aa'}
                fontSize="10"
                fontWeight={isPinned ? 'bold' : 'normal'}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Edge Hover Tooltip (PRD Section 4) */}
      {hoveredEdge && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 p-3 rounded-xl bg-black/95 border border-[#3DD9C4]/40 text-xs shadow-2xl space-y-1 pointer-events-none">
          <div className="font-bold text-white flex items-center justify-between gap-4">
            <span>{hoveredEdge.source} ➔ {hoveredEdge.target}</span>
            <span className="text-[#3DD9C4] uppercase">{hoveredEdge.severity}</span>
          </div>
          <div className="text-[#a1a1aa] text-[11px] grid grid-cols-3 gap-3 pt-1 border-t border-white/10">
            <div>App: <span className="text-white">{hoveredEdge.application}</span></div>
            <div>Volume: <span className="text-white">{(hoveredEdge.bytes / 1024).toFixed(1)} KB</span></div>
            <div>Packets: <span className="text-white">{hoveredEdge.packets}</span></div>
          </div>
        </div>
      )}

      {/* Node Kind Legend (PRD Section 4) */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-4 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-white/10 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3DD9C4]" /> Internal</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Service</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> External</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Critical Risk</div>
      </div>
    </div>
  );
}
