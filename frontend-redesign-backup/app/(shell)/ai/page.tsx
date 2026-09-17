'use client';

import React, { useState } from 'react';
import { aiAsk, aiReport } from '@/lib/api';

// The real assistant: questions go to POST /api/ai/ask, the capture briefing
// button to POST /api/ai/report. Both are answered from the analysed capture
// on the backend — nothing here is scripted.

type Msg = { role: 'user' | 'assistant'; content: string };

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: 'NetSentinal AI Assistant online. Ask anything about the traffic in the current capture — flagged hosts, suspicious flows, protocol breakdown, anything the analysis pipeline saw.'
    }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (text: string, mode: 'ask' | 'report') => {
    if (!text.trim() || busy) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    try {
      if (mode === 'ask') {
        const res = await aiAsk(text);
        const evidence = res?.evidence?.length ? `\n\nEvidence:\n- ${res.evidence.slice(0, 5).join('\n- ')}` : '';
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `${res?.answer ?? 'No answer came back.'}${evidence}`
        }]);
      } else {
        const r: Record<string, unknown> = (await aiReport()) ?? {};
        const obs = (r['key_observations'] as string[] | undefined) ?? [];
        const priorities = (r['priorities'] as Array<{ target: string; why: string; next_step: string }> | undefined) ?? [];
        const caveats = (r['caveats'] as string[] | undefined) ?? [];
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: [
            String(r['executive_summary'] ?? 'No briefing available.'),
            obs.length ? `\nKey observations:\n- ${obs.join('\n- ')}` : '',
            priorities.length ? `\nPriorities:\n${priorities.map(p => `- ${p.target}: ${p.why} → ${p.next_step}`).join('\n')}` : '',
            caveats.length ? `\nCaveats:\n- ${caveats.join('\n- ')}` : '',
          ].filter(Boolean).join('\n')
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Could not reach the analysis backend. Is it running on :8000? Start it with: uvicorn backend.app.main:app'
      }]);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = () => send(input, 'ask');

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col border border-[#1E293B]/60 bg-[#060910] font-mono text-[#C1C9D6]">
      {/* HEADER */}
      <div className="p-4 border-b border-[#1E293B]/60 flex items-center justify-between bg-[#090d16]">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>AI ANALYSIS</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">ask about the analysed traffic</span>
          </div>
          <h1 className="text-sm text-[#E2E8F0] mt-0.5 font-semibold">
            AI Assistant
          </h1>
        </div>

        <button
          onClick={() => send('Give me the full analyst briefing for this capture.', 'report')}
          disabled={busy}
          className="text-[0.65rem] text-[#3DD9C4] border border-[#3DD9C4]/40 px-2.5 py-1 bg-[#3DD9C4]/5 uppercase hover:bg-[#3DD9C4]/15 transition-colors disabled:opacity-50"
        >
          {busy ? 'WORKING…' : 'GENERATE BRIEFING'}
        </button>
      </div>

      {/* MESSAGES STREAM */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl p-4 border text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === 'user' ?
                'border-[#3DD9C4]/60 bg-[#3DD9C4]/10 text-[#E2E8F0]' :
                'border-[#1E293B]/80 bg-[#090d16] text-[#C1C9D6]'
            }`}>
              <div className="text-[0.6rem] uppercase tracking-wider text-[#7C8798] mb-1">
                {m.role === 'user' ? 'ANALYST QUERY' : 'AI ANALYSIS'}
              </div>
              <div>{m.content}</div>
            </div>
          </div>
        ))}
        {busy && (
          <div className="text-[0.65rem] uppercase tracking-wider text-[#7C8798] animate-pulse">
            analysing capture…
          </div>
        )}
      </div>

      {/* INPUT CONSOLE */}
      <div className="p-4 border-t border-[#1E293B]/60 bg-[#090d16] flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about the current capture — hosts, flows, alerts…"
          className="flex-1 bg-[#060910] border border-[#1E293B] px-4 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-[#3DD9C4]/60 tracking-wider"
        />
        <button
          onClick={handleSend}
          disabled={busy}
          className="px-5 py-2 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4] bg-[#3DD9C4]/10 text-[#3DD9C4] hover:bg-[#3DD9C4]/20 transition-colors font-bold disabled:opacity-50"
        >
          SEND →
        </button>
      </div>
    </div>
  );
}
