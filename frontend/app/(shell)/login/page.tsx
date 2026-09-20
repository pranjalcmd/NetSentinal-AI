'use client';

import React from 'react';
import { PrismLogoIcon } from '@/components/graphics/PrismLogo';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md p-8 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-6 shadow-2xl">
        <div className="text-center space-y-3">
          <div className="p-3 bg-[#3DD9C4]/10 text-[#3DD9C4] rounded-2xl border border-[#3DD9C4]/30 w-fit mx-auto shadow-[0_0_20px_rgba(61,217,196,0.3)]">
            <PrismLogoIcon size={36} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider text-white">PRISM</h1>
          <p className="text-xs font-mono text-[#3DD9C4]">Threat Analytics &amp; Security Advisory System</p>
        </div>
      </div>
    </div>
  );
}
