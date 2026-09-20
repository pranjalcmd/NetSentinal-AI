import os

base_dir = "/Users/mdayansk/.gemini/antigravity/scratch/NetSentinal-AI/frontend"

files = {}

# 26. Timeline Page
files["app/timeline/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { getTimeline } from '@/lib/mock/services';
import type { TimelineEvent } from '@/lib/types';
import { Clock } from 'lucide-react';

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    getTimeline().then(setEvents);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" /> Master Chronological Network Timeline
        </h1>
        <p className="text-xs text-slate-400">Unified event sequence across sensors, captures, and detections</p>
      </div>

      <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 pl-10">
        {events.map((e) => (
          <div key={e.id} className="relative">
            <div className="absolute -left-10 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-4 border-slate-900" />
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-200">{e.title}</span>
                <span className="font-mono text-[10px] text-slate-500">{e.timestamp}</span>
              </div>
              <p className="text-xs text-slate-400">{e.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
'''

# 27. Sensors Fleet Page
files["app/sensors/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSensors } from '@/lib/mock/services';
import type { Sensor } from '@/lib/types';
import { DataTable } from '@/components/ui/DataTable';
import { SensorStatus } from '@/components/domain/SensorStatus';
import { Wifi } from 'lucide-react';

export default function SensorsPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);

  useEffect(() => {
    getSensors().then(setSensors);
  }, []);

  const columns = [
    { key: 'id', header: 'Sensor ID', mono: true },
    { key: 'name', header: 'Name', render: (val: any) => <span className="font-bold text-slate-100">{String(val)}</span> },
    { key: 'interface', header: 'Interface', mono: true },
    { key: 'os', header: 'OS Platform' },
    { key: 'status', header: 'Status', render: (val: any) => <SensorStatus status={val} /> },
    {
      key: 'action', header: 'Action', render: (_: any, row: Sensor) => (
        <Link href={`/sensors/${row.id}`} className="text-xs text-blue-400 hover:underline font-semibold">
          Sensor Diagnostics
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-400" /> Sensor Fleet Management
          </h1>
          <p className="text-xs text-slate-400">Deployed network capture nodes and hardware sensors</p>
        </div>
      </div>

      <DataTable data={sensors} columns={columns} />
    </div>
  );
}
'''

# 28. Sensor Detail Page
files["app/sensors/[sensorId]/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSensor } from '@/lib/mock/services';
import type { Sensor } from '@/lib/types';
import { SensorStatus } from '@/components/domain/SensorStatus';
import { Wifi, Activity } from 'lucide-react';

export default function SensorDetailPage() {
  const params = useParams();
  const [sensor, setSensor] = useState<Sensor | null>(null);

  useEffect(() => {
    if (params.sensorId) {
      getSensor(String(params.sensorId)).then(setSensor);
    }
  }, [params.sensorId]);

  if (!sensor) return <div className="p-12 text-center text-slate-400">Loading sensor info...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{sensor.name}</span>
            <SensorStatus status={sensor.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Hostname: {sensor.hostname} • OS: {sensor.os}</p>
        </div>
      </div>
    </div>
  );
}
'''

# 29. Sensor Capture Config Page
files["app/sensors/[sensorId]/capture/page.tsx"] = ''''use client';

import React from 'react';

export default function SensorCaptureConfigPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100">Sensor Capture Engine Config</h1>
    </div>
  );
}
'''

# 30. Sensor Triggers Page
files["app/sensors/[sensorId]/triggers/page.tsx"] = ''''use client';

import React from 'react';

export default function SensorTriggersPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100">Sensor Preservation Triggers</h1>
    </div>
  );
}
'''

# 31. Health Page
files["app/health/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { getSystemHealth } from '@/lib/mock/services';
import type { SystemHealth } from '@/lib/types';
import { HeartPulse, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function HealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    getSystemHealth().then(setHealth);
  }, []);

  if (!health) return <div className="p-12 text-center text-slate-400">Loading platform health...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-emerald-400" /> Platform System Health
        </h1>
        <p className="text-xs text-slate-400">Real-time status of underlying microservices & ML models</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {health.components.map((c, i) => (
          <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">{c.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{c.detail || `Latency: ${c.latencyMs || 12}ms`}</p>
            </div>
            {c.status === 'healthy' ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Healthy</span>
            ) : (
              <span className="text-xs text-amber-400 font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Degraded</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
'''

# 32. Customers Page
files["app/customers/page.tsx"] = ''''use client';

import React from 'react';
import Link from 'next/link';
import { Building2 } from 'lucide-react';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" /> Client Directory
        </h1>
        <p className="text-xs text-slate-400">Enterprise consultancy client accounts</p>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100">Acme Financial Services</h3>
          <p className="text-xs text-slate-400 mt-1">Tier: Enterprise • Active Engagements: 2 • Contact: Jennifer Walsh</p>
        </div>
        <Link href="/customers/CUST-001" className="text-xs text-blue-400 hover:underline font-semibold">
          View Account
        </Link>
      </div>
    </div>
  );
}
'''

# 33. Customer Detail Page
files["app/customers/[customerId]/page.tsx"] = ''''use client';

import React from 'react';

export default function CustomerDetailPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-slate-100">Acme Financial Services Account</h1>
    </div>
  );
}
'''

# 34. Engagements Page
files["app/engagements/page.tsx"] = ''''use client';

import React from 'react';
import { Briefcase } from 'lucide-react';

export default function EngagementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-blue-400" /> Active Consultancy Engagements
        </h1>
        <p className="text-xs text-slate-400">Network forensics and security audit scopes</p>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
        <h3 className="text-base font-bold text-slate-100">Q3 Network Security Assessment</h3>
        <p className="text-xs text-slate-400">Scope: 10.0.0.0/24 internal segment • Lead Consultant: Alex Morgan</p>
      </div>
    </div>
  );
}
'''

# 35. Admin Users Page
files["app/admin/users/page.tsx"] = ''''use client';

import React from 'react';
import { Users } from 'lucide-react';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" /> User & Role Access Control
        </h1>
      </div>
    </div>
  );
}
'''

# 36. Admin Audit Page
files["app/admin/audit/page.tsx"] = ''''use client';

import React from 'react';
import { ScrollText } from 'lucide-react';

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-blue-400" /> Platform Security Audit Log
        </h1>
      </div>
    </div>
  );
}
'''

# 37. Settings Page
files["app/settings/page.tsx"] = ''''use client';

import React from 'react';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" /> Platform Configuration
        </h1>
      </div>
    </div>
  );
}
'''

# 38. Notifications Page
files["app/notifications/page.tsx"] = ''''use client';

import React, { useEffect, useState } from 'react';
import { getNotifications } from '@/lib/mock/services';
import type { AppNotification } from '@/lib/types';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    getNotifications().then(setNotifications);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-400" /> Notifications & Alerts Center
        </h1>
      </div>

      <div className="space-y-3">
        {notifications.map(n => (
          <div key={n.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">{n.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{n.message}</p>
            </div>
            <span className="text-[10px] text-slate-500">{n.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
'''

# 39. Login Page
files["app/login/page.tsx"] = ''''use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="p-3 bg-blue-600/10 text-blue-400 rounded-full w-fit mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">NetSentinal AI</h1>
          <p className="text-xs text-slate-400">Enterprise Cybersecurity Consultancy Console</p>
        </div>
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

