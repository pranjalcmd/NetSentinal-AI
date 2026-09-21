'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSensors as getApiSensors } from '@/lib/api';
import { getSensors as getMockSensors } from '@/lib/mock/services';
import type { Sensor } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

export default function SensorsPage() {
  const [sensors, setSensors] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const apiData = await getApiSensors();
        if (mounted) {
          setSensors((apiData || []).map(s => ({
            id: s.id,
            name: s.name,
            interface: s.interface || 'eth0',
            os: s.os || 'Linux',
            version: s.version || 'v2.8.4',
            status: s.status || 'online',
            metrics: {
              mbps: s.metrics?.mbps ?? 0,
              pps: s.metrics?.pps ?? 0,
              bufferPercent: s.metrics?.buffer_percent ?? 0,
            },
          })));
          setLoading(false);
        }
      } catch (e) {
        console.warn('Backend API failed loading sensors', e);
        if (mounted) {
          setSensors([]);
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  const totalMbps = sensors.reduce((acc, s) => acc + (s.metrics?.mbps || 0), 0);
  const totalPps = sensors.reduce((acc, s) => acc + (s.metrics?.pps || 0), 0);

  return (
    <div className="space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>NODES LAYER</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">sensor fleet & hardware telemetry</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Deployed Network Sensors
          </h1>
        </div>

        <div className="flex items-center gap-6 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Fleet Throughput</span>
            <span className="text-[#3DD9C4] font-bold text-sm">{totalMbps} Mbps</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Total Packet Rate</span>
            <span className="text-[#E2E8F0] font-bold text-sm">{totalPps.toLocaleString()} pps</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Active Fleet</span>
            <span className="text-[#3DD9C4] font-bold text-sm">{sensors.filter(s => s.status === 'online').length} / {sensors.length}</span>
          </div>
        </div>
      </div>

      {/* SENSOR CARDS / TABLE GRID */}
      <div className="grid grid-cols-1 gap-6">
        <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
          <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
            <span>SENSOR FLEET REGISTRY</span>
            <span>{sensors.length} HARDWARE PROBES LISTED</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.72rem] border-collapse">
              <thead>
                <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Sensor ID</th>
                  <th className="py-2.5 px-3">Hostname</th>
                  <th className="py-2.5 px-3">Interface</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3 text-right">Throughput</th>
                  <th className="py-2.5 px-3 text-right">Packet Rate</th>
                  <th className="py-2.5 px-3 text-right">Buffer Load</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#7C8798] uppercase text-[0.65rem]">
                      Loading Sensor Fleet...
                    </td>
                  </tr>
                ) : sensors.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#7C8798] uppercase text-[0.65rem]">
                      No active sensor hardware probes connected. Ingestion engine ready.
                    </td>
                  </tr>
                ) : sensors.map((sensor) => {
                  const isOnline = sensor.status === 'online';
                  const isDegraded = sensor.status === 'degraded';
                  return (
                    <tr key={sensor.id} className="hover:bg-[#0F172A]/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider border ${
                          isOnline ? 'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5' :
                          isDegraded ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                          'border-[#F43F5E]/40 text-[#F43F5E] bg-[#F43F5E]/5'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-[#3DD9C4] animate-pulse' : isDegraded ? 'bg-[#F59E0B]' : 'bg-[#F43F5E]'
                          }`} />
                          {sensor.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{sensor.id}</td>
                      <td className="py-3 px-3 text-[#E2E8F0] font-bold">{sensor.name}</td>
                      <td className="py-3 px-3 text-[#94A3B8]">{sensor.interface}</td>
                      <td className="py-3 px-3 text-[#94A3B8]">{sensor.os} ({sensor.version})</td>
                      <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">{sensor.metrics?.mbps ?? 0} Mbps</td>
                      <td className="py-3 px-3 text-right text-[#94A3B8]">{(sensor.metrics?.pps ?? 0).toLocaleString()} pps</td>
                      <td className="py-3 px-3 text-right">
                        <span className={(sensor.metrics?.bufferPercent ?? 0) > 75 ? 'text-[#F59E0B]' : 'text-[#3DD9C4]'}>
                          {sensor.metrics?.bufferPercent ?? 0}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`/sensors/${sensor.id}`}
                          className="px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors"
                        >
                          DIAGNOSTICS →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
