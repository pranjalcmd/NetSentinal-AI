'use client';

import React, { useState, useEffect } from 'react';
import { askAI, generateReport, getAlerts, CanonicalAlert } from '@/lib/api';
import { Sparkles, Send, FileText, Bot, ShieldAlert, RefreshCw, Check } from 'lucide-react';

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; evidence?: any[] }>>([
    {
      role: 'assistant',
      content: 'PRISM Security Advisory Assistant online. Connected to FastAPI pipeline. Ask any question about network anomalies, C2 beaconing, or request an explainable incident report.',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState<any>(null);
  const [alerts, setAlerts] = useState<CanonicalAlert[]>([]);

  useEffect(() => {
    getAlerts().then(setAlerts).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await askAI(userMsg);
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
          content: `AI Analysis Error: ${err.message || 'Failed to reach AI service'}.`,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await generateReport('PRISM Executive Threat & Advisory Report');
      setReportGenerated(res);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `📄 Executive Report Generated: "${res.title || 'PRISM Executive Report'}". Summary: ${res.summary || res.executive_summary || 'Full SOC incident analysis synthesized.'}`,
        }
      ]);
    } catch (err: any) {
      alert(`Report Generation Failed: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#04060c] text-white font-mono">
      
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 text-[#3DD9C4]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span>AI SYNTHESIS & CONSULTANCY ENGINE</span>
              <span className="px-2 py-0.5 rounded bg-[#3DD9C4]/20 border border-[#3DD9C4]/40 text-[#3DD9C4] text-[10px]">
                PRD Section 9
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-sans">
              Explainable AI analyst layer connected to FastAPI `/api/ai/ask` and `/api/ai/report`
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={reportLoading}
          className="px-3.5 py-1.5 rounded-lg bg-[#3DD9C4] text-black font-bold text-xs flex items-center gap-2 hover:bg-[#32c7b3] transition-all shadow-[0_0_15px_rgba(61,217,196,0.3)] disabled:opacity-50"
        >
          {reportLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          <span>Generate Incident Report</span>
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#04060c]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-3xl p-4 rounded-xl border text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'border-[#3DD9C4]/50 bg-[#3DD9C4]/10 text-white'
                  : 'border-white/10 bg-zinc-950 text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-2 pb-1 border-b border-white/5">
                <span className="flex items-center gap-1.5 font-bold">
                  {m.role === 'user' ? 'ANALYST QUERY' : <><Bot className="w-3.5 h-3.5 text-[#3DD9C4]" /> AI EXPLANATION ENGINE</>}
                </span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="whitespace-pre-wrap font-sans text-sm">{m.content}</div>

              {m.evidence && m.evidence.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/10 text-[11px] text-zinc-400">
                  <span className="text-[#3DD9C4] font-bold">Traceable Evidence Used:</span>
                  <div className="mt-1 space-y-1">
                    {m.evidence.map((ev, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-black/60 border border-white/5 font-mono text-[10px]">
                        {JSON.stringify(ev)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="p-4 rounded-xl border border-white/10 bg-zinc-950 text-xs font-mono text-zinc-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#3DD9C4]" />
              <span>Synthesizing evidence and generating explanation...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Console */}
      <div className="p-4 border-t border-white/10 bg-zinc-950 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI analyst to explain anomalies, beaconing, or telemetry evidence..."
          className="flex-1 glass rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#3DD9C4]"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 rounded-xl bg-[#3DD9C4] text-black font-bold text-xs hover:bg-[#32c7b3] transition-all flex items-center gap-2 disabled:opacity-40"
        >
          <span>SEND</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
