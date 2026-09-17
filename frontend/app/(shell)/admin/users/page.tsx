'use client';

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
