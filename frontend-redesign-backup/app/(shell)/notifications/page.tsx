'use client';

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
