'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { InteractiveNetworkMesh } from './InteractiveNetworkMesh';
import { adaptBackendGraph, buildGraphFromFlows, ValidatedGraph } from '@/lib/graph-adapter';
import { getNetworkGraph, getFlows } from '@/lib/api';

interface NetworkMeshProps {
  mode?: 'traffic' | 'threat' | 'incident' | 'host';
  height?: number | string;
  showControls?: boolean;
  showMinimap?: boolean;
  highlightEntityId?: string;
  onNodeClick?: (nodeType: string, entityId: string) => void;
  onEdgeClick?: (source: string, target: string, data: unknown) => void;
  compact?: boolean;
}

export default function NetworkMesh({
  mode = 'threat',
  height = '100%',
  showControls = true,
  onNodeClick,
  onEdgeClick,
}: NetworkMeshProps) {
  const [rawGraph, setRawGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [flows, setFlows] = useState<any[]>([]);

  useEffect(() => {
    getNetworkGraph()
      .then((g) => setRawGraph(g))
      .catch(() => {
        getFlows().then((f) => setFlows(f)).catch(() => {});
      });
  }, []);

  const graph: ValidatedGraph = useMemo(() => {
    if (rawGraph.nodes && rawGraph.nodes.length > 0) {
      return adaptBackendGraph(rawGraph.nodes, rawGraph.edges);
    }
    return buildGraphFromFlows(flows);
  }, [rawGraph, flows]);

  return (
    <div className="w-full h-full min-h-[450px] relative bg-[#04060c]">
      <InteractiveNetworkMesh
        nodes={graph.nodes}
        edges={graph.edges}
        onSelectNode={(node) => onNodeClick?.(node.kind, node.id)}
        onSelectEdge={(edge) => onEdgeClick?.(edge.source, edge.target, edge)}
      />
    </div>
  );
}
