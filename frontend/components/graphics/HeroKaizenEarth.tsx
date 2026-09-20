'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export function HeroKaizenEarth() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 750;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.015);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3, 16);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ─── 1. Starfield Particles ─────────────────────────────────────────────
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 1200;
    const starPos = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 160;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0x64748b,
      size: 0.4,
      transparent: true,
      opacity: 0.6,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // ─── 2. Center 3D Earth Sphere ──────────────────────────────────────────
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const sphereRadius = 3.2;

    // Canvas procedural dot texture for Earth landmasses
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, 1024, 512);

      // Dot matrix pattern for continents
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3500; i++) {
        const u = Math.random() * 1024;
        const v = Math.random() * 512;
        const lat = (v / 512) * Math.PI - Math.PI / 2;
        const lon = (u / 1024) * Math.PI * 2;

        const isLand =
          (lat > 0.1 && lat < 1.1 && lon > 0.5 && lon < 2.5) || // North America
          (lat < -0.1 && lat > -0.9 && lon > 1.2 && lon < 2.2) || // South America
          (lat > 0.15 && lat < 1.2 && lon > 3.0 && lon < 5.2) || // Eurasia
          (lat < 0.4 && lat > -0.7 && lon > 3.2 && lon < 4.2) || // Africa
          (lat < -0.2 && lat > -0.8 && lon > 4.8 && lon < 5.8); // Australia

        if (isLand) {
          ctx.beginPath();
          ctx.arc(u, v, Math.random() * 1.8 + 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const earthTexture = new THREE.CanvasTexture(canvas);
    const earthGeo = new THREE.SphereGeometry(sphereRadius, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 30,
      specular: new THREE.Color(0x3DD9C4),
      bumpScale: 0.05,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Glowing Atmospheric Rim Halo (#3DD9C4)
    const atmosphereGeo = new THREE.SphereGeometry(sphereRadius * 1.05, 64, 64);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x3DD9C4,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    earthGroup.add(atmosphereMesh);

    // Active Sensor Points on Earth
    const sensorsCount = 14;
    for (let i = 0; i < sensorsCount; i++) {
      const lat = (Math.random() - 0.5) * 140;
      const lon = (Math.random() - 0.5) * 360;
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -(sphereRadius * 1.01 * Math.sin(phi) * Math.cos(theta));
      const z = sphereRadius * 1.01 * Math.sin(phi) * Math.sin(theta);
      const y = sphereRadius * 1.01 * Math.cos(phi);

      const dotGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x3DD9C4 });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(x, y, z);
      earthGroup.add(dotMesh);
    }

    // ─── 3. Concentric Elliptical Orbital Rings ───────────────────────────
    const ringsGroup = new THREE.Group();
    scene.add(ringsGroup);

    const ringCount = 18;
    for (let i = 1; i <= ringCount; i++) {
      const innerRadius = sphereRadius * 1.1 + i * 0.75;
      const ringGeo = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      const segments = 128;

      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const x = Math.cos(theta) * innerRadius;
        const z = Math.sin(theta) * (innerRadius * 0.45); // Elliptical distortion matching KaizenStat
        points.push(new THREE.Vector3(x, 0, z));
      }

      ringGeo.setFromPoints(points);
      const opacity = Math.max(0.03, 0.35 - (i / ringCount) * 0.32);
      const ringMat = new THREE.LineDashedMaterial({
        color: i % 3 === 0 ? 0x3DD9C4 : 0x334155,
        transparent: true,
        opacity: opacity,
        dashSize: 0.2,
        gapSize: 0.3,
      });
      const ringLine = new THREE.Line(ringGeo, ringMat);
      ringLine.computeLineDistances();
      ringLine.rotation.x = Math.PI / 12; // Tilt angle matching KaizenStat screenshot
      ringsGroup.add(ringLine);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x3DD9C4, 2.2);
    dirLight.position.set(10, 12, 15);
    scene.add(dirLight);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Slow 3D sphere rotation
      earthGroup.rotation.y = elapsed * 0.08;
      ringsGroup.rotation.y = elapsed * 0.02;
      starField.rotation.y = elapsed * 0.005;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
      style={{
        // Anchored to the hero: without this the sphere sits behind every
        // section for the whole scroll.
        maskImage: 'linear-gradient(to bottom, #000 0%, #000 55%, transparent 88%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 55%, transparent 88%)',
      }}
    >
      <div ref={mountRef} className="w-full h-full opacity-85" />
    </div>
  );
}
