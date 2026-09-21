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
import { getHealth } from '../lib/api';

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

const RIGHT_TELEMETRY = [
  { val: '-16', color: 'text-red-500' },
  { val: '-127', color: 'text-red-500' },
  { val: '+3', color: 'text-emerald-400' },
  { val: '-87', color: 'text-red-500' },
  { val: '-58', color: 'text-red-500' },
];

export default function PublicHomePage() {
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [githubStars] = useState(5420);
  const [signalStats, setSignalStats] = useState({
    nodes: 18,
    activeEdges: 42,
    suspiciousFlows: 3,
    lastAnalysis: 'Live (<1s)',
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    getHealth()
      .then((h) => {
        setSignalStats((prev) => ({
          ...prev,
          nodes: h.flows_loaded > 0 ? Math.min(24, Math.floor(h.flows_loaded / 3)) : prev.nodes,
          suspiciousFlows: h.alerts_loaded || prev.suspiciousFlows,
        }));
      })
      .catch(() => {});

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

      {/* ─── FIXED RIGHT EDGE TELEMETRY NUMBERS ────────────────────────────── */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-6 font-mono text-xs z-30 pointer-events-none drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
        {RIGHT_TELEMETRY.map((item, idx) => (
          <div key={idx} className={`font-bold tracking-widest ${item.color}`}>
            {item.val}
          </div>
        ))}
      </div>

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
                Network Intelligence
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#narrative" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#trust" className="hover:text-white transition-colors">Trust Model</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
              <span>Docs</span>
              <ExternalLink className="w-3 h-3 text-zinc-600" />
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all"
            >
              <GithubIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>Star</span>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-400 border border-white/5">
                {(githubStars / 1000).toFixed(1)}k
              </span>
            </a>

            <Link
              href="/overview"
              className="relative group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3DD9C4] text-black font-semibold text-xs tracking-wide hover:bg-[#34c4b0] transition-all duration-200 shadow-[0_0_20px_rgba(61,217,196,0.35)] active:scale-95"
            >
              <span>Explore your network</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero Section: Lumina Minimal & Calm Copy ──────────────── */}
      <section className="relative min-h-[88vh] flex flex-col justify-center pt-32 pb-20 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Tagline Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono font-bold tracking-widest uppercase">
              NETWORK INTELLIGENCE, CLARIFIED
            </span>
          </motion.div>

          {/* Clean Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.06]"
          >
            See what's{' '}
            <span className="text-[#3DD9C4] block sm:inline">actually happening.</span>
          </motion.h1>

          {/* Minimal Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto font-normal leading-relaxed"
          >
            PRISM gives security and platform teams a calm, legible view of every connection, anomaly, and emerging risk. See the signal before it becomes noise.
          </motion.p>

          {/* Action Toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              href="/overview"
              className="px-7 py-3 rounded-full bg-white text-black font-semibold text-xs tracking-wide hover:bg-zinc-200 transition-all shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-95 flex items-center gap-2"
            >
              <span>Explore your network</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <a
              href="#narrative"
              className="px-6 py-3 rounded-full bg-black/60 backdrop-blur-xl hover:bg-black/80 border border-white/15 text-xs font-medium text-zinc-300 transition-all"
            >
              How it works ∨
            </a>
          </motion.div>

          {/* Minimal Trust Indicator Strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 inline-flex items-center gap-3 text-xs font-mono text-zinc-500"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Live by design</span>
            <span className="text-zinc-700">/</span>
            <span>Built for signal, not spectacle</span>
          </motion.div>

          {/* Install Command */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-8 flex justify-center"
          >
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/10 font-mono text-xs text-zinc-400 hover:border-white/25 transition-all">
              <span className="text-zinc-600 select-none">&gt;_</span>
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

      {/* ─── GLASSMORPHISM PIPELINE CARDS ─────────────────────────────────── */}
      <section id="narrative" className="relative py-24 z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 text-xs font-mono text-[#3DD9C4] backdrop-blur-md">
              <Layers className="w-3.5 h-3.5" />
              <span>THE PRISM PIPELINE</span>
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Calmer Way to Telemetry Truth
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
      <section id="trust" className="relative py-20 z-10">
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

      {/* ─── FOOTER ────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 py-10 bg-black/60 backdrop-blur-2xl text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 flex items-center justify-center text-[#3DD9C4]">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white tracking-wide">PRISM</span>
            <span>—</span>
            <span>Network Intelligence</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/overview" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
            <a href="#narrative" className="hover:text-zinc-300 transition-colors">Pipeline</a>
            <a href="#trust" className="hover:text-zinc-300 transition-colors">Trust Model</a>
          </div>

          <div>
            © {new Date().getFullYear()} PRISM. Built for signal, not spectacle.
          </div>
        </div>
      </footer>

    </div>
  );
}
