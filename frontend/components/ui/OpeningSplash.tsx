'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// 12 Sensor Nodes Worldwide Coordinates (Lat, Lon)
const SENSOR_NODES = [
  { name: 'US-EAST (NY)', lat: 40.7128, lon: -74.0060 },
  { name: 'US-WEST (SV)', lat: 37.7749, lon: -122.4194 },
  { name: 'EU-WEST (LON)', lat: 51.5074, lon: -0.1278 },
  { name: 'EU-CENTRAL (FRA)', lat: 50.1109, lon: 8.6821 },
  { name: 'EU-NORTH (STO)', lat: 59.3293, lon: 18.0686 },
  { name: 'AP-EAST (TYO)', lat: 35.6762, lon: 139.6503 },
  { name: 'AP-SOUTH (SIN)', lat: 1.3521, lon: 103.8198 },
  { name: 'AP-SOUTHEAST (SYD)', lat: -33.8688, lon: 151.2093 },
  { name: 'ME-SOUTH (DXB)', lat: 25.2048, lon: 55.2708 },
  { name: 'SA-EAST (SAO)', lat: -23.5505, lon: -46.6333 },
  { name: 'AF-SOUTH (JNB)', lat: -26.2041, lon: 28.0473 },
  { name: 'CA-CENTRAL (YTO)', lat: 43.6532, lon: -79.3832 },
];

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export function OpeningSplash({ onComplete }: { onComplete?: () => void }) {
  const [telemetryText, setTelemetryText] = useState('Sensor Fleet · 12 nodes active worldwide');
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check session storage to ensure it plays once per session
    if (typeof window !== 'undefined' && sessionStorage.getItem('netsentinal_splash_played') === 'true') {
      setHidden(true);
      if (onComplete) onComplete();
      return;
    }

    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Three.js Scene Setup (Dark Space #04060c)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);
    scene.fog = new THREE.FogExp2(0x04060c, 0.003);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Starfield Background
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 1400;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 220;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0x7C8798,
      size: 0.5,
      transparent: true,
      opacity: 0.5,
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // 3D Earth Group
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // Core Earth Sphere (Muted graphite-blue tones #12171F)
    const earthRadius = 4.0;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);

    // Procedural Earth Landmass Canvas Texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0A0E14'; // Ocean
      ctx.fillRect(0, 0, 1024, 512);

      ctx.fillStyle = '#1A2230'; // Muted graphite landmass
      for (let i = 0; i < 4500; i++) {
        const u = Math.random() * 1024;
        const v = Math.random() * 512;
        const lat = (v / 512) * Math.PI - Math.PI / 2;
        const lon = (u / 1024) * Math.PI * 2;

        const isLand =
          (lat > 0.1 && lat < 1.1 && lon > 0.5 && lon < 2.5) || // North America
          (lat < -0.1 && lat > -0.9 && lon > 1.2 && lon < 2.2) || // South America
          (lat > 0.2 && lat < 1.2 && lon > 3.0 && lon < 5.2) || // Eurasia
          (lat < 0.4 && lat > -0.7 && lon > 3.2 && lon < 4.2) || // Africa
          (lat < -0.2 && lat > -0.8 && lon > 4.8 && lon < 5.8); // Australia

        if (isLand) {
          ctx.beginPath();
          ctx.arc(u, v, Math.random() * 2 + 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpScale: 0.04,
      shininess: 10,
      specular: new THREE.Color(0x242B36),
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earthMesh);

    // Thin Cyan-Teal Atmospheric Rim Glow (#3DD9C4)
    const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.05, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x3DD9C4,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthGroup.add(atmosphereMesh);

    // 12 Active Sensor Node Light Markers on Earth
    const pingsGroup = new THREE.Group();
    earthGroup.add(pingsGroup);

    const pingMeshes: THREE.Mesh[] = [];

    SENSOR_NODES.forEach((node) => {
      const pos = latLonToVector3(node.lat, node.lon, earthRadius * 1.01);

      // Cyan-teal dot marker
      const dotGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x3DD9C4 });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      pingsGroup.add(dotMesh);

      // Radiating ping ring mesh
      const ringGeo = new THREE.RingGeometry(0.04, 0.12, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x3DD9C4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      pingsGroup.add(ringMesh);
      pingMeshes.push(ringMesh);
    });

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xE4E8EE, 0.35);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x3DD9C4, 1.8);
    dirLight.position.set(10, 8, 12);
    scene.add(dirLight);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();
    let targetRotationY = Math.PI * 0.45; // Settle on North America / Europe

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Earth rotation slowing down towards target region
      earthGroup.rotation.y = THREE.MathUtils.lerp(earthGroup.rotation.y, targetRotationY, 0.015);
      earthGroup.rotation.x = Math.sin(elapsedTime * 0.2) * 0.05;

      // Animate radiating ping rings
      pingMeshes.forEach((m, idx) => {
        const s = 1 + (Math.sin(elapsedTime * 4 + idx) + 1) * 0.8;
        m.scale.set(s, s, s);
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - s * 0.3);
      });

      starField.rotation.y = elapsedTime * 0.01;
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Auto-advance sequence
    const t1 = setTimeout(() => {
      setTelemetryText('Sensor Fleet · 12 nodes active worldwide · Calibrated to Acme Financial Scope');
    }, 1400);

    const t2 = setTimeout(() => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('netsentinal_splash_played', 'true');
      }
      setFadeOut(true);
      if (onComplete) onComplete();
      setTimeout(() => setHidden(true), 800);
    }, 2800);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      clearTimeout(t1);
      clearTimeout(t2);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onComplete]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#04060c] transition-opacity duration-1000 select-none ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* WebGL 3D Earth Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Top minimal brand indicator */}
      <div className="relative z-10 w-full px-8 py-6 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-[#E4E8EE]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3DD9C4] shadow-[0_0_8px_#3DD9C4]" />
          <span className="font-medium tracking-tight">NetSentinal AI</span>
        </div>

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('netsentinal_splash_played', 'true');
            }
            setFadeOut(true);
            setTimeout(() => setHidden(true), 400);
          }}
          className="text-[#7C8798] hover:text-[#E4E8EE] transition-colors cursor-pointer tracking-wider"
        >
          [ Skip ]
        </button>
      </div>

      {/* Bottom Telemetry Readout (fades in beneath Earth like scientific telemetry) */}
      <div className="relative z-10 w-full pb-12 px-8 flex flex-col items-center text-center space-y-2 font-mono">
        <div className="text-xs text-[#3DD9C4] tracking-widest uppercase transition-all duration-500">
          {telemetryText}
        </div>
        <div className="text-[10px] text-[#7C8798] tracking-wider">
          Acme Financial Services · Q3 Network Security Assessment
        </div>
      </div>
    </div>
  );
}
