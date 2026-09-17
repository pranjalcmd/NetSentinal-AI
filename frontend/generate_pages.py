import os

base_dir = "/Users/mdayansk/.gemini/antigravity/scratch/NetSentinal-AI/frontend"

files = {}

# 1. Overview Page
files["app/overview/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Activity, ShieldAlert, HardDrive, AlertTriangle, Play, Upload, Share2, FileText, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { getSensors, getIncidents, getFindings, getCaptures, getTriggers } from '@/lib/mock/services';
import type { Sensor, Incident, Finding, Capture, Trigger } from '@/lib/types';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatBytes, formatDuration, formatRelativeTime } from '@/lib/utils';
import { MetricCard } from '@/components/ui/MetricCard';

export default function OverviewPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);

  useEffect(() => {
    getSensors().then(setSensors);
    getIncidents().then(setIncidents);
    getFindings().then(setFindings);
    getCaptures().then(setCaptures);
    getTriggers().then(setTriggers);
  }, []);

  const spotIncident = incidents[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-lg text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Acme Financial Services — SOC Command Center</h1>
            <p className="text-xs text-slate-400">Engagement: Q3 Network Security Assessment • Sensor Fleet: 3 Active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/monitor/capture" className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors">
            <Play className="w-3.5 h-3.5" /> Start Capture
          </Link>
          <Link href="/investigations/new/upload" className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors">
            <Upload className="w-3.5 h-3.5" /> Upload PCAP
          </Link>
          <Link href="/network/mesh" className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
            <Share2 className="w-3.5 h-3.5" /> Launch Mesh
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Preserved Captures" value="684 MB" change="CAP-1050 Ready" icon={<HardDrive className="w-5 h-5 text-emerald-400" />} />
        <MetricCard title="Open Incidents" value={incidents.length.toString()} change="INC-2026-041 Critical" icon={<ShieldAlert className="w-5 h-5 text-red-400" />} />
        <MetricCard title="Correlated Findings" value={findings.length.toString()} change="5 Threat Indicators" icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} />
        <MetricCard title="Fleet Throughput" value="1.25 Gbps" change="26,840 pps live" icon={<Activity className="w-5 h-5 text-blue-400" />} />
      </div>

      {/* Incident Spotlight */}
      {spotIncident && (
        <div className="p-6 bg-slate-900 border border-red-900/40 rounded-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 bg-red-950/80 border-b border-l border-red-800/40 rounded-bl-xl text-xs text-red-400 font-bold uppercase tracking-wider">
            Critical Spotlight
          </div>
          <div className="flex items-start justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400">{spotIncident.id}</span>
                <RiskBadge score={spotIncident.riskScore} />
                <StatusBadge status={spotIncident.status} />
              </div>
              <h2 className="text-xl font-bold text-slate-100">{spotIncident.title}</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{spotIncident.description}</p>
            </div>
            <Link href={`/incidents/${spotIncident.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors">
              Investigate Workspace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Triggers */}
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Recent Preserved Triggers
            </h3>
            <Link href="/sensors" className="text-xs text-blue-400 hover:underline">View Fleet</Link>
          </div>
          <div className="space-y-3">
            {triggers.map(t => (
              <div key={t.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-200">{t.id}</span>
                    <span className="text-xs text-red-400 font-bold">Score {t.score}/100</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Entity: {t.entityId} • {t.signals.length} Correlated Signals</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Captures */}
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" /> Recent Evidence Captures
            </h3>
            <Link href="/captures" className="text-xs text-blue-400 hover:underline">View Repository</Link>
          </div>
          <div className="space-y-3">
            {captures.slice(0, 3).map(c => (
              <div key={c.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-200">{c.id}</span>
                    <span className="text-xs text-slate-400">({c.type})</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{formatBytes(c.sizeBytes || 0)} • {formatDuration(c.durationSec || 0)}</p>
                </div>
                <Link href={`/captures/${c.id}`} className="text-xs text-blue-400 hover:underline font-medium">
                  Inspect
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
'''

# 2. Live Monitoring Page
files["app/monitor/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Play, ShieldAlert, Cpu } from 'lucide-react';
import { getSensors } from '@/lib/mock/services';
import type { Sensor } from '@/lib/types';
import { SensorStatus } from '@/components/domain/SensorStatus';
import { formatBytes } from '@/lib/utils';

export default function MonitorPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);

  useEffect(() => {
    getSensors().then(setSensors);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Live Network Monitoring Console</h1>
          <p className="text-xs text-slate-400">Real-time authorized network capture and sensor telemetry</p>
        </div>
        <Link href="/monitor/capture" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors">
          <Play className="w-4 h-4" /> Open Manual Capture Console
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sensors.map(s => (
          <div key={s.id} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-slate-100">{s.name}</span>
              <SensorStatus status={s.status} />
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              <p>Interface: <span className="font-mono text-slate-200">{s.interface}</span></p>
              <p>OS: <span className="text-slate-200">{s.os}</span></p>
              <p>Version: <span className="font-mono text-slate-200">{s.version}</span></p>
            </div>
            <div className="pt-3 border-t border-slate-800 grid grid-cols-3 text-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Mbps</p>
                <p className="text-sm font-bold font-mono text-slate-200">{s.metrics.mbps}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">PPS</p>
                <p className="text-sm font-bold font-mono text-slate-200">{s.metrics.pps}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Buffer</p>
                <p className="text-sm font-bold font-mono text-emerald-400">{s.metrics.bufferPercent}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
'''

# 3. Manual Capture Console Page
files["app/monitor/capture/page.tsx"] = ''''use client';

import React, { useState } from 'react';
import { Play, Square, HardDrive, ShieldCheck, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/lib/utils';

export default function ManualCapturePage() {
  const [capturing, setCapturing] = useState(false);
  const [packets, setPackets] = useState(0);

  const toggleCapture = () => {
    setCapturing(!capturing);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Manual Packet Capture Console</h1>
        <p className="text-xs text-slate-400">Execute targeted packet collection on authorized sensors</p>
      </div>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Target Sensor</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option>SNS-042 (ACME-SENSOR-01)</option>
              <option>SNS-037 (ACME-EDGE-02)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-2">BPF Capture Filter</label>
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input 
                type="text" 
                defaultValue="host 10.0.0.14 and port 443" 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-xs font-mono text-slate-200" 
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex items-center gap-4">
            <Button variant={capturing ? "danger" : "primary"} onClick={toggleCapture}>
              {capturing ? <><Square className="w-4 h-4" /> Stop Capture</> : <><Play className="w-4 h-4" /> Start Capture</>}
            </Button>
            {capturing && (
              <span className="flex items-center gap-2 text-xs text-amber-400 animate-pulse font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Recording in progress...
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500">Captured Packets: </span>
              <span className="font-mono font-bold text-slate-200">{capturing ? "142,890" : "0"}</span>
            </div>
            <div>
              <span className="text-slate-500">Size: </span>
              <span className="font-mono font-bold text-slate-200">{capturing ? "142 MB" : "0 B"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'''

# 4. Captures Repository Page
files["app/captures/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCaptures } from '@/lib/mock/services';
import type { Capture } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatBytes, formatDuration } from '@/lib/utils';
import { HardDrive } from 'lucide-react';

export default function CapturesPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);

  useEffect(() => {
    getCaptures().then(setCaptures);
  }, []);

  const columns = [
    { key: 'id', header: 'Capture ID', render: (val: any) => <span className="font-mono text-xs font-bold text-blue-400">{String(val)}</span> },
    { key: 'type', header: 'Type' },
    { key: 'sensorId', header: 'Sensor', mono: true },
    { key: 'sizeBytes', header: 'Size', render: (val: any) => formatBytes(Number(val || 0)) },
    { key: 'durationSec', header: 'Duration', render: (val: any) => formatDuration(Number(val || 0)) },
    { key: 'status', header: 'Status', render: (val: any) => <StatusBadge status={String(val)} /> },
    {
      key: 'action', header: 'Action', render: (_: any, row: Capture) => (
        <Link href={`/captures/${row.id}`} className="text-xs text-blue-400 hover:underline font-semibold">
          Inspect
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-400" /> Evidence Captures Repository
          </h1>
          <p className="text-xs text-slate-400">Preserved PCAPs, manual recordings, and uploaded evidence files</p>
        </div>
      </div>

      <DataTable data={captures} columns={columns} />
    </div>
  );
}
'''

# 5. Capture Detail Page
files["app/captures/[captureId]/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCapture } from '@/lib/mock/services';
import type { Capture } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatBytes, formatDuration } from '@/lib/utils';
import { ShieldCheck, HardDrive, Cpu, FileCheck } from 'lucide-react';

export default function CaptureDetailPage() {
  const params = useParams();
  const [capture, setCapture] = useState<Capture | null>(null);

  useEffect(() => {
    if (params.captureId) {
      getCapture(String(params.captureId)).then(setCapture);
    }
  }, [params.captureId]);

  if (!capture) return <div className="p-12 text-center text-slate-400">Loading capture details...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{capture.id}</span>
            <StatusBadge status={capture.status} />
          </div>
          <p className="text-xs text-slate-400">{capture.preservationReason || "Standard forensics capture session"}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-500/30">
          <ShieldCheck className="w-4 h-4" /> SHA-256 Verified
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Size</p>
          <p className="text-lg font-bold font-mono text-slate-100">{formatBytes(capture.sizeBytes || 0)}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Duration</p>
          <p className="text-lg font-bold font-mono text-slate-100">{formatDuration(capture.durationSec || 0)}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Packets</p>
          <p className="text-lg font-bold font-mono text-slate-100">{capture.metadata?.packets?.toLocaleString() || "4,281,920"}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Sensor</p>
          <p className="text-lg font-bold font-mono text-slate-100">{capture.sensorId}</p>
        </div>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">SHA-256 Checksum</h3>
        <p className="font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 select-all">
          {capture.sha256 || "a3f4b8c2d1e9f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2"}
        </p>
      </div>
    </div>
  );
}
'''

# Write files to disk
for rel_path, content in files.items():
  full_path = os.path.join(base_dir, rel_path)
  os.makedirs(os.path.dirname(full_path), exist_ok=True)
  with open(full_path, 'w', encoding='utf-8') as f:
    f.write(content)
  print(f"Wrote {rel_path}")

