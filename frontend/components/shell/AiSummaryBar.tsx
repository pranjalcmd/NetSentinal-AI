'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Sparkles } from 'lucide-react';
import { generateReport } from '@/lib/api';

type Priority = { target?: string; why?: string; next_step?: string };
type Report = {
  provider?: string;
  executive_summary?: string;
  priorities?: Priority[];
  key_observations?: string[];
  data_notice?: string;
};

/**
 * One AI pass over the whole capture, pinned above every page.
 *
 * Fetched once per mount — the report costs a model call, and it describes the
 * loaded capture rather than the page being viewed, so there is nothing to
 * re-run on navigation. The provider is named on the strip: when the key is
 * spent this falls back to canned text built from the same counts, and saying
 * "mock" is the difference between a summary and a claim.
 */
export function AiSummaryBar() {
  const [report, setReport] = useState<Report | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    generateReport()
      .then((r) => { if (live) { setReport(r as Report); setState('ready'); } })
      // 409 when nothing has been analysed yet; anything else is the provider.
      .catch(() => { if (live) setState('unavailable'); });
    return () => { live = false; };
  }, []);

  if (state === 'unavailable') return null;

  const summary = report?.executive_summary;
  const top = report?.priorities?.[0];
  const live = report?.provider && report.provider !== 'mock';

  return (
    <div className="border-b border-white/[0.07] bg-white/[0.02] backdrop-blur-xl">
      <div className="px-6 py-2.5 flex items-center gap-3">
        <Sparkles className={`w-3.5 h-3.5 shrink-0 ${live ? 'text-[#3DD9C4]' : 'text-zinc-600'}`} />
        <span className="eyebrow shrink-0">AI summary</span>

        <p className="text-[13px] text-zinc-300 truncate flex-1 min-w-0">
          {state === 'loading' ? <span className="text-zinc-600">Reading the capture…</span> : summary}
        </p>

        {report?.provider && (
          <span
            className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-zinc-500"
            title={live ? 'Written by the configured model' : 'Model unavailable — built from the same counts'}
          >
            {live ? report.provider : 'mock'}
          </span>
        )}

        {state === 'ready' && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
            title={open ? 'Collapse' : 'Expand'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && state === 'ready' && (
        <div className="px-6 pb-4 pt-1 space-y-4">
          {top && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
              <span className="eyebrow">Start with</span>
              <Link href="/findings" className="font-mono text-[#3DD9C4] hover:underline">
                {top.target}
              </Link>
              <span className="text-zinc-400">{top.why}</span>
            </div>
          )}

          {report?.key_observations?.length ? (
            <ul className="space-y-1.5">
              {report.key_observations.slice(0, 4).map((o, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] text-zinc-400">
                  <span className="text-zinc-700">—</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {report?.data_notice && (
            <p className="text-[11px] text-zinc-600 max-w-3xl">{report.data_notice}</p>
          )}
        </div>
      )}
    </div>
  );
}
