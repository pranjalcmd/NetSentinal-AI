'use client';

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
