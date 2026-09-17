import os

base_dir = "/Users/mdayansk/.gemini/antigravity/scratch/NetSentinal-AI/frontend"

files = {}

# 16. Hosts Page
files["app/network/hosts/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getHosts } from '@/lib/mock/services';
import type { Host } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { Server } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>([]);

  useEffect(() => {
    getHosts().then(setHosts);
  }, []);

  const columns = [
    { key: 'ip', header: 'IP Address', mono: true },
    { key: 'hostname', header: 'Hostname', render: (val: any) => <span className="font-semibold text-slate-100">{String(val || '—')}</span> },
    { key: 'role', header: 'Role' },
    { key: 'riskScore', header: 'Risk Score', render: (val: any) => <RiskBadge score={Number(val || 0)} /> },
    { key: 'flows', header: 'Flows', mono: true },
    { key: 'bytesOut', header: 'Outbound', render: (val: any) => formatBytes(Number(val || 0)) },
    {
      key: 'action', header: 'Action', render: (_: any, row: Host) => (
        <Link href={`/network/hosts/${row.id}`} className="text-xs text-blue-400 hover:underline font-semibold">
          Inspect Host
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" /> Internal Hosts Directory
          </h1>
          <p className="text-xs text-slate-400">Observed internal endpoints and workstation risk telemetry</p>
        </div>
      </div>

      <DataTable data={hosts} columns={columns} />
    </div>
  );
}
'''

# 17. Host Detail Page
files["app/network/hosts/[hostId]/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getHost } from '@/lib/mock/services';
import type { Host } from '@/lib/types';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { Server, HardDrive } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export default function HostDetailPage() {
  const params = useParams();
  const [host, setHost] = useState<Host | null>(null);

  useEffect(() => {
    if (params.hostId) {
      getHost(String(params.hostId)).then(setHost);
    }
  }, [params.hostId]);

  if (!host) return <div className="p-12 text-center text-slate-400">Loading host profile...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{host.ip}</span>
            <RiskBadge score={host.riskScore} />
          </div>
          <p className="text-xs text-slate-400">{host.hostname} • Role: {host.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Total Flows</p>
          <p className="text-lg font-bold font-mono text-slate-100">{host.flows.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Outbound Volume</p>
          <p className="text-lg font-bold font-mono text-slate-100">{formatBytes(host.bytesOut)}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Inbound Volume</p>
          <p className="text-lg font-bold font-mono text-slate-100">{formatBytes(host.bytesIn)}</p>
        </div>
      </div>
    </div>
  );
}
'''

# 18. Destinations Page
files["app/network/destinations/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { getDestinations } from '@/lib/mock/services';
import type { Destination } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { Globe } from 'lucide-react';

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    getDestinations().then(setDestinations);
  }, []);

  const columns = [
    { key: 'ip', header: 'External IP / Domain', mono: true, render: (val: any, row: Destination) => String(row.domain || row.ip) },
    { key: 'asn', header: 'ASN Org', render: (_: any, row: Destination) => `${row.asn || ''} (${row.asnOrg || 'Unknown'})` },
    { key: 'rarity', header: 'Rarity', render: (val: any) => <span className="uppercase text-[10px] font-bold tracking-wider text-amber-400">{String(val)}</span> },
    { key: 'riskScore', header: 'Risk Score', render: (val: any) => <RiskBadge score={Number(val || 0)} /> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" /> External Destinations & Threat Intelligence
          </h1>
          <p className="text-xs text-slate-400">Observed external connection endpoints & ASN categorization</p>
        </div>
      </div>

      <DataTable data={destinations} columns={columns} />
    </div>
  );
}
'''

# 19. Network Services Page
files["app/network/services/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { getServices } from '@/lib/mock/services';
import type { NetworkService } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { Cpu } from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<NetworkService[]>([]);

  useEffect(() => {
    getServices().then(setServices);
  }, []);

  const columns = [
    { key: 'port', header: 'Port', mono: true },
    { key: 'transport', header: 'Transport', mono: true },
    { key: 'application', header: 'Application', render: (val: any) => <span className="font-bold text-slate-100">{String(val || '—')}</span> },
    { key: 'ip', header: 'Server IP', mono: true },
    { key: 'flows', header: 'Flow Count', mono: true },
    { key: 'riskScore', header: 'Risk Score', render: (val: any) => <RiskBadge score={Number(val || 0)} /> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-400" /> Discovered Network Services
          </h1>
          <p className="text-xs text-slate-400">DPI application breakdown and active listening ports</p>
        </div>
      </div>

      <DataTable data={services} columns={columns} />
    </div>
  );
}
'''

# 20. Network Mesh Page (Flagship)
files["app/network/mesh/page.tsx"] = ''''use client';

import React from 'react';
import { NetworkMesh } from '@/components/network/NetworkMesh';

export default function NetworkMeshPage() {
  return (
    <div className="h-[calc(100vh-100px)] w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative">
      <NetworkMesh />
    </div>
  );
}
'''

# 21. Threat Hunting Page
files["app/hunt/page.tsx"] = ''''use client';

import React from 'react';
import { Crosshair, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function HuntPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-red-400" /> Threat Hunting Console
        </h1>
        <p className="text-xs text-slate-400">Proactive network hypothesis testing & query building</p>
      </div>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <label className="block text-xs font-medium text-slate-400">Query Construction</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            defaultValue="flow.periodicity.jitter < 0.05 and dst.rarity == 'rare'" 
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200" 
          />
          <Button variant="primary">
            <Search className="w-4 h-4" /> Run Hunt
          </Button>
        </div>
      </div>
    </div>
  );
}
'''

# 22. AI Investigator Page
files["app/ai/page.tsx"] = ''''use client';

import React, { useState } from 'react';
import { Bot, Send, ShieldAlert, FileText, CheckCircle } from 'lucide-react';

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'NetSentinal AI Assistant initialized. I have indexed all evidence from CAP-1050 and correlated findings for INC-2026-041. How can I assist with your investigation?'
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Analyzing query: "${userMsg}". Evidence from CAP-1050 confirms host 10.0.0.14 initiated periodic TLS sessions to 45.77.21.184 with 61.2s mean interval. High periodicity and destination novelty indicate automated beaconing.`
      }]);
    }, 800);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
        <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-100">Evidence-Backed AI Investigator</h2>
          <p className="text-xs text-slate-400">Context aware analysis based on CAP-1050 & INC-2026-041</p>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 max-w-3xl ${m.role === 'user' ? 'ml-auto justify-end' : ''}`}>
            {m.role === 'assistant' && (
              <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg h-fit">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div className={`p-4 rounded-xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-200'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI about C2 behavior, evidence hashes, or incident summary..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-blue-500" 
        />
        <button onClick={handleSend} className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
'''

# 23. Reports Hub
files["app/reports/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getReports } from '@/lib/mock/services';
import type { Report } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { FileText, Plus } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    getReports().then(setReports);
  }, []);

  const columns = [
    { key: 'id', header: 'ID', mono: true },
    { key: 'title', header: 'Report Title', render: (val: any) => <span className="font-bold text-slate-100">{String(val)}</span> },
    { key: 'type', header: 'Type' },
    { key: 'createdBy', header: 'Author' },
    { key: 'status', header: 'Status', render: (val: any) => <StatusBadge status={String(val)} /> },
    {
      key: 'action', header: 'Action', render: (_: any, row: Report) => (
        <Link href={`/reports/${row.id}/edit`} className="text-xs text-blue-400 hover:underline font-semibold">
          Edit Consultancy Report
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" /> Consultancy & Assessment Reports Hub
          </h1>
          <p className="text-xs text-slate-400">Formal security assessment reports and executive summaries</p>
        </div>
      </div>

      <DataTable data={reports} columns={columns} />
    </div>
  );
}
'''

# 24. Report Editor Page
files["app/reports/[reportId]/edit/page.tsx"] = ''''use client';

import React from 'react';
import { FileText, Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function EditReportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Q3 Network Security Assessment — Incident Report INC-2026-041</h1>
          <p className="text-xs text-slate-400">Author: Alex Morgan • Customer: Acme Financial Services</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Save className="w-3.5 h-3.5" /> Save Draft
          </Button>
          <Button variant="primary" size="sm">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100 border-b border-slate-800 pb-2">1. Executive Summary</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            During the Q3 Network Security Assessment for Acme Financial Services, NetSentinal AI detected anomalous outbound communications originating from workstation FIN-WS-014 (10.0.0.14). Continuous evidence collection via sensor SNS-042 preserved 684 MB of high-fidelity PCAP data (CAP-1050), corroborating periodic beaconing behavior to external IP 45.77.21.184.
          </p>
        </div>
      </div>
    </div>
  );
}
'''

# 25. Evidence Vault Page
files["app/evidence/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { getEvidence } from '@/lib/mock/services';
import type { Evidence } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { ShieldCheck } from 'lucide-react';

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  useEffect(() => {
    getEvidence().then(setEvidence);
  }, []);

  const columns = [
    { key: 'id', header: 'ID', mono: true },
    { key: 'type', header: 'Evidence Type' },
    { key: 'source', header: 'Source' },
    { key: 'hash', header: 'SHA-256 Hash', mono: true },
    { key: 'integrity', header: 'Integrity', render: (val: any) => <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Verified</span> }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" /> Evidence Vault & Chain of Custody
        </h1>
        <p className="text-xs text-slate-400">Cryptographically verified forensic artifacts</p>
      </div>

      <DataTable data={evidence} columns={columns} />
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

