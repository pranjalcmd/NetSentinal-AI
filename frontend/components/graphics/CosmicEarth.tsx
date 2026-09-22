'use client';

import React, { useEffect, useRef } from 'react';

export function CosmicEarth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotation = 0;
    let scaleFactor = 0.2; // Start small for entrance animation

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 900;
      canvas.height = canvas.parentElement?.clientHeight || 700;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width * 0.74;
      const cy = canvas.height * 0.32;

      // Animate scaling in on entrance
      if (scaleFactor < 1) {
        scaleFactor += (1 - scaleFactor) * 0.05;
      }

      const targetRadius = Math.min(canvas.width, canvas.height) * 0.36;
      const radius = targetRadius * scaleFactor;

      rotation += 0.0018;

      // 1. Orbital Trajectory Ring
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.5, radius * 0.45, -0.2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.restore();

      // 2. Outer Atmospheric Glow
      const outerGlow = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.65);
      outerGlow.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
      outerGlow.addColorStop(0.3, 'rgba(37, 99, 235, 0.25)');
      outerGlow.addColorStop(0.75, 'rgba(29, 78, 216, 0.08)');
      outerGlow.addColorStop(1, 'rgba(4, 6, 10, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.65, 0, Math.PI * 2);
      ctx.fill();

      // 3. Earth Globe Sphere Gradient
      const earthGrad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.05, cx, cy, radius);
      earthGrad.addColorStop(0, '#2563eb');
      earthGrad.addColorStop(0.35, '#1d4ed8');
      earthGrad.addColorStop(0.7, '#0f172a');
      earthGrad.addColorStop(0.95, '#040711');
      earthGrad.addColorStop(1, '#020307');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = earthGrad;
      ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
      ctx.shadowBlur = 40;
      ctx.fill();
      ctx.clip();

      // 4. Rotating Continents & Landmass Grids
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.5)';
      ctx.lineWidth = 1.6;

      for (let i = 0; i < 8; i++) {
        const angle = rotation + (i * Math.PI) / 4;
        const lx = cx + Math.cos(angle) * (radius * 0.65);
        const ly = cy + Math.sin(angle * 0.75) * (radius * 0.55);

        ctx.beginPath();
        ctx.ellipse(lx, ly, radius * 0.32, radius * 0.18, angle * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 58, 138, 0.45)';
        ctx.fill();
        ctx.stroke();
      }

      // 5. City Night Lights & Ground Station Dots
      for (let j = 0; j < 60; j++) {
        const dotAngle = rotation * 1.6 + (j * 17);
        const dx = cx + Math.cos(dotAngle) * (radius * 0.84);
        const dy = cy + Math.sin(j * 3.3) * (radius * 0.74);
        if (Math.sin(dotAngle) < 0.15) {
          ctx.beginPath();
          ctx.arc(dx, dy, Math.random() * 1.6 + 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${Math.random() * 0.7 + 0.3})`;
          ctx.fill();
        }
      }

      // 6. Atmospheric Horizon Edge Rim Haze
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius);
      rimGrad.addColorStop(0, 'rgba(59, 130, 246, 0)');
      rimGrad.addColorStop(0.8, 'rgba(96, 165, 250, 0.35)');
      rimGrad.addColorStop(1, 'rgba(191, 219, 254, 0.9)');
      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 7. Satellite Dot Orbiting Earth
      const satAngle = rotation * 2.5;
      const satX = cx + Math.cos(satAngle) * (radius * 1.5);
      const satY = cy + Math.sin(satAngle * 0.45) * (radius * 0.45);
      ctx.beginPath();
      ctx.arc(satX, satY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#60a5fa';
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 10;
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 right-0 w-full h-[680px] pointer-events-none z-0 transition-opacity duration-1000"
    />
  );
}
