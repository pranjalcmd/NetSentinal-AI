'use client';

import React, { useState, useEffect } from 'react';
import { getFlows } from '@/lib/mock/services';
import type { Flow } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

type PresetQuery = {
  id: string;
  name: string;
  description: string;
  query: string;
  category: string;
};

const PRESET_QUERIES: PresetQuery[] = [
  {
    id: 'preset-1',
    name: 'Periodic Beacons (C2 Detection)',
    description: 'Find outbound TLS streams exhibiting consistent interval periodicity (R² > 0.90)',
    query: 'flow.protocol == "TLS" && beacon.periodicity_r2 > 0.90 && dest.is_rare == true',
    category: 'C2 Hunting',
  },
  {
    id: 'preset-2',
    name: 'High Entropy DNS (Exfiltration)',
    description: 'Detect DNS TXT queries with Base64 payload in subdomain labels',
    query: 'dns.qtype == "TXT" && dns.subdomain_entropy > 4.2 && dns.payload_bytes > 100',
    category: 'DNS Tunneling',
  },
  {
    id: 'preset-3',
    name: 'Novel External IPs',
    description: 'Identify external IPs contacted for the first time in the last 24 hours',
    query: 'dest.rarity == "rare" && dest.first_seen >= now() - 24h',
    category: 'Reconnaissance',
  },
  {
    id: 'preset-4',
    name: 'Large Outbound Data Transfers',
    description: 'Flag sustained connections transferring > 1 GB to non-cloud destinations',
    query: 'flow.bytes_out > 1073741824 && dest.category != "cloud_storage"',
    category: 'Exfiltration',
  },
];

export default function ThreatHuntPage() {
  const [query, setQuery] = useState(PRESET_QUERIES[0].query);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<Flow[]>([]);

  const runQuery = async () => {
    setExecuting(true);
    try {
      const allFlows = await getFlows();
      let filtered = [...allFlows];
      if (query.includes('beacon') || query.includes('0.90')) {
        filtered = allFlows.filter((f: Flow) => f.riskScore >= 75);
      } else if (query.includes('dns') || query.includes('TXT')) {
        filtered = allFlows.filter((f: Flow) => f.protocol === 'UDP' || f.application === 'DNS');
      }
      setResults(filtered);
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    runQuery();
  }, []);

  return (
    <div className="space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>SEARCH & QUERY ENGINE</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">deep network traffic hunt & telemetry analytics</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Threat Hunting Console
          </h1>
        </div>

        <div className="flex items-center gap-4 text-[0.7rem]">
          <button
            onClick={runQuery}
            disabled={executing}
            className="px-4 py-2 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4] bg-[#3DD9C4]/10 text-[#3DD9C4] hover:bg-[#3DD9C4]/20 transition-colors font-bold disabled:opacity-50"
          >
            {executing ? 'RUNNING QUERY…' : 'EXECUTE QUERY →'}
          </button>
        </div>
      </div>

      {/* QUERY CONSOLE */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-4 space-y-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2">
          <span>HUNTING QUERY EDITOR (TELEMETRY DSL)</span>
          <span>ENTER EXPRESSION</span>
        </div>

        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          rows={3}
          className="w-full bg-[#090d16] border border-[#1E293B] p-3 text-xs text-[#3DD9C4] font-mono focus:outline-none focus:border-[#3DD9C4]/60 resize-none leading-relaxed"
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[0.65rem] text-[#7C8798] uppercase tracking-wider mr-2">QUERY PRESETS:</span>
          {PRESET_QUERIES.map(preset => (
            <button
              key={preset.id}
              onClick={() => { setQuery(preset.query); }}
              className="px-2.5 py-1 text-[0.6rem] uppercase tracking-wider border border-[#1E293B] text-[#94A3B8] hover:border-[#3DD9C4]/40 hover:text-[#3DD9C4] bg-[#090d16] transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* RESULTS TABLE */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
          <span>MATCHED FLOW RESULTS</span>
          <span>{results.length} MATCHING RECORDS FOUND</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.72rem] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Source IP</th>
                <th className="py-2.5 px-3">Destination IP</th>
                <th className="py-2.5 px-3">Protocol</th>
                <th className="py-2.5 px-3 text-right">Packets</th>
                <th className="py-2.5 px-3 text-right">Bytes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/40">
              {results.map((flow) => (
                <tr key={flow.id} className="hover:bg-[#0F172A]/40 transition-colors">
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 text-[0.65rem] font-bold border ${
                      flow.riskScore >= 75 ? 'border-[#F43F5E]/40 text-[#F43F5E] bg-[#F43F5E]/5' :
                      flow.riskScore >= 45 ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                      'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5'
                    }`}>
                      {flow.riskScore}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#94A3B8]">{flow.timestamp || '—'}</td>
                  <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{flow.srcIp}:{flow.srcPort}</td>
                  <td className="py-3 px-3 font-bold text-[#E2E8F0]">{flow.dstIp}:{flow.dstPort}</td>
                  <td className="py-3 px-3 text-[#94A3B8] uppercase text-[0.65rem]">{flow.application || flow.protocol}</td>
                  <td className="py-3 px-3 text-right text-[#94A3B8]">{flow.packets?.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">{formatBytes(flow.bytes || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
