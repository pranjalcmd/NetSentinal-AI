'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileCheck2, Loader2, AlertTriangle } from 'lucide-react';
import { getJobs, uploadPcap, loadJob, type AnalysisJob } from '@/lib/api';

function when(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function CapturesPage() {
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => getJobs().then(setJobs).catch(() => {});

  useEffect(() => {
    let live = true;
    getJobs().then((j) => { if (live) setJobs(j); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const send = async (file: File) => {
    setBusy(true);
    setNote(null);
    try {
      const job = await uploadPcap(file);
      setNote({ kind: 'ok', text: job.message || `Analysed ${file.name}` });
      await refresh();
    } catch (e: any) {
      // The API explains why — file type, size, or an unreadable capture.
      setNote({ kind: 'err', text: e?.message ?? 'Upload failed' });
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void send(file);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      <header className="space-y-2">
        <p className="eyebrow">Capture archive</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Captures</h1>
        <p className="text-sm text-zinc-500">
          Drop a PCAP to analyse it, or reopen a capture analysed earlier.
        </p>
      </header>

      {/* Drop zone — native drag events, no library. */}
      <section
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className={`glass glass-hover cursor-pointer px-8 py-14 flex flex-col items-center justify-center gap-3 text-center border-dashed ${
          dragging ? 'border-[#3DD9C4]/50 bg-[#3DD9C4]/[0.04]' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pcap,.pcapng"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void send(f);
            e.target.value = '';
          }}
        />
        {busy ? (
          <Loader2 className="w-7 h-7 text-[#3DD9C4] animate-spin" />
        ) : (
          <UploadCloud className={`w-7 h-7 ${dragging ? 'text-[#3DD9C4]' : 'text-zinc-600'}`} />
        )}
        <p className="text-sm text-zinc-300">
          {busy ? 'Analysing…' : dragging ? 'Drop to analyse' : 'Drop a .pcap or .pcapng here'}
        </p>
        <p className="text-xs text-zinc-600">or click to choose a file · max 100 MB</p>
      </section>

      {note && (
        <div
          className={`glass px-5 py-4 flex items-start gap-3 text-sm ${
            note.kind === 'ok' ? 'text-zinc-300' : 'text-amber-300'
          }`}
        >
          {note.kind === 'ok'
            ? <FileCheck2 className="w-4 h-4 text-[#3DD9C4] mt-0.5 shrink-0" />
            : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{note.text}</span>
        </div>
      )}

      <section className="space-y-4">
        <p className="eyebrow">Analysed captures</p>

        {jobs.length === 0 ? (
          <div className="glass px-6 py-10 text-center text-sm text-zinc-600">
            Nothing analysed yet. Drop a capture above to start.
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-zinc-600 border-b border-white/[0.07]">
                  <th className="px-5 py-3 font-normal">Source</th>
                  <th className="px-5 py-3 font-normal">Analysed</th>
                  <th className="px-5 py-3 font-normal text-right">Flows</th>
                  <th className="px-5 py-3 font-normal text-right">Suspicious</th>
                  <th className="px-5 py-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.job_id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-4">
                      <div className="font-mono text-[#3DD9C4] text-[13px]">{j.filename}</div>
                      <div className="text-xs text-zinc-600 mt-0.5 max-w-md truncate">{j.message}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-400">{when(j.created_at)}</td>
                    <td className="px-5 py-4 font-mono text-right text-zinc-200">
                      {j.summary?.total_flows ?? '—'}
                    </td>
                    <td className="px-5 py-4 font-mono text-right text-amber-400">
                      {j.summary?.suspicious_flows ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => loadJob(j.job_id).then(refresh).catch(() => {})}
                        className="glass glass-hover px-3 py-1.5 text-[11px] font-mono text-zinc-300"
                      >
                        Reopen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
