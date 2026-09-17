'use client';

import React, { useState } from 'react';

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'NetSentinal AI Forensics Assistant online. Indexed evidence from CAP-1050 (684 MB) and correlated findings for INC-2026-041. Telemetry engine ready for queries.'
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Telemetry Query: "${userMsg}". Evidence from CAP-1050 confirms host 10.0.0.14 initiated periodic TLS sessions to 45.77.21.184 with 61.2s mean interval. High periodicity and destination novelty indicate automated C2 beaconing.`
      }]);
    }, 600);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col border border-[#1E293B]/60 bg-[#060910] font-mono text-[#C1C9D6]">
      {/* HEADER */}
      <div className="p-4 border-b border-[#1E293B]/60 flex items-center justify-between bg-[#090d16]">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>SYNTHESIS LAYER</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">evidence-backed LLM copilot</span>
          </div>
          <h1 className="text-sm tracking-widest text-[#E2E8F0] uppercase mt-0.5 font-semibold">
            AI Forensics Assistant
          </h1>
        </div>

        <div className="text-[0.65rem] text-[#3DD9C4] border border-[#3DD9C4]/40 px-2.5 py-1 bg-[#3DD9C4]/5 uppercase">
          INDEXED: CAP-1050 / INC-2026-041
        </div>
      </div>

      {/* MESSAGES STREAM */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl p-4 border text-xs leading-relaxed ${
              m.role === 'user' ?
                'border-[#3DD9C4]/60 bg-[#3DD9C4]/10 text-[#E2E8F0]' :
                'border-[#1E293B]/80 bg-[#090d16] text-[#C1C9D6]'
            }`}>
              <div className="text-[0.6rem] uppercase tracking-wider text-[#7C8798] mb-1">
                {m.role === 'user' ? 'ANALYST QUERY' : 'AI FORENSICS SYNTHESIS'}
              </div>
              <div>{m.content}</div>
            </div>
          </div>
        ))}
      </div>

      {/* INPUT CONSOLE */}
      <div className="p-4 border-t border-[#1E293B]/60 bg-[#090d16] flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="ENTER TELEMETRY QUERY OR C2 ANALYSIS QUESTION..."
          className="flex-1 bg-[#060910] border border-[#1E293B] px-4 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-[#3DD9C4]/60 uppercase tracking-wider"
        />
        <button
          onClick={handleSend}
          className="px-5 py-2 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4] bg-[#3DD9C4]/10 text-[#3DD9C4] hover:bg-[#3DD9C4]/20 transition-colors font-bold"
        >
          SEND →
        </button>
      </div>
    </div>
  );
}
