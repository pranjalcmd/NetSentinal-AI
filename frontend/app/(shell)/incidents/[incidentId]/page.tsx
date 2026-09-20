'use client';

import React, { use, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  Bot,
  ShieldAlert,
  Server,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  User,
  Radio,
  Activity,
  AlertTriangle,
  Send,
  ExternalLink,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { getIncident, getHosts, getFindings } from '@/lib/mock/services';
import type { Incident, Host, Finding, StoryStep } from '@/lib/types';
import { RiskBadge, ConfidenceBadge, StatusBadge, SeverityBadge } from '@/components/ui/Badge';

export default function IncidentDetailPage({ params }: { params?: Promise<{ incidentId: string }> | { incidentId: string } }) {
  const { incidentId } = params instanceof Promise ? use(params) : (params ?? { incidentId: '' });
  const [incident, setIncident] = useState<Incident | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  // Status & Analyst Notes state
  const [currentStatus, setCurrentStatus] = useState<string>('investigating');
  const [analystNotes, setAnalystNotes] = useState<string>('');
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [notesSavedToast, setNotesSavedToast] = useState(false);

  useEffect(() => {
    if (!incidentId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [incData, hData, fData] = await Promise.all([
          getIncident(incidentId),
          getHosts(),
          getFindings({ incidentId }),
        ]);
        setIncident(incData);
        setCurrentStatus(incData.status);
        if (incData.analystNotes) setAnalystNotes(incData.analystNotes);

        const filteredHosts = hData.filter(h => incData.hostIds.includes(h.id));
        setHosts(filteredHosts);
        setFindings(fData);
      } catch (err) {
        console.error(`Error loading incident ${incidentId}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [incidentId]);

  const handleStatusChange = (newStatus: string) => {
    setCurrentStatus(newStatus);
    if (incident) {
      setIncident({ ...incident, status: newStatus as any });
    }
  };

  const handleSaveNotes = () => {
    setNotesSavedToast(true);
    setTimeout(() => setNotesSavedToast(false), 3000);
  };

  const handleExportReport = () => {
    setExportMessage(`Report exported for incident ${incidentId}. PDF summary downloaded.`);
    setTimeout(() => setExportMessage(null), 4000);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 min-h-screen">
        <Activity className="w-8 h-8 animate-spin mx-auto text-cyan-500" />
        <p className="text-sm font-mono">Loading Incident Command Workspace...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-12 text-center space-y-4 min-h-screen">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Incident Not Found</h2>
        <p className="text-sm text-slate-400">Incident ID {incidentId} could not be loaded.</p>
        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Incidents
        </Link>
      </div>
    );
  }

  const storySteps: StoryStep[] = incident.story ?? [];

  const getStoryIcon = (type: string) => {
    switch (type) {
      case 'discovery': return <Radio className="w-4 h-4 text-yellow-400" />;
      case 'c2': return <ShieldAlert className="w-4 h-4 text-red-400" />;
      case 'exfiltration': return <Zap className="w-4 h-4 text-orange-400" />;
      case 'response': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'alert': return <Bot className="w-4 h-4 text-cyan-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100">
      {/* Toast notifications */}
      {exportMessage && (
        <div className="p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{exportMessage}</span>
          </div>
          <button onClick={() => setExportMessage(null)} className="text-cyan-400">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Link href="/incidents" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Incidents Workspace
            </Link>
            <span>/</span>
            <span className="font-mono text-cyan-400">{incident.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Incident Command: {incident.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition-all"
          >
            <Download className="w-4 h-4" />
            Export to Report
          </button>
        </div>
      </div>

      {/* Incident Status & Metadata Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Incident Risk</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-red-400">{incident.riskScore}</span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <div className="text-[11px] text-red-400/80 mt-1 font-mono">Critical Security Priority</div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Correlation Confidence</span>
          <div className="text-3xl font-bold font-mono text-teal-300">
            {Math.round(incident.confidence * 100)}%
          </div>
          <div className="mt-1">
            <ConfidenceBadge confidence={Math.round(incident.confidence * 100)} size="sm" />
          </div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Current Lifecycle Status</span>
          <div className="mt-2">
            <StatusBadge status={currentStatus} />
          </div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Assigned Consultant</span>
          <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
            <User className="w-4 h-4 text-cyan-400" />
            Alex Morgan
          </div>
          <div className="text-[11px] text-slate-400">Lead IR Investigator</div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Affected Hosts</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">{incident.hostIds.length} Hosts</div>
          <div className="text-[11px] text-slate-400 font-mono">FIN-WS-014, DEV-WS-028</div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Total Correlated Findings</span>
          <div className="text-2xl font-bold font-mono text-orange-400 mt-1">{incident.findingIds.length} Detections</div>
          <div className="text-[11px] text-slate-400">Cross-sensor correlated</div>
        </div>
      </div>

      {/* AI Incident Synthesis Card */}
      {incident.aiSummary && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI Incident Executive Synthesis</h2>
                <p className="text-xs text-slate-400 font-mono">Automated correlation & attack reconstruction</p>
              </div>
            </div>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Export Briefing
            </button>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-sans bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
            {incident.aiSummary}
          </p>
        </div>
      )}

      {/* Story Timeline & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Attack Story Narrative Timeline & Tables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Narrative Attack Story Timeline */}
          <div className="p-6 rounded-xl glass backdrop-blur-sm space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Narrative Incident Story Timeline
            </h2>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {storySteps.map((step, idx) => (
                <div key={idx} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1 p-1 rounded-full bg-slate-950 border border-slate-700 group-hover:border-cyan-500 transition-colors">
                    {getStoryIcon(step.type)}
                  </div>

                  <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white uppercase tracking-wider">{step.event}</span>
                        {step.findingId && (
                          <Link
                            href={`/findings/${step.findingId}`}
                            className="font-mono text-[11px] text-cyan-400 hover:underline bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                          >
                            {step.findingId}
                          </Link>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(step.timestamp).toLocaleTimeString()} · {new Date(step.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlated Hosts Table */}
          <div className="p-6 rounded-xl glass backdrop-blur-sm space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              Correlated Internal Hosts
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[11px] text-slate-400 uppercase font-semibold">
                    <th className="p-3">Host IP & Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Risk Score</th>
                    <th className="p-3">Total Flows</th>
                    <th className="p-3">Traffic Vol (Out/In)</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {hosts.map(h => (
                    <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <Link href={`/network/hosts/${h.id}`} className="hover:text-cyan-300 hover:underline font-bold text-white">
                          {h.ip}
                        </Link>
                        <span className="block text-[11px] text-slate-400 font-sans">{h.hostname}</span>
                      </td>
                      <td className="p-3 font-sans text-slate-300">{h.role ?? 'Workstation'}</td>
                      <td className="p-3">
                        <RiskBadge score={h.riskScore} size="sm" />
                      </td>
                      <td className="p-3 text-slate-300">{h.flows.toLocaleString()}</td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {(h.bytesOut / 1024 / 1024 / 1024).toFixed(2)} GB / {(h.bytesIn / 1024 / 1024).toFixed(1)} MB
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/network/hosts/${h.id}`}
                          className="text-xs text-cyan-400 hover:underline font-sans"
                        >
                          Forensics →
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {hosts.length === 0 && (
                    <>
                      <tr className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white">10.0.0.14 (FIN-WS-014)</td>
                        <td className="p-3 font-sans">Financial Workstation</td>
                        <td className="p-3"><RiskBadge score={89} size="sm" /></td>
                        <td className="p-3">14,290</td>
                        <td className="p-3">4.8 GB / 120 MB</td>
                        <td className="p-3 text-right"><Link href="/network/hosts/HOST-014" className="text-cyan-400 hover:underline font-sans">Forensics →</Link></td>
                      </tr>
                      <tr className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-white">10.0.0.28 (DEV-WS-028)</td>
                        <td className="p-3 font-sans">Dev Workstation</td>
                        <td className="p-3"><RiskBadge score={68} size="sm" /></td>
                        <td className="p-3">8,410</td>
                        <td className="p-3">840 MB / 45 MB</td>
                        <td className="p-3 text-right"><Link href="/network/hosts/HOST-028" className="text-cyan-400 hover:underline font-sans">Forensics →</Link></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Status Panel & Analyst Notes */}
        <div className="space-y-6">
          {/* Status Lifecycle Transition Panel */}
          <div className="p-6 rounded-xl glass backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Incident Lifecycle Triage
            </h2>

            <div className="space-y-2">
              {[
                { id: 'open', label: 'Open', desc: 'Newly correlated incident awaiting triage' },
                { id: 'investigating', label: 'Investigating', desc: 'Active forensic analysis & scope discovery' },
                { id: 'contained', label: 'Contained', desc: 'Affected hosts isolated, firewall rules active' },
                { id: 'resolved', label: 'Resolved', desc: 'Threat remediated, report submitted' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => handleStatusChange(st.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    currentStatus === st.id
                      ? 'bg-cyan-500/15 border-cyan-500/50 ring-1 ring-cyan-500/40 text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold capitalize">{st.label}</span>
                    {currentStatus === st.id && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{st.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Analyst Notes */}
          <div className="p-6 rounded-xl glass backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Analyst Workstation Notes
              </h2>
              {notesSavedToast && <span className="text-xs text-emerald-400 font-mono animate-fade-in">Saved!</span>}
            </div>

            <textarea
              rows={6}
              value={analystNotes}
              onChange={e => setAnalystNotes(e.target.value)}
              placeholder="Enter incident command notes, customer SOC contact log, firewall block confirmations..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />

            <button
              onClick={handleSaveNotes}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              Save Analyst Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
