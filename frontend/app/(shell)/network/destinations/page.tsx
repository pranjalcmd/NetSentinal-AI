'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getDestinations } from '@/lib/mock/services';
import type { Destination, DestinationRarity } from '@/lib/types';
import { truncateMiddle } from '@/lib/utils';

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<string>('all');

  useEffect(() => {
    getDestinations().then(setDestinations);
  }, []);

  const filteredDestinations = useMemo(() => {
    return destinations.filter(d => {
      if (rarityFilter !== 'all' && d.rarity !== rarityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchIp = d.ip.includes(q);
        const matchDomain = d.domain ? d.domain.toLowerCase().includes(q) : false;
        const matchAsn = d.asnOrg ? d.asnOrg.toLowerCase().includes(q) : false;
        if (!matchIp && !matchDomain && !matchAsn) return false;
      }
      return true;
    });
  }, [destinations, rarityFilter, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>TELEMETRY LAYER</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">observed external destinations, asn classification & domain rarity</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            External Destinations
          </h1>
        </div>

        <div className="flex items-center gap-4 text-[0.7rem]">
          <input
            type="text"
            placeholder="FILTER IP / DOMAIN / ASN..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-[0.65rem] bg-[#090d16] border border-[#1E293B] text-[#E2E8F0] uppercase tracking-wider focus:outline-none focus:border-[#3DD9C4]/60 w-64"
          />
          <select
            value={rarityFilter}
            onChange={e => setRarityFilter(e.target.value)}
            className="px-3 py-1.5 text-[0.65rem] bg-[#090d16] border border-[#1E293B] text-[#E2E8F0] uppercase tracking-wider focus:outline-none focus:border-[#3DD9C4]/60"
          >
            <option value="all">ALL RARITY LEVELS</option>
            <option value="rare">RARE ONLY</option>
            <option value="unusual">UNUSUAL ONLY</option>
            <option value="common">COMMON ONLY</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
          <span>DESTINATION TELEMETRY INDEX</span>
          <span>{filteredDestinations.length} DESTINATIONS MATCHED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.72rem] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                <th className="py-2.5 px-3">Rarity</th>
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Domain / IP</th>
                <th className="py-2.5 px-3">ASN Ownership</th>
                <th className="py-2.5 px-3">Country</th>
                <th className="py-2.5 px-3">Protocols</th>
                <th className="py-2.5 px-3 text-right">Internal Hosts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/40">
              {filteredDestinations.map((dest) => {
                const isRare = dest.rarity === 'rare';
                return (
                  <tr key={dest.id} className="hover:bg-[#0F172A]/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider font-bold border ${
                        isRare ? 'border-[#F43F5E]/40 text-[#F43F5E] bg-[#F43F5E]/5' :
                        dest.rarity === 'unusual' ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                        'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5'
                      }`}>
                        {dest.rarity}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[0.65rem] font-bold border ${
                        dest.riskScore >= 70 ? 'border-[#F43F5E]/40 text-[#F43F5E]' :
                        dest.riskScore >= 40 ? 'border-[#F59E0B]/40 text-[#F59E0B]' :
                        'border-[#3DD9C4]/40 text-[#3DD9C4]'
                      }`}>
                        {dest.riskScore}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#E2E8F0]">{dest.domain || dest.ip}</div>
                      {dest.domain && <div className="text-[0.65rem] text-[#7C8798]">{dest.ip}</div>}
                    </td>
                    <td className="py-3 px-3 text-[#94A3B8]">
                      {dest.asnOrg ? `${dest.asnOrg} (${dest.asn})` : '—'}
                    </td>
                    <td className="py-3 px-3 text-[#94A3B8]">{dest.country || '—'}</td>
                    <td className="py-3 px-3 text-[#3DD9C4] text-[0.65rem]">
                      {dest.protocols?.join(', ') || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">
                      {dest.hosts?.length || 1}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
