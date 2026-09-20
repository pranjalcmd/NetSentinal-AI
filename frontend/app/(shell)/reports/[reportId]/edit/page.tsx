'use client';

import React from 'react';
import { FileText, Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function EditReportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Q3 Network Security Assessment — Incident Report INC-2026-041</h1>
          <p className="text-xs text-slate-400">Author: Alex Morgan • Customer: Acme Financial Services</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Save className="w-3.5 h-3.5" /> Save Draft
          </Button>
          <Button variant="primary" size="sm">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100 border-b border-slate-800 pb-2">1. Executive Summary</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            During the Q3 Network Security Assessment for Acme Financial Services, PRISM detected anomalous outbound communications originating from workstation FIN-WS-014 (10.0.0.14). Continuous evidence collection via sensor SNS-042 preserved 684 MB of high-fidelity PCAP data (CAP-1050), corroborating periodic beaconing behavior to external IP 45.77.21.184.
          </p>
        </div>
      </div>
    </div>
  );
}
