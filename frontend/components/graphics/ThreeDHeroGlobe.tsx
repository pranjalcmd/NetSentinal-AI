'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Global Sensor Coordinates for Arcs & Nodes
const GLOBAL_SENSORS = [
  { id: 'NY', name: 'US-EAST (New York)', lat: 40.7128, lon: -74.0060, status: 'Active' },
  { id: 'SV', name: 'US-WEST (Silicon Valley)', lat: 37.7749, lon: -122.4194, status: 'Active' },
  { id: 'LDN', name: 'EU-WEST (London)', lat: 51.5074, lon: -0.1278, status: 'Active' },
  { id: 'FRA', name: 'EU-CENTRAL (Frankfurt)', lat: 50.1109, lon: 8.6821, status: 'Active' },
  { id: 'TYO', name: 'AP-EAST (Tokyo)', lat: 35.6762, lon: 139.6503, status: 'Active' },
  { id: 'SIN', name: 'AP-SOUTH (Singapore)', lat: 1.3521, lon: 103.8198, status: 'Active' },
  { id: 'SYD', name: 'AP-SOUTHEAST (Sydney)', lat: -33.8688, lon: 151.2093, status: 'Active' },
  { id: 'DXB', name: 'ME-SOUTH (Dubai)', lat: 25.2048, lon: 55.2708, status: 'Active' },
  { id: 'SAO', name: 'SA-EAST (São Paulo)', lat: -23.5505, lon: -46.6333, status: 'Active' },
];

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Function to generate curved arc trajectory between 2 points
function createArcCurve(p1: THREE.Vector3, p2: THREE.Vector3, elevation = 1.25) {
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const distance = p1.distanceTo(p2);
  mid.setLength(p1.length() + distance * (elevation - 1.0));
  return new THREE.QuadraticBezierCurve3(p1, mid, p2);
}

export function ThreeDHeroGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeNode, setActiveNode] = useState(GLOBAL_SENSORS[0].name);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 550;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 14.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Earth Group
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthRadius = 4.2;

    // Procedural Dot-Grid Texture for Earth (KaizenStat Dark Holographic Style)
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#020305';
      ctx.fillRect(0, 0, 2048, 1024);

      // Dot matrix pattern representing global landmasses
      ctx.fillStyle = '#1e293b';
      for (let y = 0; y < 1024; y += 12) {
        for (let x = 0; x < 2048; x += 12) {
          const lat = (y / 1024) * Math.PI - Math.PI / 2;
          const lon = (x / 2048) * Math.PI * 2;

          // Simple landmass detection formula
          const isLand =
            (lat > 0.05 && lat < 1.15 && lon > 0.4 && lon < 2.4) || // North America
            (lat < -0.05 && lat > -0.95 && lon > 1.1 && lon < 2.1) || // South America
            (lat > 0.15 && lat < 1.25 && lon > 2.9 && lon < 5.3) || // Eurasia
            (lat < 0.45 && lat > -0.75 && lon > 3.1 && lon < 4.3) || // Africa
            (lat < -0.15 && lat > -0.85 && lon > 4.7 && lon < 5.7); // Australia

          if (isLand) {
            ctx.fillStyle = Math.random() > 0.85 ? '#3DD9C4' : '#334155';
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 15,
      specular: new THREE.Color(0x3DD9C4),
      transparent: true,
      opacity: 0.95,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Glowing Atmospheric Rim (#3DD9C4)
    const atmosphereGeo = new THREE.SphereGeometry(earthRadius * 1.06, 64, 64);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x3DD9C4,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    earthGroup.add(atmosphereMesh);

    // Sensor Dots & Radiating Rings
    const nodesGroup = new THREE.Group();
    earthGroup.add(nodesGroup);

    const nodeVectors: THREE.Vector3[] = [];
    const ringMeshes: THREE.Mesh[] = [];

    GLOBAL_SENSORS.forEach((sensor) => {
      const vec = latLonToVector3(sensor.lat, sensor.lon, earthRadius * 1.01);
      nodeVectors.push(vec);

      // Cyan-Teal Sensor Point
      const dotGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x3DD9C4 });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(vec);
      nodesGroup.add(dotMesh);

      // Radiating Pulsing Ring
      const ringGeo = new THREE.RingGeometry(0.06, 0.16, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x3DD9C4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(vec);
      ringMesh.lookAt(vec.clone().multiplyScalar(2));
      nodesGroup.add(ringMesh);
      ringMeshes.push(ringMesh);
    });

    // Connecting Network Arcs
    const arcsGroup = new THREE.Group();
    earthGroup.add(arcsGroup);

    for (let i = 0; i < nodeVectors.length; i++) {
      const nextIdx = (i + 2) % nodeVectors.length;
      const p1 = nodeVectors[i];
      const p2 = nodeVectors[nextIdx];
      const curve = createArcCurve(p1, p2, 1.25);
      const points = curve.getPoints(50);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x3DD9C4,
        transparent: true,
        opacity: 0.45,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      arcsGroup.add(arcLine);
    }

    // Outer Orbital Satellite Ring
    const orbitRingGeo = new THREE.RingGeometry(earthRadius * 1.35, earthRadius * 1.36, 128);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2.3;
    earthGroup.add(orbitRing);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x3DD9C4, 2.0);
    dirLight1.position.set(12, 10, 15);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.8);
    dirLight2.position.set(-12, -8, -10);
    scene.add(dirLight2);

    // Interactive Drag / Spin Logic
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      earthGroup.rotation.y += deltaX * 0.005;
      earthGroup.rotation.x += deltaY * 0.005;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (!isDragging) {
        earthGroup.rotation.y += 0.0025; // Smooth ambient rotation
      }

      // Pulse ring animation
      ringMeshes.forEach((mesh, index) => {
        const s = 1 + (Math.sin(elapsed * 3.5 + index) + 1) * 0.7;
        mesh.scale.set(s, s, s);
        (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 - s * 0.35);
      });

      renderer.render(scene, camera);
    };

    animate();

    // Node Name Cycling
    const nodeInterval = setInterval(() => {
      setActiveNode((prev) => {
        const idx = GLOBAL_SENSORS.findIndex((s) => s.name === prev);
        const nextIdx = (idx + 1) % GLOBAL_SENSORS.length;
        return GLOBAL_SENSORS[nextIdx].name;
      });
    }, 3000);

    const handleResize = () => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 550;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(nodeInterval);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-[480px] sm:h-[540px] flex items-center justify-center">
      
      {/* 3D Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Futuristic Telemetry HUD Overlay */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 p-3.5 rounded-xl bg-black/80 backdrop-blur-md border border-[#3DD9C4]/30 text-left font-mono text-xs shadow-2xl pointer-events-none">
        <div className="flex items-center gap-2 text-[#3DD9C4] font-semibold mb-1">
          <span className="live-dot" />
          <span>eBPF GLOBAL NETWORK FLEET</span>
        </div>
        <div className="text-zinc-300 text-[11px]">
          Target Probe: <span className="text-white font-bold">{activeNode}</span>
        </div>
        <div className="text-zinc-500 text-[10px] mt-0.5">
          12 Active Edge Probes • 1.84M pps • 0.18ms Latency
        </div>
      </div>

      {/* Drag Hint Badge */}
      <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-zinc-900/90 border border-white/10 text-[11px] font-mono text-zinc-400 pointer-events-none flex items-center gap-1.5 shadow-lg">
        <span>🖱️ Drag to rotate 3D Earth</span>
      </div>
    </div>
  );
}
