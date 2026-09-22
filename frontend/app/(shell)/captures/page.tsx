'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCaptures, loadDemo, BackendCapture } from '@/lib/api';
import { RefreshCw, Upload, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

function formatBytes(b: number): string {
  if (!b) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CapturesPage() {
  const [captures, setCaptures] = useState<BackendCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const fetchCaptures = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCaptures();
      setCaptures(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load captures from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCaptures(); }, []);

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemo();
      await fetchCaptures();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const totalBytes = captures.reduce((acc, c) => acc + (c.size_bytes || 0), 0);

  return (
    <div className="space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>CAPTURE ARCHIVE</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">pcaps &amp; forensic buffer storage</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Evidence Captures
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCaptures}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#1E293B]/80 text-[#7C8798] hover:text-[#3DD9C4] hover:border-[#3DD9C4]/40 transition-colors text-[0.65rem] uppercase tracking-wider"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <Link
            href="/investigations/new/upload"
            className="flex items-center gap-2 px-3 py-1.5 border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors text-[0.65rem] uppercase tracking-wider"
          >
            <Upload className="w-3 h-3" />
            Upload PCAP
          </Link>
        </div>

        <div className="flex items-center gap-6 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Total Captures</span>
            <span className="text-[#E2E8F0] font-bold text-sm">{captures.length}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Volume On Disk</span>
            <span className="text-[#3DD9C4] font-bold text-sm">{formatBytes(totalBytes)}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Auto Preserved</span>
            <span className="text-[#3DD9C4] font-bold text-sm">
              {captures.filter(c => c.type === 'AUTO_PRESERVED').length}
            </span>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="flex items-center gap-3 p-4 border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div>
            <span className="font-bold">Backend unreachable:</span> {error}
          </div>
          <button onClick={fetchCaptures} className="ml-auto underline text-red-300 hover:text-red-100">Retry</button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-[#0F172A] animate-pulse rounded" />
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && captures.length === 0 && (
        <div className="border border-dashed border-[#1E293B]/80 p-12 text-center space-y-4">
          <Database className="w-10 h-10 mx-auto text-[#3DD9C4]/30" />
          <div className="text-[#7C8798] text-sm tracking-wider uppercase">No captures yet</div>
          <p className="text-xs text-[#4B5563] max-w-sm mx-auto">
            Upload a PCAP file to start analysis, or load the built-in demo dataset to explore the platform.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Link href="/investigations/new/upload" className="px-4 py-2 border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors text-xs uppercase tracking-wider">
              Upload PCAP
            </Link>
            <button
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              className="px-4 py-2 border border-[#7C8798]/40 text-[#7C8798] hover:text-[#E2E8F0] hover:border-[#E2E8F0]/40 transition-colors text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {loadingDemo ? 'Loading...' : 'Load Demo Data'}
            </button>
          </div>
        </div>
      )}

      {/* TABLE */}
      {!loading && captures.length > 0 && (
        <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
          <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
            <span>FORENSIC CAPTURE INDEX</span>
            <span className="flex items-center gap-1.5 text-[#3DD9C4]">
              <CheckCircle2 className="w-3 h-3" />
              LIVE BACKEND DATA
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.72rem] border-collapse">
              <thead>
                <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Capture / File</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Sensor</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3 text-right">Flows</th>
                  <th className="py-2.5 px-3 text-right">Alerts</th>
                  <th className="py-2.5 px-3 text-right">Size</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40">
                {captures.map((cap) => (
                  <tr key={cap.id} className="hover:bg-[#0F172A]/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider border ${
                        cap.status === 'ANALYZED' ? 'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5' :
                        cap.status === 'BUFFERING' ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                        'border-[#7C8798]/40 text-[#7C8798] bg-[#7C8798]/5'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          cap.status === 'ANALYZED' ? 'bg-[#3DD9C4]' : 'bg-[#F59E0B] animate-pulse'
                        }`} />
                        {cap.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#3DD9C4]">{cap.id.slice(0, 16)}</div>
                      <div className="text-[#7C8798] text-[0.6rem]">{cap.filename}</div>
                    </td>
                    <td className="py-3 px-3 text-[#E2E8F0] font-bold">{cap.type}</td>
                    <td className="py-3 px-3 text-[#94A3B8]">{cap.sensor_name}</td>
                    <td className="py-3 px-3 text-[#94A3B8]">{formatTimestamp(cap.created_at)}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">{cap.flows}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={cap.alerts > 0 ? 'text-amber-400 font-bold' : 'text-[#94A3B8]'}>{cap.alerts}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">{formatBytes(cap.size_bytes)}</td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/captures/${cap.id}`}
                        className="px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors"
                      >
                        INSPECT →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
