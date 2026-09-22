'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Download, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReportDraft {
  title: string;
  author: string;
  customer: string;
  summary: string;
}

const DEFAULT_DRAFT: ReportDraft = {
  title: 'Q3 Network Security Assessment — Incident Report INC-2026-041',
  author: 'Alex Morgan',
  customer: 'Acme Financial Services',
  summary:
    'During the Q3 Network Security Assessment for Acme Financial Services, PRISM detected anomalous outbound communications originating from workstation FIN-WS-014 (10.0.0.14). Continuous evidence collection via sensor SNS-042 preserved 684 MB of high-fidelity PCAP data (CAP-1050), corroborating periodic beaconing behavior to external IP 45.77.21.184.',
};

export default function EditReportPage() {
  const params = useParams();
  const reportId = String(params.reportId);
  const storageKey = `prism-report-draft:${reportId}`;

  const [draft, setDraft] = useState<ReportDraft>(DEFAULT_DRAFT);
  const [saved, setSaved] = useState(true);
  const [justSaved, setJustSaved] = useState(false);

  // There's no /api/reports backend — drafts live in this browser only.
  // Load whatever was last saved for this report id, if anything.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setDraft(JSON.parse(stored));
    } catch (_e) {
      // Corrupt or inaccessible storage — fall back to the default draft.
    }
  }, [storageKey]);

  const update = (field: keyof ReportDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSaved(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (_e) {
      // Storage full or blocked — nothing more we can honestly do client-side.
    }
  };

  const handleExportPdf = () => {
    // No PDF library wired into this project — the browser's own print
    // pipeline ("Save as PDF" in the print dialog) is the real, working
    // path rather than faking a download that doesn't exist.
    window.print();
  };

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #report-printable, #report-printable * { visibility: visible; }
          #report-printable { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl print:hidden">
        <div>
          <h1 className="text-lg font-bold text-slate-100">{draft.title}</h1>
          <p className="text-xs text-slate-400">
            Author: {draft.author} • Customer: {draft.customer}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!saved && <span className="text-xs text-amber-400">Unsaved changes</span>}
          {justSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={handleSaveDraft}>
            <Save className="w-3.5 h-3.5" /> Save Draft
          </Button>
          <Button variant="primary" size="sm" onClick={handleExportPdf}>
            <Download className="w-3.5 h-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      <div id="report-printable" className="p-8 bg-slate-900 border border-slate-800 rounded-xl space-y-6 max-w-4xl mx-auto print:bg-white print:border-none">
        <div className="space-y-1 print:mb-4">
          <input
            className="w-full bg-transparent text-xl font-bold text-slate-100 print:text-black border-none outline-none focus:ring-1 focus:ring-slate-700 rounded px-1 -mx-1"
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
          />
          <div className="flex gap-2 text-xs text-slate-400 print:text-slate-600">
            <span>Author:</span>
            <input
              className="bg-transparent border-none outline-none focus:ring-1 focus:ring-slate-700 rounded px-1"
              value={draft.author}
              onChange={(e) => update('author', e.target.value)}
            />
            <span>• Customer:</span>
            <input
              className="bg-transparent border-none outline-none focus:ring-1 focus:ring-slate-700 rounded px-1 flex-1"
              value={draft.customer}
              onChange={(e) => update('customer', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100 print:text-black border-b border-slate-800 pb-2">
            1. Executive Summary
          </h2>
          <textarea
            className="w-full min-h-[140px] bg-transparent text-xs text-slate-300 print:text-black leading-relaxed border-none outline-none focus:ring-1 focus:ring-slate-700 rounded p-1 resize-y"
            value={draft.summary}
            onChange={(e) => update('summary', e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center print:hidden">
        <FileText className="w-3 h-3 inline mr-1" />
        Drafts save to this browser only — there's no backend report storage yet.
      </p>
    </div>
  );
}