'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowRight,
  ExternalLink,
  Activity,
  Cpu,
  Lock,
  Globe,
  Database,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  Zap,
  Eye,
  Layers,
  Sparkles
} from 'lucide-react';
import { HeroKaizenEarth } from '@/components/graphics/HeroKaizenEarth';
import { getNetworkGraph, getDashboard, getJobs } from '../lib/api';

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

// Floating telemetry numbers on right edge (PRD Signal in the dark theme)
export default function PublicHomePage() {
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Nulls until the API answers. The hero states what was analysed, so a
  // placeholder here is a claim about someone's network.
  const [signalStats, setSignalStats] = useState<{
    nodes: number | null;
    activeEdges: number | null;
    suspiciousFlows: number | null;
    lastAnalysis: string;
  }>({ nodes: null, activeEdges: null, suspiciousFlows: null, lastAnalysis: '—' });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    Promise.all([
      getNetworkGraph().catch(() => null),
      getDashboard().catch(() => null),
      getJobs().catch(() => null),
    ]).then(([graph, dashboard, jobs]) => {
      const analysedAt = jobs?.[0]?.created_at ? new Date(jobs[0].created_at) : null;
      const ageMs = analysedAt ? Date.now() - analysedAt.getTime() : null;
      setSignalStats({
        nodes: graph?.nodes?.length ?? null,
        activeEdges: graph?.edges?.length ?? null,
        suspiciousFlows: dashboard?.suspicious_flows ?? null,
        lastAnalysis:
          ageMs === null ? '—'
            : ageMs < 60_000 ? 'Live'
            : ageMs < 3_600_000 ? `${Math.round(ageMs / 60_000)}m ago`
            : `${Math.round(ageMs / 3_600_000)}h ago`,
      });
    });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('pip install prism-sec');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#3DD9C4]/30 selection:text-[#3DD9C4] relative overflow-hidden">
      
      {/* ─── FIXED 3D EARTH SPHERE & CONCENTRIC ORBITAL RINGS BACKGROUND ─── */}
      <HeroKaizenEarth />


      {/* ─── Header / Navigation ─────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-black/60 backdrop-blur-2xl border-b border-white/10 py-3 shadow-2xl'
            : 'bg-transparent py-5 border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 flex items-center justify-center text-[#3DD9C4] group-hover:scale-105 transition-all duration-300 shadow-[0_0_15px_rgba(61,217,196,0.3)]">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-wider text-white flex items-center gap-2">
                PRISM
              </span>
              <span className="text-[9px] text-[#3DD9C4] font-mono tracking-widest uppercase font-semibold">
                Threat Analytics & Consultancy
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#narrative" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#trust" className="hover:text-white transition-colors">Trust Model</a>
            <a href="https://github.com/pranjalcmd/NetSentinal-AI" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
              <span>Docs</span>
              <ExternalLink className="w-3 h-3 text-zinc-600" />
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/pranjalcmd/NetSentinal-AI"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all"
            >
              <GithubIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>Star</span>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-400 border border-white/5">
              </span>
            </a>

            <Link
              href="/overview"
              className="relative group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3DD9C4] text-black font-semibold text-xs tracking-wide hover:bg-[#34c4b0] transition-all duration-200 shadow-[0_0_20px_rgba(61,217,196,0.35)] active:scale-95"
            >
              <span>Explore Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Section: PRISM — Signal in the Dark ──────────────── */}
      <section className="relative min-h-[88vh] flex flex-col justify-center pt-32 pb-20 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Official Tagline Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3DD9C4]/10 border border-[#3DD9C4]/40 text-[#3DD9C4] text-[10px] font-mono tracking-widest uppercase">
              PRISM — EXPLAINABLE THREAT ANALYTICS &amp; SECURITY ADVISORY
            </span>
          </motion.div>

          {/* PRISM Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white leading-[1.15] max-w-3xl mx-auto"
          >
            Signal in the Dark:{' '}
            <span className="text-[#3DD9C4] block sm:inline">Every Threat Refracted &amp; Explainable.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 text-sm sm:text-base text-zinc-500 max-w-xl mx-auto font-normal leading-relaxed"
          >
            PRISM refracts complex network telemetry into clear, explainable threat intelligence. PCAP captures and live telemetry enter one spectral flow engine to build a connected 3D/2D security mesh.
          </motion.p>

          {/* Live Signal Readout Strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 inline-flex flex-wrap items-center justify-center gap-6 p-3.5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl text-xs font-mono shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3DD9C4] animate-pulse" />
              <span className="text-zinc-400">Nodes:</span>
              <span className="text-white font-bold">{signalStats.nodes ?? '—'}</span>
            </div>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Active Edges:</span>
              <span className="text-[#3DD9C4] font-bold">{signalStats.activeEdges ?? '—'}</span>
            </div>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Suspicious Flows:</span>
              <span className="text-amber-400 font-bold">{signalStats.suspiciousFlows ?? '—'}</span>
            </div>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Freshness:</span>
              <span className="text-emerald-400 font-bold">{signalStats.lastAnalysis}</span>
            </div>
          </motion.div>

          {/* Primary Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              href="/overview"
              className="px-6 py-3 rounded-full bg-[#3DD9C4] text-black font-semibold text-[13px] tracking-wide hover:bg-[#32c7b3] transition-colors active:scale-[0.98] flex items-center gap-2"
            >
              <span>Explore Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="https://github.com/pranjalcmd/NetSentinal-AI"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3.5 rounded-xl bg-black/60 backdrop-blur-xl hover:bg-black/80 border border-white/15 text-sm font-semibold text-zinc-300 transition-all flex items-center gap-2"
            >
              <GithubIcon className="w-4 h-4 text-zinc-400" />
              <span>Star on GitHub</span>
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400 font-mono"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Metadata-first privacy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>PCAP + live agent normalization</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>
              <span>Rules + ML explainable findings</span>
            </div>
          </motion.div>

          {/* Command Install Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-8 inline-flex items-center"
          >
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 font-mono text-xs text-zinc-300 shadow-2xl hover:border-white/30 transition-all">
              <span className="text-zinc-500 select-none">&gt;_</span>
              <span>pip install prism-sec</span>
              <button
                onClick={copyInstallCommand}
                title="Copy command"
                className="ml-2 text-zinc-400 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ─── GLASSMORPHISM PIPELINE CARDS: THE PRISM PIPELINE ─── */}
      <section id="narrative" className="relative py-32 z-10 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 text-xs font-mono text-[#3DD9C4] backdrop-blur-md">
              <Layers className="w-3.5 h-3.5" />
              <span>THE PRISM PIPELINE</span>
            </div>
            <h2 className="mt-4 text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              5 Steps to Complete Telemetry Refraction
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: '01', title: 'Capture', desc: 'PCAP files & lightweight sensor agent ingest.' },
              { step: '02', title: 'Normalize', desc: 'Single canonical Flow model across all telemetry.' },
              { step: '03', title: 'Detect', desc: 'DPI protocol identity + rule engine + ML scoring.' },
              { step: '04', title: 'Correlate', desc: 'Fuse alerts into connected incidents & threat graph.' },
              { step: '05', title: 'Explain', desc: 'Refracted evidence summaries & advisory reports.' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl backdrop-blur-2xl bg-black/40 border border-white/10 hover:border-[#3DD9C4]/50 hover:bg-black/60 transition-all duration-300 shadow-2xl relative flex flex-col justify-between group"
              >
                <div>
                  <span className="text-2xl font-extrabold font-mono text-[#3DD9C4] group-hover:scale-110 transition-transform inline-block">{item.step}</span>
                  <h3 className="text-lg font-bold text-white mt-3 mb-2">{item.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── GLASSMORPHISM TRUST STRIP ────────────────────── */}
      <section id="trust" className="relative py-32 z-10 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: Lock, title: 'Metadata-First Privacy', desc: 'Zero raw payload retention. No tokens, passwords, or cookies captured.' },
              { icon: Cpu, title: 'PCAP + Live Agent', desc: 'Unified flow model for offline captures and live application telemetry.' },
              { icon: Activity, title: 'Rules + ML Scoring', desc: 'Explicit rule matches paired with anomaly detection models.' },
              { icon: Sparkles, title: 'Explainable Findings', desc: 'PRISM provides natural language explanation over verified evidence.' },
            ].map((trust, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl backdrop-blur-2xl bg-black/40 border border-white/10 hover:border-[#3DD9C4]/40 hover:bg-black/60 transition-all duration-300 text-left shadow-2xl"
              >
                <trust.icon className="w-6 h-6 text-[#3DD9C4] mb-4" />
                <h4 className="text-base font-bold text-white mb-2">{trust.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{trust.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GLASSMORPHISM FOOTER ────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 py-12 bg-black text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 flex items-center justify-center text-[#3DD9C4]">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white tracking-wide">PRISM</span>
            <span>—</span>
            <span>Threat Analysis &amp; Consultancy System</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/overview" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
            <a href="#narrative" className="hover:text-zinc-300 transition-colors">Pipeline</a>
            <a href="#trust" className="hover:text-zinc-300 transition-colors">Trust Model</a>
          </div>

          <div>
            © {new Date().getFullYear()} PRISM Security Advisory. Apache 2.0.
          </div>
        </div>
      </footer>

    </div>
  );
}
