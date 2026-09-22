'use client';

import React, { useState, useEffect, useRef } from 'react';
import { askAI, generateReport, getAlerts, CanonicalAlert } from '@/lib/api';
import { Sparkles, Send, FileText, Bot, X, RefreshCw, ChevronRight, MessageSquare } from 'lucide-react';

export function AICopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; evidence?: any[] }>>([
    {
      role: 'assistant',
      content: 'Hello analyst! I am your AI Copilot. Ask any question about live network flows, rule alerts, or request an explainable incident report.',
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || loading) return;
    if (!textToSend) setInput('');

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await askAI(q);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          evidence: res.evidence_used,
        }
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `AI Copilot Error: ${err.message || 'Failed to connect to AI engine'}.`,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await generateReport('NetSentinel Executive SOC Copilot Report');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `📄 Executive Report Synthesized: "${res.title || 'NetSentinel Executive Report'}". Summary: ${res.summary || res.executive_summary || 'Incident evidence compiled.'}`,
        }
      ]);
    } catch (err: any) {
      alert(`Report Generation Failed: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <>
      {/* ─── Floating Trigger Button (Bottom-Right Corner) ──────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-zinc-950/90 backdrop-blur-xl border border-[#3DD9C4]/50 text-white shadow-[0_0_30px_rgba(61,217,196,0.35)] hover:border-[#3DD9C4] hover:shadow-[0_0_40px_rgba(61,217,196,0.5)] transition-all duration-300 group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#3DD9C4]/20 border border-[#3DD9C4]/40 flex items-center justify-center text-[#3DD9C4] group-hover:scale-110 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col text-left font-mono">
            <span className="text-xs font-bold text-white tracking-wide">AI Copilot</span>
            <span className="text-[9px] text-[#3DD9C4]">SOC Assistant</span>
          </div>
          <span className="flex h-2 w-2 rounded-full bg-[#3DD9C4] animate-pulse ml-1" />
        </button>
      )}

      {/* ─── Slide-Over AI Copilot Drawer (Right Edge Panel) ───────────────── */}
      {isOpen && (
        <div className="fixed top-0 right-0 bottom-0 w-96 max-w-full z-50 bg-black/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col font-mono selection:bg-[#3DD9C4]/30 selection:text-[#3DD9C4] animate-in slide-in-from-right duration-300">
          
          {/* Copilot Header */}
          <div className="p-4 border-b border-white/10 bg-zinc-950 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 text-[#3DD9C4]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>AI Copilot</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/30">
                    ONLINE
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400">Telemetry Synthesis Engine</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 text-[10px] flex items-center gap-1"
                title="Generate Incident Report"
              >
                {reportLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3DD9C4]" /> : <FileText className="w-3.5 h-3.5 text-[#3DD9C4]" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2 bg-zinc-950/60 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto text-[10px] scrollbar-none">
            <button
              onClick={() => handleSend('Explain recent high-risk alerts')}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/5 whitespace-nowrap"
            >
              ⚡ Explain alerts
            </button>
            <button
              onClick={() => handleSend('Check for DNS tunneling')}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/5 whitespace-nowrap"
            >
              🔍 DNS Tunneling
            </button>
            <button
              onClick={() => handleSend('Summarize network health')}
              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/5 whitespace-nowrap"
            >
              📊 Health summary
            </button>
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-black/40">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#3DD9C4]/15 border border-[#3DD9C4]/40 text-white'
                      : 'bg-zinc-950 border border-white/10 text-zinc-200'
                  }`}
                >
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1 flex items-center justify-between">
                    <span>{m.role === 'user' ? 'Analyst' : 'Copilot'}</span>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-xs">{m.content}</div>

                  {m.evidence && m.evidence.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px]">
                      <span className="text-[#3DD9C4] font-bold">Evidence Ref:</span>
                      <div className="mt-1 p-1 bg-black rounded border border-white/5 font-mono text-[9px] truncate">
                        {JSON.stringify(m.evidence[0])}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-zinc-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3DD9C4]" />
                  <span>Synthesizing answer...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Console */}
          <div className="p-3 border-t border-white/10 bg-zinc-950 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Copilot..."
              className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3DD9C4]"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-[#3DD9C4] text-black font-bold text-xs hover:bg-[#32c7b3] transition-all flex items-center justify-center disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      )}
    </>
  );
}
