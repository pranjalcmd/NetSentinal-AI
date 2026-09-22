'use client';

import React from 'react';
import Link from 'next/link';
import { Upload, HardDrive, ShieldCheck } from 'lucide-react';

export default function NewInvestigationPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Start New Forensic Investigation</h1>
        <p className="text-xs text-slate-400">Select source network evidence to execute DPI & AI pipeline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/investigations/new/upload" className="p-6 bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl space-y-4 text-left transition-colors group">
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg w-fit group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Offline PCAP File Upload</h3>
            <p className="text-xs text-slate-400 mt-1">Upload `.pcap` or `.pcapng` files up to 10GB for offline deep packet inspection.</p>
          </div>
        </Link>

        <Link href="/captures" className="p-6 bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded-xl space-y-4 text-left transition-colors group">
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Preserved Sensor Capture</h3>
            <p className="text-xs text-slate-400 mt-1">Select an existing auto-preserved capture (e.g. CAP-1050) from sensor fleet storage.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
