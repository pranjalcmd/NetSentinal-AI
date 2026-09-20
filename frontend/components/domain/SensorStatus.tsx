'use client';

import React from 'react';
import type { SensorStatus as StatusType } from '@/lib/types';

export function SensorStatus({ status }: { status: StatusType }) {
  const colors = {
    online: "bg-emerald-500 text-emerald-400",
    degraded: "bg-amber-500 text-amber-400",
    offline: "bg-red-500 text-red-400"
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full animate-pulse ${colors[status].split(' ')[0]}`} />
      <span className={`capitalize ${colors[status].split(' ')[1]}`}>{status}</span>
    </span>
  );
}
