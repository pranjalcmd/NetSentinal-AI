'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PrismLogoIconProps {
  className?: string;
  size?: number;
}

export function PrismLogoIcon({ className = '', size = 28 }: PrismLogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Glass Face Gradients */}
        <linearGradient id="prism-front" x1="50" y1="15" x2="20" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3DD9C4" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#030712" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="prism-side" x1="50" y1="15" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#a855f7" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
        </linearGradient>

        <linearGradient id="prism-[#3DD9C4]-ray" x1="0" y1="50" x2="100" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#3DD9C4" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
        </linearGradient>

        {/* Glow Filters */}
        <filter id="prism-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="strong-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Incident White Ray */}
      <line x1="5" y1="62" x2="42" y2="48" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.85" filter="url(#prism-glow)" />

      {/* Prism Base Shadow */}
      <ellipse cx="50" cy="85" rx="36" ry="7" fill="#3DD9C4" opacity="0.15" filter="url(#strong-glow)" />

      {/* Back Base Face */}
      <polygon points="20,80 80,80 50,86" fill="#090d16" opacity="0.8" />

      {/* Prism Left Face (Refractive Cyan) */}
      <polygon points="50,15 20,80 50,86" fill="url(#prism-front)" stroke="#3DD9C4" strokeWidth="1.2" strokeOpacity="0.8" />

      {/* Prism Right Face (Spectral Indigo/Violet) */}
      <polygon points="50,15 80,80 50,86" fill="url(#prism-side)" stroke="#818cf8" strokeWidth="1.2" strokeOpacity="0.7" />

      {/* Center Crystal Edge (Specular Highlight) */}
      <line x1="50" y1="15" x2="50" y2="86" stroke="#FFFFFF" strokeWidth="1.8" opacity="0.9" filter="url(#prism-glow)" />

      {/* Reflected & Dispersed Spectral Rays exiting Right */}
      {/* Ray 1: Cyan Threat Signal */}
      <path d="M50 48 L95 32" stroke="#3DD9C4" strokeWidth="2.5" opacity="0.95" filter="url(#prism-glow)" />
      {/* Ray 2: Electric Teal Analysis */}
      <path d="M50 50 L95 44" stroke="#2dd4bf" strokeWidth="2" opacity="0.85" />
      {/* Ray 3: Indigo Threat Graph */}
      <path d="M50 52 L95 56" stroke="#6366f1" strokeWidth="2" opacity="0.85" />
      {/* Ray 4: Violet Consultancy Stream */}
      <path d="M50 54 L95 68" stroke="#c084fc" strokeWidth="2.2" opacity="0.9" filter="url(#prism-glow)" />

      {/* Refraction Sparkle Center */}
      <circle cx="50" cy="50" r="3" fill="#FFFFFF" filter="url(#prism-glow)" />
    </svg>
  );
}

export function PrismHeroLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Ambient Pulsing Aura */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-[#3DD9C4]/30 via-indigo-500/20 to-purple-500/30 blur-3xl pointer-events-none"
      />

      {/* Geometric SVG Prism Display */}
      <svg
        width="160"
        height="160"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_0_35px_rgba(61,217,196,0.45)]"
      >
        <defs>
          <linearGradient id="hero-prism-front" x1="60" y1="12" x2="22" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E0F7F4" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#3DD9C4" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#082f49" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="hero-prism-right" x1="60" y1="12" x2="98" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#2e1065" stopOpacity="0.95" />
          </linearGradient>

          <filter id="hero-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Orbital Spectrum Ring */}
        <circle
          cx="60"
          cy="60"
          r="54"
          stroke="#3DD9C4"
          strokeWidth="1"
          strokeDasharray="4 8"
          opacity="0.3"
          className="animate-[spin_20s_linear_infinite]"
        />

        {/* Incoming Threat Ray (Raw Telemetry) */}
        <motion.line
          x1="6"
          y1="72"
          x2="48"
          y2="58"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#hero-glow)"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <text x="8" y="65" fill="#94a3b8" fontSize="6" fontFamily="monospace" letterSpacing="1">
          RAW PCAP
        </text>

        {/* Prism Base Glow */}
        <ellipse cx="60" cy="98" rx="42" ry="8" fill="#3DD9C4" opacity="0.25" filter="url(#hero-glow)" />

        {/* Prism Left Facet */}
        <polygon points="60,12 22,92 60,98" fill="url(#hero-prism-front)" stroke="#3DD9C4" strokeWidth="1.5" />

        {/* Prism Right Facet */}
        <polygon points="60,12 98,92 60,98" fill="url(#hero-prism-right)" stroke="#818cf8" strokeWidth="1.5" />

        {/* Specular Edge Line */}
        <line x1="60" y1="12" x2="60" y2="98" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.95" filter="url(#hero-glow)" />

        {/* Dispersed Spectral Rays (Explainable Security Intelligence) */}
        {/* Ray 1: Threat Detection (Cyan) */}
        <line x1="60" y1="58" x2="114" y2="34" stroke="#3DD9C4" strokeWidth="3" strokeLinecap="round" filter="url(#hero-glow)" />
        <circle cx="114" cy="34" r="3" fill="#3DD9C4" filter="url(#hero-glow)" />

        {/* Ray 2: Analytics & DPI (Teal) */}
        <line x1="60" y1="60" x2="116" y2="50" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" />

        {/* Ray 3: Consultancy Insight (Indigo) */}
        <line x1="60" y1="62" x2="115" y2="66" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />

        {/* Ray 4: Advisory Action (Violet) */}
        <line x1="60" y1="64" x2="112" y2="82" stroke="#c084fc" strokeWidth="3" strokeLinecap="round" filter="url(#hero-glow)" />
        <circle cx="112" cy="82" r="3" fill="#c084fc" filter="url(#hero-glow)" />
      </svg>
    </div>
  );
}
