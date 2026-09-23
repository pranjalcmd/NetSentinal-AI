'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { uploadPcap } from '@/lib/api';

export default function UploadPCAPPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const pickFile = (f: File | null) => {
    setError(null);
    if (f && !/\.(pcap|pcapng)$/i.test(f.name)) {
      setError('Unsupported file type — upload a .pcap or .pcapng file');
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Choose a .pcap or .pcapng file first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const job = await uploadPcap(file);
      // Cache the finished job so the progress page can show it instantly,
      // even if the backend is slow to list it or has restarted.
      try {
        sessionStorage.setItem(`prism:job:${job.job_id}`, JSON.stringify(job));
      } catch {
        /* storage unavailable — the progress page will fetch from the backend */
      }
      router.push(`/investigations/${job.job_id}/progress`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed — try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-100">Upload a capture</h1>
        <p className="text-xs text-slate-400">
          Analyze a .pcap or .pcapng file through the detection pipeline.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-slate-700 hover:border-slate-600 bg-slate-900/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pcap,.pcapng"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] || null)}
        />

        {file ? (
          <>
            <FileCheck className="w-8 h-8 text-emerald-400" />
            <div className="text-sm text-slate-200 font-medium">{file.name}</div>
            <div className="text-xs text-slate-500">
              {(file.size / (1024 * 1024)).toFixed(2)} MB — click or drop to replace
            </div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-slate-500" />
            <div className="text-sm text-slate-300 font-medium">
              Drop a capture here, or click to browse
            </div>
            <div className="text-xs text-slate-500">.pcap, .pcapng</div>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Analyzed offline — nothing leaves the process except normalized telemetry.</span>
        </div>

        <Button
          variant="primary"
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          {uploading ? 'Uploading…' : 'Analyze capture'}
        </Button>
      </div>
    </div>
  );
}
