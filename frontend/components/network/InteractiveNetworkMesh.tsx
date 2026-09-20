'use client';

import React, { useMemo, useState } from 'react';
import type { RenderGraphNode, RenderGraphEdge } from '@/lib/graph-adapter';

/**
 * Chord layout over the analysed capture.
 *
 * Internal and service addresses sit on the left arc, external destinations on
 * the right, so every edge reads as one crossing of the perimeter. The layout
 * is deterministic — sorted by kind then risk — so the same capture always
 * draws the same picture and a node keeps its place across refreshes.
 *
 * Labels are the expensive thing on screen, not the geometry: a few hundred IPs
 * drawn at once is what turns the graph into a hairball. Only the hovered or
 * selected node and its direct neighbours are named; everything else stays a
 * dot until asked about.
 */

const VIEW_W = 1000;
const VIEW_H = 680;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const R = 268;

const SEV_STROKE: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  info: '#3f4657',
  live: '#2f6f68',
};

type Placed = RenderGraphNode & { px: number; py: number; angle: number };

export interface InteractiveNetworkMeshProps {
  nodes: RenderGraphNode[];
  edges: RenderGraphEdge[];
  onSelectNode?: (node: RenderGraphNode) => void;
  onSelectEdge?: (edge: RenderGraphEdge) => void;
  /** Busiest-first cap. The rest are counted on screen, never silently dropped. */
  maxNodes?: number;
}

function place(nodes: RenderGraphNode[], from: number, to: number): Placed[] {
  return nodes.map((node, i) => {
    // A lone node sits mid-arc rather than at its start.
    const t = nodes.length === 1 ? 0.5 : i / (nodes.length - 1);
    const angle = (from + (to - from) * t) * (Math.PI / 180);
    return {
      ...node,
      angle,
      px: CX + Math.cos(angle) * R,
      py: CY + Math.sin(angle) * R,
    };
  });
}

export function InteractiveNetworkMesh({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  maxNodes = 48,
}: InteractiveNetworkMeshProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const { placed, byId, shownEdges, hiddenNodes } = useMemo(() => {
    const weight = (n: RenderGraphNode) => n.risk * 1000 + n.flow_count;
    const ranked = [...nodes].sort((a, b) => weight(b) - weight(a));
    const kept = ranked.slice(0, maxNodes);
    const keptIds = new Set(kept.map((n) => n.id));

    const left = kept
      .filter((n) => n.kind === 'internal' || n.kind === 'service')
      .sort((a, b) => weight(b) - weight(a));
    const right = kept
      .filter((n) => n.kind === 'external' || n.kind === 'unknown')
      .sort((a, b) => weight(b) - weight(a));

    // Left arc runs down the left side, right arc up the right side, so the
    // highest-risk node of each group lands nearest the horizontal centre line.
    const positioned = [...place(left, 110, 250), ...place(right, 70, -70)];
    const map = new Map(positioned.map((n) => [n.id, n]));

    return {
      placed: positioned,
      byId: map,
      shownEdges: edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target)),
      hiddenNodes: nodes.length - kept.length,
    };
  }, [nodes, edges, maxNodes]);

  const active = hovered ?? pinned;

  const neighbours = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    for (const e of shownEdges) {
      if (e.source === active) set.add(e.target);
      else if (e.target === active) set.add(e.source);
    }
    return set;
  }, [active, shownEdges]);

  if (placed.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-500 font-mono text-xs">
        <div className="w-10 h-10 rounded-full border border-white/10" />
        <span>No connections in this capture</span>
      </div>
    );
  }

  const nodeOpacity = (id: string) => (neighbours && !neighbours.has(id) ? 0.12 : 1);

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox={'0 0 ' + VIEW_W + ' ' + VIEW_H}
        className="w-full h-full"
        role="img"
        aria-label={placed.length + ' addresses, ' + shownEdges.length + ' connections'}
      >
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#12161f" strokeWidth={1} />

        <g>
          {shownEdges.map((edge) => {
            const a = byId.get(edge.source);
            const b = byId.get(edge.target);
            if (!a || !b) return null; // invariant: an edge never invents a node
            const lit = !neighbours || neighbours.has(edge.source) || neighbours.has(edge.target);
            const flagged = edge.severity !== 'live' && edge.severity !== 'info';
            return (
              <line
                key={edge.id}
                x1={a.px}
                y1={a.py}
                x2={b.px}
                y2={b.py}
                stroke={SEV_STROKE[edge.severity] ?? SEV_STROKE.info}
                strokeWidth={lit && neighbours ? 1.4 : flagged ? 1 : 0.7}
                opacity={lit ? (flagged ? 0.7 : 0.28) : 0.05}
                className="cursor-pointer"
                onClick={() => onSelectEdge?.(edge)}
              />
            );
          })}
        </g>

        <g>
          {placed.map((node) => {
            const size = 4 + Math.min(node.flow_count, 24) * 0.28;
            const isActive = active === node.id;
            const toRight = Math.cos(node.angle) >= 0;
            const select = () => {
              setPinned(node.id === pinned ? null : node.id);
              onSelectNode?.(node);
            };
            return (
              <g
                key={node.id}
                opacity={nodeOpacity(node.id)}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={select}
                tabIndex={0}
                role="button"
                aria-label={node.label + ', ' + node.kind + ', risk ' + node.risk}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    select();
                  }
                }}
              >
                {isActive && (
                  <circle
                    cx={node.px}
                    cy={node.py}
                    r={size + 6}
                    fill="none"
                    stroke={node.severityColor}
                    strokeWidth={1}
                    opacity={0.5}
                  />
                )}
                <circle
                  cx={node.px}
                  cy={node.py}
                  r={size}
                  fill={node.risk > 0 ? node.severityColor : '#0b1016'}
                  stroke={node.risk > 0 ? node.severityColor : '#3a4455'}
                  strokeWidth={1.2}
                />
                {/* Naming every node is what made this a hairball; name on demand. */}
                {neighbours?.has(node.id) && (
                  <text
                    x={node.px + (toRight ? size + 7 : -(size + 7))}
                    y={node.py + 3}
                    textAnchor={toRight ? 'start' : 'end'}
                    className="font-mono"
                    fontSize={11}
                    fill={isActive ? '#e4e8ee' : '#7c8798'}
                  >
                    {node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute left-4 bottom-4 flex items-center gap-4 font-mono text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border border-zinc-600" /> internal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> at risk
        </span>
        <span>
          {placed.length} shown
          {hiddenNodes > 0 ? ' · ' + hiddenNodes + ' quieter hidden' : ''}
        </span>
      </div>

      {!active && (
        <div className="absolute right-4 bottom-4 font-mono text-[10px] text-zinc-600">
          hover a node to name it
        </div>
      )}
    </div>
  );
}

export default InteractiveNetworkMesh;
