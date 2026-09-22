'use client';

import React, { useEffect, useState } from 'react';
import { getNotifications as getApiNotifications } from '@/lib/api';
import { getNotifications as getMockNotifications } from '@/lib/mock/services';
import type { AppNotification } from '@/lib/types';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const apiData = await getApiNotifications();
        if (mounted) {
          setNotifications((apiData || []).map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            timestamp: n.timestamp,
            type: n.type,
          })));
          setLoading(false);
        }
      } catch (e) {
        console.warn('Backend API failed loading notifications', e);
        if (mounted) {
          setNotifications([]);
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-mono">
      <div>
        <h1 className="text-xl font-bold text-[#E2E8F0] flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#3DD9C4]" /> Notifications & Alerts Center
        </h1>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center border border-[#1E293B]/60 bg-[#060910] text-[#7C8798] uppercase text-[0.65rem]">
            Loading System Notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center border border-[#1E293B]/60 bg-[#060910] text-[#7C8798] uppercase text-[0.65rem]">
            No notifications available.
          </div>
        ) : notifications.map(n => (
          <div key={n.id} className="p-4 bg-[#090d16] border border-[#1E293B]/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#E2E8F0]">{n.title}</h3>
              <p className="text-xs text-[#94A3B8] mt-1 font-sans leading-relaxed">{n.message}</p>
            </div>
            <span className="text-[10px] text-[#7C8798]">{n.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

