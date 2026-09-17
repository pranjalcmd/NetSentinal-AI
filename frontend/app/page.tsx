'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Link from 'next/link';

// ─── 12 Active Sensor Node Locations ─────────────────────────────────────────
const SENSOR_NODES = [
  { lat: 40.7128,  lon: -74.0060 },  // New York
  { lat: 37.7749,  lon: -122.4194 }, // San Francisco
  { lat: 51.5074,  lon: -0.1278 },   // London
  { lat: 50.1109,  lon:  8.6821 },   // Frankfurt
  { lat: 59.3293,  lon: 18.0686 },   // Stockholm
  { lat: 35.6762,  lon: 139.6503 },  // Tokyo
  { lat:  1.3521,  lon: 103.8198 },  // Singapore
  { lat: -33.8688, lon: 151.2093 },  // Sydney
  { lat: 25.2048,  lon: 55.2708 },   // Dubai
  { lat: -23.5505, lon: -46.6333 },  // São Paulo
  { lat: -26.2041, lon: 28.0473 },   // Johannesburg
  { lat: 43.6532,  lon: -79.3832 },  // Toronto
];

function latLonToVec3(lat: number, lon: number, r: number) {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

// ─── Globe Component ──────────────────────────────────────────────────────────
function GlobeCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const scene    = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 800);
    camera.position.set(0, 0, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    container.appendChild(renderer.domElement);

    // ── Stars ────────────────────────────────────────────────────────────────
    const starBuf = new Float32Array(1600 * 3);
    for (let i = 0; i < starBuf.length; i++) starBuf[i] = (Math.random() - 0.5) * 280;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starBuf, 3));
    const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x7C8798, size: 0.45, transparent: true, opacity: 0.55 }));
    scene.add(starField);

    // ── Earth ────────────────────────────────────────────────────────────────
    const R = 4.2;
    const earthGrp = new THREE.Group();
    scene.add(earthGrp);

    // Procedural land canvas texture
    const tc = document.createElement('canvas');
    tc.width = 1024; tc.height = 512;
    const tctx = tc.getContext('2d')!;
    tctx.fillStyle = '#080c14'; // deep ocean
    tctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 5000; i++) {
      const u = Math.random() * 1024;
      const v = Math.random() * 512;
      const lat = (v / 512) * Math.PI - Math.PI / 2;
      const lon = (u / 1024) * Math.PI * 2;
      const land =
        (lat >  0.10 && lat < 1.10 && lon >  0.5  && lon < 2.55) ||
        (lat < -0.10 && lat > -0.90 && lon >  1.15 && lon < 2.25) ||
        (lat >  0.15 && lat < 1.25 && lon >  2.95 && lon < 5.25) ||
        (lat <  0.40 && lat > -0.75 && lon >  3.15 && lon < 4.25) ||
        (lat < -0.20 && lat > -0.80 && lon >  4.75 && lon < 5.85) ||
        (lat >  0.55 && lat < 0.80 && lon >  5.0  && lon < 5.5 );
      if (land) {
        tctx.beginPath();
        tctx.arc(u, v, Math.random() * 1.8 + 0.8, 0, Math.PI * 2);
        tctx.fillStyle = Math.random() > 0.35 ? '#1e2b3d' : '#172031';
        tctx.fill();
      }
    }
    const earthTex  = new THREE.CanvasTexture(tc);
    const earthMat  = new THREE.MeshPhongMaterial({ map: earthTex, shininess: 8, specular: new THREE.Color(0x1a2a40) });
    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), earthMat);
    earthGrp.add(earthMesh);

    // Thin cyan-teal atmosphere glow — BackSide so it frills the edge
    const atmMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.055, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x3DD9C4, transparent: true, opacity: 0.13, side: THREE.BackSide })
    );
    earthGrp.add(atmMesh);

    // ── Sensor ping nodes ────────────────────────────────────────────────────
    const pingRings: THREE.Mesh[] = [];
    SENSOR_NODES.forEach(({ lat, lon }) => {
      const pos = latLonToVec3(lat, lon, R * 1.012);

      // Core dot
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x3DD9C4 })
      );
      dot.position.copy(pos);
      earthGrp.add(dot);

      // Radiating ping ring (flat disc facing outward)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.04, 0.11, 32),
        new THREE.MeshBasicMaterial({ color: 0x3DD9C4, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      earthGrp.add(ring);
      pingRings.push(ring);
    });

    // ── Lighting ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xd4e0ee, 0.45));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(12, 8, 10);
    scene.add(sun);

    // ── Animation ────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf: number;
    // Start slightly past the Indian Ocean and slowly settle toward N. America / Europe
    earthGrp.rotation.y = Math.PI * 0.8;
    const TARGET_Y = Math.PI * 0.45;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Very slow settle rotation — mirrors arstraumur globe drift
      earthGrp.rotation.y += (TARGET_Y - earthGrp.rotation.y) * 0.008;
      earthGrp.rotation.x  = Math.sin(t * 0.14) * 0.028;

      // Pulsing ping rings
      pingRings.forEach((r, i) => {
        const s = 1 + (Math.sin(t * 3.5 + i * 0.7) + 1) * 0.85;
        r.scale.setScalar(s);
        (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 - s * 0.28);
      });

      starField.rotation.y = t * 0.008;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="sky-canvas" aria-hidden="true" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NetSentinalHome() {
  const [splashDone, setSplashDone] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [telemetry, setTelemetry] = useState('Initialising sensor mesh…');

  // Session-guard: only play once per session
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('ns_splash') === '1') {
      setSplashDone(true);
      setSplashVisible(false);
    }
  }, []);

  // Telemetry typing sequence inside globe
  useEffect(() => {
    if (splashDone) return;
    const seq = [
      { t: 400,  text: 'Locating sensor fleet…' },
      { t: 1100, text: 'SNS-042 · SNS-037 · SNS-051 online' },
      { t: 1900, text: 'Sensor Fleet · 12 nodes active worldwide' },
    ];
    const timers = seq.map(({ t, text }) => setTimeout(() => setTelemetry(text), t));
    const done = setTimeout(() => {
      sessionStorage.setItem('ns_splash', '1');
      setSplashDone(true);
      setTimeout(() => setSplashVisible(false), 900);
    }, 3800);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [splashDone]);

  const skipSplash = () => {
    sessionStorage.setItem('ns_splash', '1');
    setSplashDone(true);
    setTimeout(() => setSplashVisible(false), 400);
  };

  return (
    <>
      {/* ── Arstraumur-style Global CSS ────────────────────────────────────── */}
      <style>{`
        /* ── Reset / Base ─────────────────────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        body.ns-journey {
          background: #04060c;
          color: #E4E8EE;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 15px;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        /* ── Canvas sky (persists behind all bands) ───────────────────────── */
        .sky-canvas {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .sky-canvas canvas {
          width: 100% !important;
          height: 100% !important;
        }

        /* ── Site header (minimal, transparent until scroll) ─────────────── */
        .site-header {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2.5rem;
          height: 3rem;
          transition: background 0.3s;
        }
        .site-header.scrolled {
          background: rgba(4,6,12,0.88);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #242B36;
        }
        .site-header .brand {
          font-size: 0.875rem;
          font-weight: 500;
          color: #E4E8EE;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          letter-spacing: -0.01em;
        }
        .brand-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #3DD9C4;
          box-shadow: 0 0 8px #3DD9C4;
        }
        .brand-ai {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.625rem;
          color: #3DD9C4;
          border: 1px solid rgba(61,217,196,0.3);
          padding: 1px 5px;
          letter-spacing: 0.04em;
        }

        /* ── Site nav ────────────────────────────────────────────────────── */
        .site-nav { display: flex; align-items: center; gap: 1.75rem; }
        .site-nav a {
          font-size: 0.75rem;
          font-weight: 300;
          color: #7C8798;
          text-decoration: none;
          letter-spacing: 0.01em;
          transition: color 0.15s;
        }
        .site-nav a:hover { color: #E4E8EE; }
        .nav-cmd {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: #7C8798;
          border: 1px solid #242B36;
          padding: 3px 8px;
          cursor: pointer;
          background: transparent;
          transition: border-color 0.15s, color 0.15s;
        }
        .nav-cmd:hover { border-color: #3DD9C4; color: #3DD9C4; }

        /* ── Skip link ───────────────────────────────────────────────────── */
        .skip-link {
          position: fixed; top: -999px; left: -999px;
          z-index: 9999; color: #E4E8EE;
        }
        .skip-link:focus { top: 0.75rem; left: 0.75rem; }

        /* ── Splash film overlay ─────────────────────────────────────────── */
        .splash {
          position: fixed; inset: 0; z-index: 50;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-end;
          padding-bottom: 5rem;
          background: transparent;
          transition: opacity 0.9s ease;
        }
        .splash.done { opacity: 0; pointer-events: none; }
        .splash-telemetry {
          text-align: center;
          animation: fadeUp 0.6s ease both;
        }
        .splash-coord {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          color: #3DD9C4;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
          opacity: 0.9;
        }
        .splash-skip {
          font-size: 0.65rem;
          font-family: 'IBM Plex Mono', monospace;
          color: #7C8798;
          background: transparent;
          border: none;
          cursor: pointer;
          letter-spacing: 0.08em;
          margin-top: 1.5rem;
          text-transform: uppercase;
          transition: color 0.15s;
        }
        .splash-skip:hover { color: #E4E8EE; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Band sections (identical rhythm to arstraumur) ──────────────── */
        .band {
          position: relative;
          z-index: 10;
          min-height: 100svh;
          display: flex;
          align-items: center;
        }
        .band-ground { min-height: 100svh; }
        .band-inner {
          width: 100%;
          max-width: 64rem;
          margin: 0 auto;
          padding: 6rem 2.5rem 4rem;
        }
        .band-content {
          max-width: 38rem;
        }

        /* Semi-transparent scrim panel for readability over globe */
        .scrim {
          background: linear-gradient(135deg, rgba(4,6,12,0.55) 0%, rgba(4,6,12,0.3) 100%);
          backdrop-filter: blur(1px);
          padding: 2.5rem;
        }

        /* ── Label (exact arstraumur .label equivalent) ──────────────────── */
        .label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.06em;
          color: #7C8798;
          text-transform: none;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0;
        }
        .label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #242B36;
          margin-left: 1rem;
        }

        /* ── Hero section ────────────────────────────────────────────────── */
        .band-ground .band-content { max-width: 32rem; }
        .hero-wordmark {
          font-size: 1.85rem;
          font-weight: 500;
          color: #E4E8EE;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin-bottom: 0.75rem;
          margin-top: 0.5rem;
        }
        .hero-ai {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          color: #3DD9C4;
          border: 1px solid rgba(61,217,196,0.35);
          padding: 2px 7px;
          letter-spacing: 0.06em;
          vertical-align: middle;
          margin-left: 0.4rem;
        }
        .hero-descriptor {
          font-size: 0.85rem;
          color: #7C8798;
          font-weight: 300;
          line-height: 1.7;
          margin-bottom: 2rem;
          max-width: 28rem;
        }
        .hero-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: #242B36;
          border: 1px solid #242B36;
          margin-top: 1.5rem;
        }
        .hero-metric {
          padding: 1rem;
          background: rgba(4,6,12,0.8);
        }
        .hero-metric-value {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 1.25rem;
          font-weight: 500;
          color: #E4E8EE;
          display: block;
        }
        .hero-metric-value.critical { color: #E8483A; }
        .hero-metric-value.high     { color: #E8863A; }
        .hero-metric-value.live     { color: #3DD9C4; }
        .hero-metric-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.6rem;
          color: #7C8798;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: block;
          margin-top: 0.15rem;
        }

        /* ── Section h2 ──────────────────────────────────────────────────── */
        h2 {
          font-size: 1.5rem;
          font-weight: 400;
          color: #E4E8EE;
          letter-spacing: -0.02em;
          margin-bottom: 1.5rem;
          margin-top: 0.25rem;
          line-height: 1.2;
        }

        /* ── News list (= arstraumur .news-list) ─────────────────────────── */
        .news-list { list-style: none; margin-bottom: 1.5rem; }
        .news-item {
          border-top: 1px solid #242B36;
          padding: 1.25rem 0;
        }
        .news-item:last-child { border-bottom: 1px solid #242B36; }
        .ni-link { text-decoration: none; display: block; }
        .ni-link:hover .ni-title { color: #3DD9C4; }
        .transmission-head {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: #7C8798;
          letter-spacing: 0.06em;
          margin-bottom: 0.4rem;
        }
        .t-no { color: #515E72; }
        .sev-badge {
          font-size: 0.55rem;
          font-weight: 700;
          padding: 1px 5px;
          border: 1px solid;
          letter-spacing: 0.06em;
        }
        .sev-critical { color: #E8483A; border-color: rgba(232,72,58,0.35); background: rgba(232,72,58,0.08); }
        .sev-high     { color: #E8863A; border-color: rgba(232,134,58,0.35); background: rgba(232,134,58,0.08); }
        .sev-medium   { color: #E8C93A; border-color: rgba(232,201,58,0.35); background: rgba(232,201,58,0.08); }
        .sev-low      { color: #4B7BE5; border-color: rgba(75,123,229,0.35);  background: rgba(75,123,229,0.08); }
        .ni-title {
          font-size: 0.95rem;
          color: #E4E8EE;
          font-weight: 400;
          margin-bottom: 0.35rem;
          transition: color 0.15s;
        }
        .ni-body {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }
        .excerpt {
          font-size: 0.78rem;
          color: #7C8798;
          line-height: 1.6;
          font-weight: 300;
        }
        .mono-tag {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.6rem;
          color: #3DD9C4;
          letter-spacing: 0.04em;
        }

        /* ── Feature card (= arstraumur .feature-card) ───────────────────── */
        .feature-card {
          display: flex;
          gap: 1.25rem;
          align-items: flex-start;
          text-decoration: none;
          margin-bottom: 1.25rem;
          padding: 1.25rem;
          border: 1px solid #242B36;
          background: rgba(4,6,12,0.6);
          transition: border-color 0.15s;
        }
        .feature-card:hover { border-color: #3DD9C4; }
        .fc-cover {
          width: 4.5rem;
          height: 4.5rem;
          background: #12171F;
          border: 1px solid #242B36;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.6rem;
          color: #3DD9C4;
          letter-spacing: 0.06em;
        }
        .fc-body { display: flex; flex-direction: column; gap: 0.3rem; }
        .fc-title {
          font-size: 0.95rem;
          font-weight: 400;
          color: #E4E8EE;
          line-height: 1.3;
        }
        .fc-sub {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: #7C8798;
          letter-spacing: 0.02em;
        }
        .fc-ip { color: #3DD9C4; }

        /* ── Discography-style list (= arstraumur .disco-list) ───────────── */
        .disco-list { list-style: none; margin-bottom: 1.25rem; }
        .disco-list li {
          display: grid;
          grid-template-columns: 3.5rem 1fr 5rem;
          align-items: center;
          padding: 0.6rem 0;
          border-top: 1px solid #242B36;
          font-size: 0.82rem;
          gap: 1rem;
        }
        .disco-list li:last-child { border-bottom: 1px solid #242B36; }
        .d-id {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: #515E72;
          letter-spacing: 0.04em;
        }
        .d-title {
          color: #E4E8EE;
          text-decoration: none;
          font-weight: 300;
          transition: color 0.15s;
        }
        .d-title:hover { color: #3DD9C4; }
        .d-type {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.6rem;
          color: #515E72;
          letter-spacing: 0.05em;
          text-align: right;
        }

        /* ── Graph canvas band ────────────────────────────────────────────── */
        .graph-frame {
          border: 1px solid #242B36;
          background: radial-gradient(ellipse at center, #0D1420 0%, #04060c 100%);
          height: 520px;
          width: 100%;
          margin-top: 1rem;
          position: relative;
          overflow: hidden;
        }

        /* ── More link (= arstraumur .more-link) ─────────────────────────── */
        .more-link { margin-top: 0.5rem; }
        .more-link a {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: #7C8798;
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: color 0.15s;
        }
        .more-link a:hover { color: #E4E8EE; }

        /* ── Footer band ─────────────────────────────────────────────────── */
        .band-footer { min-height: 40svh; }
        .site-footer {
          position: relative; z-index: 10;
          padding: 2rem 2.5rem;
          border-top: 1px solid #242B36;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: #515E72;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        /* ── Scroll-reveal animation ─────────────────────────────────────── */
        .reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .reveal.visible { opacity: 1; transform: none; }
      `}</style>

      {/* ── Apply body class ─────────────────────────────────────────────── */}
      <BodyClass />

      {/* ── Persistent 3D sky canvas (behind everything) ─────────────────── */}
      <GlobeCanvas />

      {/* ── Opening film overlay ─────────────────────────────────────────── */}
      {splashVisible && (
        <div className={`splash ${splashDone ? 'done' : ''}`} aria-hidden={splashDone}>
          <div className="splash-telemetry">
            <p className="splash-coord">{telemetry}</p>
            <button className="splash-skip" onClick={skipSplash}>[ Skip ]</button>
          </div>
        </div>
      )}

      {/* ── Minimal fixed header ─────────────────────────────────────────── */}
      <SiteHeader />

      <a className="skip-link" href="#content">Skip to content</a>

      <main id="content">

        {/* 1 · Ground — Hero / Perimeter ────────────────────────────────── */}
        <section className="band band-ground" id="overview" aria-label="Overview">
          <div className="band-inner">
            <div className="band-content scrim">
              <p className="label">Perimeter · what's being watched</p>
              <h1 className="hero-wordmark">
                NetSentinal<span className="hero-ai">AI</span>
              </h1>
              <p className="hero-descriptor">
                Network-forensics and incident-response platform for security consultancies.
                Real-time sensor telemetry, packet-level evidence, correlated findings.
              </p>

              {/* 4 Key Metrics */}
              <div className="hero-metrics">
                <div className="hero-metric">
                  <span className="hero-metric-value live">3</span>
                  <span className="hero-metric-label">Active Sensors</span>
                </div>
                <div className="hero-metric">
                  <span className="hero-metric-value critical">1</span>
                  <span className="hero-metric-label">Open Incidents</span>
                </div>
                <div className="hero-metric">
                  <span className="hero-metric-value high">5</span>
                  <span className="hero-metric-label">High-Risk Findings</span>
                </div>
                <div className="hero-metric">
                  <span className="hero-metric-value">1.25 Gbps</span>
                  <span className="hero-metric-label">Traffic Observed</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2 · Signal — Live triggers / Monitor ─────────────────────────── */}
        <section className="band" id="monitor" aria-labelledby="monitor-title">
          <div className="band-inner">
            <div className="band-content scrim reveal">
              <p className="label">Signal · live traffic in motion</p>
              <h2 id="monitor-title">Latest triggers</h2>

              <ol className="news-list">
                <li className="news-item">
                  <a className="ni-link" href="/captures/CAP-1050">
                    <p className="transmission-head">
                      <time dateTime="2026-09-16T14:26:04Z">2026-09-16 14:26</time>
                      <span className="t-no">TRG-883</span>
                      <span className="sev-badge sev-critical">CRITICAL</span>
                    </p>
                    <h3 className="ni-title">Auto-preserved capture: periodic beacon to 45.77.21.184</h3>
                    <div className="ni-body">
                      <p className="excerpt">Score 92/100. DPI flagged C2-style periodic traffic from
                        <span className="mono-tag"> FIN-WS-014 → 45.77.21.184:443</span>. Five correlated
                        signals: periodicity, destination novelty, outbound volume, ML anomaly. 684 MB
                        PCAP automatically preserved and SHA-256 verified.</p>
                    </div>
                  </a>
                </li>

                <li className="news-item">
                  <a className="ni-link" href="/findings">
                    <p className="transmission-head">
                      <time dateTime="2026-09-16T14:31:04Z">2026-09-16 14:31</time>
                      <span className="t-no">FND-8841</span>
                      <span className="sev-badge sev-high">HIGH</span>
                    </p>
                    <h3 className="ni-title">Possible C2-style periodic traffic from FIN-WS-014</h3>
                    <div className="ni-body">
                      <p className="excerpt">Confidence 79%. 31 TLS flows at 61.2 s ± 2.1 s intervals
                        to rare external destination. Pattern consistent with beacon over encrypted
                        channel.</p>
                    </div>
                  </a>
                </li>

                <li className="news-item">
                  <a className="ni-link" href="/findings">
                    <p className="transmission-head">
                      <time dateTime="2026-09-16T14:29:00Z">2026-09-16 14:29</time>
                      <span className="t-no">FND-8837</span>
                      <span className="sev-badge sev-high">HIGH</span>
                    </p>
                    <h3 className="ni-title">Possible DNS tunnelling behaviour detected</h3>
                    <div className="ni-body">
                      <p className="excerpt">Confidence 74%. Unusually high-entropy TXT/NULL query
                        payloads to<span className="mono-tag"> cdn-sync-update.net</span> — consistent with
                        data exfiltration or C2 over DNS.</p>
                    </div>
                  </a>
                </li>
              </ol>

              <p className="more-link"><a href="/sensors">Fleet status »</a></p>
            </div>
          </div>
        </section>

        {/* 3 · Depth — Feature Incident / Investigate ────────────────────── */}
        <section className="band" id="investigate" aria-labelledby="investigate-title">
          <div className="band-inner">
            <div className="band-content scrim reveal" style={{ maxWidth: '42rem' }}>
              <p className="label">Depth · packet-level evidence</p>
              <h2 id="investigate-title">Active investigation</h2>

              <a className="feature-card" href="/incidents/INC-2026-041">
                <span className="fc-cover">INC</span>
                <span className="fc-body">
                  <span className="fc-title">Suspicious outbound communication from FIN-WS-014</span>
                  <span className="fc-sub">
                    INC-2026-041 · Risk 91 · Status: investigating<br />
                    <span className="fc-ip">10.0.0.14 → 45.77.21.184:443 · 31 beacon flows</span>
                  </span>
                </span>
              </a>

              <a className="feature-card" href="/captures/CAP-1050">
                <span className="fc-cover">PCAP</span>
                <span className="fc-body">
                  <span className="fc-title">CAP-1050 — Auto-preserved capture (684 MB)</span>
                  <span className="fc-sub">
                    SNS-042 · 2026-09-16 14:26–15:07 · 41m 38s<br />
                    <span className="fc-ip">SHA-256: a3f4b2c1…e5f4 · READY · Analyzed</span>
                  </span>
                </span>
              </a>

              <p className="more-link"><a href="/network/mesh">Launch network mesh graph »</a></p>

              {/* Network Mesh embedded graph */}
              <div className="graph-frame">
                <NetworkMeshEmbed />
              </div>
            </div>
          </div>
        </section>

        {/* 4 · Synthesis — Findings list / Discography-style ──────────────── */}
        <section className="band" id="synthesis" aria-labelledby="synthesis-title">
          <div className="band-inner">
            <div className="band-content scrim reveal">
              <p className="label">Synthesis · findings correlated</p>
              <h2 id="synthesis-title">Findings</h2>

              <ol className="disco-list" reversed>
                {[
                  { id: 'FND-8841', title: 'Possible C2-style periodic traffic', type: 'critical' },
                  { id: 'FND-8837', title: 'Possible DNS tunnelling behaviour', type: 'high' },
                  { id: 'FND-8829', title: 'Unusual outbound volume from FIN-WS-014', type: 'medium' },
                  { id: 'FND-8814', title: 'New external destination cdn-sync-update.net', type: 'medium' },
                  { id: 'FND-8802', title: 'Rare destination port observed (TCP/8443)', type: 'low' },
                ].map(f => (
                  <li key={f.id}>
                    <span className="d-id">{f.id}</span>
                    <a className="d-title" href="/findings">{f.title}</a>
                    <span className={`sev-badge sev-${f.type} d-type`}>{f.type}</span>
                  </li>
                ))}
              </ol>

              <p className="more-link"><a href="/findings">All findings »</a></p>
            </div>
          </div>
        </section>

        {/* 5 · Record — Reports / Deliverables ──────────────────────────── */}
        <section className="band" id="reports" aria-labelledby="reports-title">
          <div className="band-inner">
            <div className="band-content scrim reveal">
              <p className="label">Record · what gets handed to the client</p>
              <h2 id="reports-title">Reports</h2>

              <a className="feature-card" href="/reports">
                <span className="fc-cover">RPT</span>
                <span className="fc-body">
                  <span className="fc-title">
                    Q3 Network Security Assessment — Incident Report
                  </span>
                  <span className="fc-sub">
                    Acme Financial Services · Draft v1.0<br />
                    <span className="fc-ip">INC-2026-041 · Alex Morgan · 12 sections</span>
                  </span>
                </span>
              </a>

              <p className="more-link"><a href="/reports">All reports »</a></p>
            </div>
          </div>
        </section>

        {/* Footer band */}
        <section className="band band-footer" id="re-entry" aria-label="End" />

      </main>

      {/* ── Site Footer ─────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <span>© 2026 · NetSentinal AI · Acme Financial Services Engagement</span>
        <span>Q3 Network Security Assessment · Confidential</span>
      </footer>

      {/* ── Scroll-reveal hook ────────────────────────────────────────────── */}
      <ScrollReveal />
    </>
  );
}

// ─── Helper: apply body class ─────────────────────────────────────────────────
function BodyClass() {
  useEffect(() => {
    document.body.classList.add('ns-journey');
    return () => document.body.classList.remove('ns-journey');
  }, []);
  return null;
}

// ─── Helper: sticky header scroll detection ───────────────────────────────────
function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`} id="top">
      <a className="brand" href="/">
        <span className="brand-dot" />
        NetSentinal
        <span className="brand-ai">AI</span>
      </a>
      <nav className="site-nav" aria-label="Main">
        <a href="#overview">Overview</a>
        <a href="#monitor">Monitor</a>
        <a href="#investigate">Investigate</a>
        <a href="#reports">Reports</a>
        <button className="nav-cmd" onClick={() => {
          // CMD+K is handled globally by AppShell
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
        }}>CMD K</button>
      </nav>
    </header>
  );
}

// ─── Helper: IntersectionObserver scroll-reveal ───────────────────────────────
function ScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return null;
}

// ─── Helper: lazy-load Network Mesh to avoid SSR issues ──────────────────────
function NetworkMeshEmbed() {
  const [Mesh, setMesh] = useState<React.ComponentType<{ mode: string; height: string }> | null>(null);

  useEffect(() => {
    import('@/components/network/NetworkMesh').then(m => setMesh(() => m.NetworkMesh as any));
  }, []);

  if (!Mesh) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
        fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem', color: '#7C8798', letterSpacing: '0.08em' }}>
        LOADING MESH…
      </div>
    );
  }
  return <Mesh mode="threat" height="100%" />;
}
