'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { analyzePcap, ApiError } from '@/lib/api';

// Real upload: POST /api/analyze/pcap (multipart). The backend runs the whole
// pipeline — DPI, rules, ML, correlation — and returns the analysis job, whose
// summary is shown here. Alerts/findings/incidents then read live everywhere.

type Job = {
  job_id?: string
  filename?: string
  message?: string
  summary?: Record<string, unknown>
}

export default function UploadPCAPPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setError(null);
    setJob(null);
  };

  const upload = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await analyzePcap(file);
      if (res) setJob(res as Job);
    } catch (err) {
      setError(err instanceof ApiError
        ? `Upload rejected (HTTP ${err.status}): ${err.message.slice(0, 300)}`
        : 'Could not reach the analysis backend on :8000.');
    } finally {
      setBusy(false);
    }
  };

  const summary = job?.summary ?? {};
  const num = (k: string) => Number(summary[k] ?? 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Upload PCAP File</h1>
        <p className="text-xs text-slate-400">Upload a packet capture for deep analysis — DPI, ML and correlation run on the backend</p>
      </div>

      <div
        className="p-10 border-2 border-dashed border-slate-800 hover:border-blue-500/60 bg-slate-900/60 rounded-xl text-center space-y-4 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <div className="p-4 bg-slate-800/60 rounded-full w-fit mx-auto text-blue-400">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-200">
            {file ? file.name : 'Drop your PCAP file here, or click to browse'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Supports .pcap / .pcapng — size limit set by MAX_UPLOAD_MB on the backend'}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pcap,.pcapng,.cap"
          className="hidden"
          onChange={e => pick(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <div className="p-3 border border-red-500/40 bg-red-500/10 rounded text-xs text-red-300">
          {error}
        </div>
      )}

      {job && (
        <div className="p-5 border border-emerald-500/40 bg-emerald-500/5 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <ShieldCheck className="w-4 h-4" /> Analysis complete
          </div>
          <p className="text-xs text-slate-300">{job.message}</p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              ['Flows', num('total_flows')],
              ['Suspicious', num('suspicious_flows')],
              ['High risk', num('high_risk')],
            ].map(([label, value]) => (
              <div key={String(label)} className="p-3 bg-slate-900/60 border border-slate-800 rounded text-center">
                <div className="text-lg font-bold text-slate-100">{value as number}</div>
                <div className="text-[0.6rem] uppercase tracking-wider text-slate-500">{label as string}</div>
              </div>
            ))}
          </div>
          <Button size="sm" onClick={() => router.push('/overview')}>
            <FileCheck className="w-3 h-3 mr-1" /> View results
          </Button>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Browse Files
        </Button>
        <Button
          size="sm"
          onClick={upload}
          disabled={!file || busy}
        >
          {busy ? 'Analysing…' : 'Upload & Analyse'}
        </Button>
      </div>
    </div>
  );
}
