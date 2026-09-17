'use client';

import React, { useEffect, useState } from 'react';
import { getEvidence } from '@/lib/mock/services';
import type { Evidence } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { ShieldCheck } from 'lucide-react';

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  useEffect(() => {
    getEvidence().then(setEvidence);
  }, []);

  const columns = [
    { key: 'id', header: 'ID', mono: true },
    { key: 'type', header: 'Evidence Type' },
    { key: 'source', header: 'Source' },
    { key: 'hash', header: 'SHA-256 Hash', mono: true },
    { key: 'integrity', header: 'Integrity', render: (val: any) => <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Verified</span> }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" /> Evidence Vault & Chain of Custody
        </h1>
        <p className="text-xs text-slate-400">Cryptographically verified forensic artifacts</p>
      </div>

      <DataTable data={evidence} columns={columns} />
    </div>
  );
}
