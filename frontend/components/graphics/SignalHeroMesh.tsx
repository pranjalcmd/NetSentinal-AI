'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export function SignalHeroMesh() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setPrefersReducedMotion(true);
    }

    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 750;

    // WebGL Availability Check
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch (e) {
      setHasWebGL(false);
      return;
    }

    // ─── THREE.JS WebGL Network Mesh Scene ──────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);
    scene.fog = new THREE.FogExp2(0x04060c, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 1000;
    const starPos = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 160;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0x475569,
      size: 0.35,
      transparent: true,
      opacity: 0.5,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // Central NetSentinel Core Node
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    const coreGeo = new THREE.SphereGeometry(1.6, 32, 32);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x3DD9C4,
      emissive: 0x0d9488,
      wireframe: true,
      shininess: 100,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Core Halo Glow
    const haloGeo = new THREE.SphereGeometry(2.1, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x3DD9C4,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    coreGroup.add(haloMesh);

    // Surrounding Nodes & Luminous Connection Arcs
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    const outerNodes: THREE.Vector3[] = [];
    const nodeCount = 12;

    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const radius = 6.5 + (i % 3) * 1.2;
      const x = Math.cos(angle) * radius;
      const y = (Math.sin(i * 1.5) * 2.2);
      const z = Math.sin(angle) * radius * 0.7;

      const vec = new THREE.Vector3(x, y, z);
      outerNodes.push(vec);

      // Node Sphere
      const nGeo = new THREE.SphereGeometry(0.22, 16, 16);
      const isRisk = i % 4 === 0;
      const nMat = new THREE.MeshBasicMaterial({
        color: isRisk ? 0xef4444 : i % 2 === 0 ? 0x3DD9C4 : 0x3b82f6,
      });
      const nMesh = new THREE.Mesh(nGeo, nMat);
      nMesh.position.copy(vec);
      nodesGroup.add(nMesh);

      // Connection Line to Central Core
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), vec]);
      const lineMat = new THREE.LineBasicMaterial({
        color: isRisk ? 0xef4444 : 0x3DD9C4,
        transparent: true,
        opacity: isRisk ? 0.6 : 0.25,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      nodesGroup.add(line);
    }

    // Packet Animation Meshes
    const packetMeshes: { mesh: THREE.Mesh; start: THREE.Vector3; end: THREE.Vector3; progress: number; speed: number }[] = [];
    outerNodes.forEach((vec, idx) => {
      const pGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const pMat = new THREE.MeshBasicMaterial({ color: 0x3DD9C4 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      scene.add(pMesh);

      packetMeshes.push({
        mesh: pMesh,
        start: new THREE.Vector3(0, 0, 0),
        end: vec,
        progress: Math.random(),
        speed: 0.004 + (idx % 3) * 0.002,
      });
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x3DD9C4, 2.0);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        coreGroup.rotation.y = elapsed * 0.15;
        coreGroup.rotation.x = Math.sin(elapsed * 0.2) * 0.1;
        nodesGroup.rotation.y = elapsed * 0.03;
        starField.rotation.y = elapsed * 0.003;

        // Animate Traveling Packets
        packetMeshes.forEach((p) => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;
          p.mesh.position.lerpVectors(p.start, p.end, p.progress);
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 750;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [prefersReducedMotion]);

  // Static SVG/CSS Fallback for No-WebGL or Reduced Motion users
  if (!hasWebGL || prefersReducedMotion) {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#04060c] flex items-center justify-center">
        <svg className="w-full h-full max-w-4xl max-h-[600px] opacity-40" viewBox="0 0 800 600" fill="none">
          <circle cx="400" cy="300" r="120" stroke="#3DD9C4" strokeWidth="2" strokeDasharray="6 6" />
          <circle cx="400" cy="300" r="40" fill="#3DD9C4" fillOpacity="0.2" stroke="#3DD9C4" strokeWidth="3" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = 400 + Math.cos(rad) * 220;
            const y = 300 + Math.sin(rad) * 180;
            return (
              <g key={i}>
                <line x1="400" y1="300" x2={x} y2={y} stroke={i % 3 === 0 ? '#ef4444' : '#3DD9C4'} strokeWidth="1.5" strokeOpacity="0.5" />
                <circle cx={x} cy={y} r="8" fill={i % 3 === 0 ? '#ef4444' : '#3DD9C4'} />
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div ref={mountRef} className="w-full h-full opacity-80" />
    </div>
  );
}
