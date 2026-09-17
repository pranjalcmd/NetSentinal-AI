'use client';

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
