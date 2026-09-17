'use client';

import React from 'react';
import { ScrollText } from 'lucide-react';

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-blue-400" /> Platform Security Audit Log
        </h1>
      </div>
    </div>
  );
}
