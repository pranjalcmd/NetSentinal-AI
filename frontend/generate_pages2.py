import os

base_dir = "/Users/mdayansk/.gemini/antigravity/scratch/NetSentinal-AI/frontend"

files = {}

# 6. Investigations Hub
files["app/investigations/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getInvestigations } from '@/lib/mock/services';
import type { Investigation } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Search, Plus, Upload } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);

  useEffect(() => {
    getInvestigations().then(setInvestigations);
  }, []);

  const columns = [
    { key: 'id', header: 'ID', mono: true },
    { key: 'captureId', header: 'Target Capture', mono: true },
    { key: 'profile', header: 'Profile' },
    { key: 'status', header: 'Status', render: (val: any) => <StatusBadge status={String(val)} /> },
    { key: 'createdAt', header: 'Started' },
    {
      key: 'action', header: 'Action', render: (_: any, row: Investigation) => (
        <Link href={`/investigations/${row.id}`} className="text-xs text-blue-400 hover:underline font-semibold">
          View Results
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" /> Forensic Investigations
          </h1>
          <p className="text-xs text-slate-400">Offline PCAP analysis & automated evidence pipelines</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/investigations/new/upload" className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold">
            <Upload className="w-3.5 h-3.5" /> Upload PCAP
          </Link>
          <Link href="/investigations/new" className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New Investigation
          </Link>
        </div>
      </div>

      <DataTable data={investigations} columns={columns} />
    </div>
  );
}
'''

# 7. New Investigation Wizard
files["app/investigations/new/page.tsx"] = ''''use client';

import React from 'react';
import Link from 'next/link';
import { Upload, HardDrive, ShieldCheck } from 'lucide-react';

export default function NewInvestigationPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Start New Forensic Investigation</h1>
        <p className="text-xs text-slate-400">Select source network evidence to execute DPI & AI pipeline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/investigations/new/upload" className="p-6 bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl space-y-4 text-left transition-colors group">
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg w-fit group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Offline PCAP File Upload</h3>
            <p className="text-xs text-slate-400 mt-1">Upload `.pcap` or `.pcapng` files up to 10GB for offline deep packet inspection.</p>
          </div>
        </Link>

        <Link href="/captures" className="p-6 bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded-xl space-y-4 text-left transition-colors group">
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-lg w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Preserved Sensor Capture</h3>
            <p className="text-xs text-slate-400 mt-1">Select an existing auto-preserved capture (e.g. CAP-1050) from sensor fleet storage.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
'''

# 8. Upload PCAP Page
files["app/investigations/new/upload/page.tsx"] = ''''use client';

import React, { useState } from 'react';
import { Upload, FileCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function UploadPCAPPage() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Upload Offline PCAP File</h1>
        <p className="text-xs text-slate-400">Drag & drop raw packet capture files for deep forensic analysis</p>
      </div>

      <div className="p-10 border-2 border-dashed border-slate-800 hover:border-blue-500/60 bg-slate-900/60 rounded-xl text-center space-y-4 transition-colors">
        <div className="p-4 bg-slate-800/60 rounded-full w-fit mx-auto text-blue-400">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-200">Drag & drop your PCAP file here</h3>
          <p className="text-xs text-slate-500 mt-1">Supports `.pcap`, `.pcapng`, `.cap` (Max 10 GB)</p>
        </div>
        <Button variant="outline" size="sm">
          Browse Files
        </Button>
      </div>
    </div>
  );
}
'''

# 9. Investigation Detail Page
files["app/investigations/[id]/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getInvestigation } from '@/lib/mock/services';
import type { Investigation } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Search, CheckCircle, ShieldAlert, Cpu } from 'lucide-react';

export default function InvestigationDetailPage() {
  const params = useParams();
  const [inv, setInv] = useState<Investigation | null>(null);

  useEffect(() => {
    if (params.id) {
      getInvestigation(String(params.id)).then(setInv);
    }
  }, [params.id]);

  if (!inv) return <div className="p-12 text-center text-slate-400">Loading investigation...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{inv.id}</span>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Target Capture: {inv.captureId} • Profile: {inv.profile}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Flows Processed</p>
          <p className="text-lg font-bold font-mono text-slate-100">{inv.progress.flowsProcessed.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Hosts Identified</p>
          <p className="text-lg font-bold font-mono text-slate-100">{inv.progress.hostsIdentified}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Findings Generated</p>
          <p className="text-lg font-bold font-mono text-amber-400">{inv.progress.findingsSoFar}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Protocols Discovered</p>
          <p className="text-lg font-bold font-mono text-emerald-400">{inv.progress.protocolsFound}</p>
        </div>
      </div>
    </div>
  );
}
'''

# 10. Investigation Progress Page
files["app/investigations/[id]/progress/page.tsx"] = ''''use client';

import React from 'react';

export default function InvestigationProgressPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Live Investigation Pipeline</h1>
      <p className="text-xs text-slate-400">12-Stage Deep Forensic Processing Pipeline</p>
    </div>
  );
}
'''

# 11. Findings Page
files["app/findings/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFindings } from '@/lib/mock/services';
import type { Finding } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { ConfidenceBadge } from '@/components/domain/ConfidenceBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { AlertTriangle } from 'lucide-react';

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);

  useEffect(() => {
    getFindings().then(setFindings);
  }, []);

  const columns = [
    { key: 'id', header: 'Finding ID', mono: true },
    { key: 'title', header: 'Finding Title', render: (val: any) => <span className="font-semibold text-slate-100">{String(val)}</span> },
    { key: 'riskScore', header: 'Risk Score', render: (val: any) => <RiskBadge score={Number(val)} /> },
    { key: 'confidence', header: 'Confidence', render: (val: any) => <ConfidenceBadge confidence={Number(val)} /> },
    { key: 'category', header: 'Category' },
    { key: 'status', header: 'Status', render: (val: any) => <StatusBadge status={String(val)} /> },
    {
      key: 'action', header: 'Action', render: (_: any, row: Finding) => (
        <Link href={`/findings/${row.id}`} className="text-xs text-blue-400 hover:underline font-semibold">
          Inspect Finding
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> Correlated Threat Findings
          </h1>
          <p className="text-xs text-slate-400">Evidence-backed anomalies detected across network traffic</p>
        </div>
      </div>

      <DataTable data={findings} columns={columns} />
    </div>
  );
}
'''

# 12. Finding Detail Page
files["app/findings/[findingId]/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFinding } from '@/lib/mock/services';
import type { Finding } from '@/lib/types';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { ConfidenceBadge } from '@/components/domain/ConfidenceBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { AlertTriangle, Bot, CheckCircle } from 'lucide-react';

export default function FindingDetailPage() {
  const params = useParams();
  const [finding, setFinding] = useState<Finding | null>(null);

  useEffect(() => {
    if (params.findingId) {
      getFinding(String(params.findingId)).then(setFinding);
    }
  }, [params.findingId]);

  if (!finding) return <div className="p-12 text-center text-slate-400">Loading finding details...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-400">{finding.id}</span>
            <RiskBadge score={finding.riskScore} />
            <ConfidenceBadge confidence={finding.confidence} />
            <StatusBadge status={finding.status} />
          </div>
          <h1 className="text-xl font-bold text-slate-100">{finding.title}</h1>
        </div>
      </div>

      {/* AI Analysis Box */}
      {finding.aiAnalysis && (
        <div className="p-6 bg-slate-900 border border-blue-900/40 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Bot className="w-5 h-5" /> AI Technical Synthesis
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{finding.aiAnalysis.summary}</p>
          
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Why It Matters</h4>
            <p className="text-xs text-slate-300">{finding.aiAnalysis.whyItMatters}</p>
          </div>
        </div>
      )}
    </div>
  );
}
'''

# 13. Incidents Workspace Page
files["app/incidents/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getIncidents } from '@/lib/mock/services';
import type { Incident } from '@/lib/types';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { ConfidenceBadge } from '@/components/domain/ConfidenceBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { ShieldAlert } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    getIncidents().then(setIncidents);
  }, []);

  const columns = [
    { key: 'id', header: 'Incident ID', mono: true },
    { key: 'title', header: 'Incident Workspace Title', render: (val: any) => <span className="font-bold text-slate-100">{String(val)}</span> },
    { key: 'riskScore', header: 'Risk Score', render: (val: any) => <RiskBadge score={Number(val)} /> },
    { key: 'confidence', header: 'Confidence', render: (val: any) => <ConfidenceBadge confidence={Number(val)} /> },
    { key: 'status', header: 'Status', render: (val: any) => <StatusBadge status={String(val)} /> },
    {
      key: 'action', header: 'Action', render: (_: any, row: Incident) => (
        <Link href={`/incidents/${row.id}`} className="text-xs text-red-400 hover:underline font-bold">
          Open Workspace
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" /> Incident Command Workspace
          </h1>
          <p className="text-xs text-slate-400">High-priority security incident investigations</p>
        </div>
      </div>

      <DataTable data={incidents} columns={columns} />
    </div>
  );
}
'''

# 14. Incident Command Workspace Detail Page
files["app/incidents/[incidentId]/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getIncident } from '@/lib/mock/services';
import type { Incident } from '@/lib/types';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { ConfidenceBadge } from '@/components/domain/ConfidenceBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { ShieldAlert, Clock, FileText } from 'lucide-react';
import Link from 'next/link';

export default function IncidentDetailPage() {
  const params = useParams();
  const [incident, setIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (params.incidentId) {
      getIncident(String(params.incidentId)).then(setIncident);
    }
  }, [params.incidentId]);

  if (!incident) return <div className="p-12 text-center text-slate-400">Loading incident workspace...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-6 bg-slate-900 border border-red-900/50 rounded-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-400">{incident.id}</span>
            <RiskBadge score={incident.riskScore} />
            <ConfidenceBadge confidence={incident.confidence} />
            <StatusBadge status={incident.status} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{incident.title}</h1>
        </div>
        <Link href="/reports/RPT-001/edit" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">
          <FileText className="w-4 h-4" /> Export to Report
        </Link>
      </div>

      {/* Incident Story Timeline */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" /> Narrative Incident Story
        </h3>
        <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 pl-8">
          {incident.story?.map((step, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-8 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-4 border-slate-900" />
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{step.event}</span>
                  <span className="font-mono text-[10px] text-slate-500">{step.timestamp}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
'''

# 15. Traffic Flow Explorer
files["app/traffic/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { getFlows } from '@/lib/mock/services';
import type { Flow } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { ArrowLeftRight } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export default function TrafficPage() {
  const [flows, setFlows] = useState<Flow[]>([]);

  useEffect(() => {
    getFlows().then(res => setFlows(res.flows));
  }, []);

  const columns = [
    { key: 'timestamp', header: 'Time', mono: true },
    { key: 'srcIp', header: 'Src IP', mono: true },
    { key: 'srcPort', header: 'Port', mono: true },
    { key: 'dstIp', header: 'Dst IP', mono: true },
    { key: 'dstPort', header: 'Port', mono: true },
    { key: 'protocol', header: 'Protocol', mono: true },
    { key: 'application', header: 'App' },
    { key: 'bytes', header: 'Bytes', render: (val: any) => formatBytes(Number(val || 0)) },
    { key: 'riskScore', header: 'Risk', render: (val: any) => <RiskBadge score={Number(val || 0)} /> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-400" /> Network Flow Explorer
          </h1>
          <p className="text-xs text-slate-400">Forensic deep packet inspection flow records</p>
        </div>
      </div>

      <DataTable data={flows} columns={columns} />
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

