'use client';

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
