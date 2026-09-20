'use client';

import React, { useState } from 'react';
import { Upload, FileCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function UploadPCAPPage() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Upload Offline PCAP File</h1>
        <p className="text-xs text-slate-400">Drag & drop raw packet capture files for deep forensic analysis</p>
      </div>

      <div className="p-10 border-2 border-dashed border-slate-800 hover:border-blue-500/60 bg-slate-900/60 rounded-xl text-center space-y-4 transition-colors">
        <div className="p-4 bg-slate-800/60 rounded-full w-fit mx-auto text-blue-400">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-200">Drag & drop your PCAP file here</h3>
          <p className="text-xs text-slate-500 mt-1">Supports `.pcap`, `.pcapng`, `.cap` (Max 10 GB)</p>
        </div>
        <Button variant="outline" size="sm">
          Browse Files
        </Button>
      </div>
    </div>
  );
}
