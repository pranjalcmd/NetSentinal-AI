'use client';

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
