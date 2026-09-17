'use client';

import React from 'react';
import NetworkMesh from '@/components/network/NetworkMesh';

// The mesh renders real hosts, external destinations and incident
// correlations from the analysis backend (see components/network/liveMesh.ts).
export default function NetworkMeshPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#0A0E14] text-[#E4E8EE]">
      <div className="p-4 border-b border-[#1E293B] bg-[#0d1117]">
        <h1 className="text-lg font-semibold text-[#E4E8EE] m-0">Network Graph</h1>
        <p className="text-xs text-[#8b98ab] mt-1 mb-0">
          Hosts, external destinations and correlated incidents from the analysed capture.
        </p>
      </div>

      <div className="relative flex-1 w-full h-full bg-[#0A0E14]">
        <NetworkMesh height="100%" showControls={true} showMinimap={true} />
      </div>
    </div>
  );
}
