import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface PhaseInfo {
  phase: number;
  code: string;
  name: string;
  headline: string;
  description: string;
}

const PHASES: PhaseInfo[] = [
  {
    phase: 1,
    code: '01 / CLOUD',
    name: 'Scattered Cloud',
    headline: 'Video is unstructured information.',
    description: 'Raw frames, audio spectrograms, and container atoms floating disconnected in temporal space.',
  },
  {
    phase: 2,
    code: '02 / KNOT',
    name: 'Torus Knot',
    headline: 'Attention weaves sight and sound.',
    description: 'Multimodal transformer layers interleave visual tokens and waveforms into a unified manifold.',
  },
  {
    phase: 3,
    code: '03 / SPHERE',
    name: 'Cohesive Sphere',
    headline: 'Knowledge collapses into structure.',
    description: 'Deterministic JSON schemas isolate summaries, chronological chapters, dialogue, and entities.',
  },
  {
    phase: 4,
    code: '04 / DRIFT',
    name: 'Dispersed Drift',
    headline: 'Every moment becomes queryable.',
    description: 'Sub-second timestamp citations, grounded Q&A, and semantic retrieval ready for exploration.',
  },
];

export const ScrollParticlePhases: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Track scroll position inside the 300vh container
  useEffect(() => {
    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalDist = el.offsetHeight - window.innerHeight;
      if (totalDist <= 0) return;

      const progress = Math.max(0, Math.min(1, -rect.top / totalDist));
      setScrollProgress(progress);

      const idx = Math.min(3, Math.floor(progress * 4));
      setCurrentPhaseIndex(idx);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Three.js Particle System
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    let isVisible = true;
    let animFrameId: number;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.04);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const COUNT = 1800;
    const cloudPositions = new Float32Array(COUNT * 3);
    const knotPositions = new Float32Array(COUNT * 3);
    const spherePositions = new Float32Array(COUNT * 3);
    const driftPositions = new Float32Array(COUNT * 3);
    const currentPositions = new Float32Array(COUNT * 3);

    // Compute coordinate tables
    for (let i = 0; i < COUNT; i++) {
      // 1. Scattered Cloud
      const cr = 2.0 * Math.cbrt(Math.random());
      const cTheta = Math.random() * Math.PI * 2;
      const cPhi = Math.acos(2 * Math.random() - 1);
      cloudPositions[i * 3] = cr * Math.sin(cPhi) * Math.cos(cTheta);
      cloudPositions[i * 3 + 1] = cr * Math.sin(cPhi) * Math.sin(cTheta);
      cloudPositions[i * 3 + 2] = cr * Math.cos(cPhi);

      // 2. Torus Knot (2,3)
      const t = (i / COUNT) * Math.PI * 2 * 3;
      const kr = 0.9 + 0.35 * Math.cos(3 * t);
      knotPositions[i * 3] = kr * Math.cos(2 * t);
      knotPositions[i * 3 + 1] = kr * Math.sin(2 * t);
      knotPositions[i * 3 + 2] = -0.4 * Math.sin(3 * t);

      // 3. Cohesive Sphere
      const sPhi = Math.acos(-1 + (2 * i) / COUNT);
      const sTheta = Math.sqrt(COUNT * Math.PI) * sPhi;
      const sr = 1.15;
      spherePositions[i * 3] = sr * Math.cos(sTheta) * Math.sin(sPhi);
      spherePositions[i * 3 + 1] = sr * Math.sin(sTheta) * Math.sin(sPhi);
      spherePositions[i * 3 + 2] = sr * Math.cos(sPhi);

      // 4. Dispersed Drift
      const dX = ((i / COUNT) - 0.5) * 4.2;
      const dY = Math.sin((i / COUNT) * Math.PI * 6) * 0.7 + (Math.random() - 0.5) * 0.4;
      const dZ = (Math.random() - 0.5) * 1.6;
      driftPositions[i * 3] = dX;
      driftPositions[i * 3 + 1] = dY;
      driftPositions[i * 3 + 2] = dZ;

      // Start at cloud
      currentPositions[i * 3] = cloudPositions[i * 3];
      currentPositions[i * 3 + 1] = cloudPositions[i * 3 + 1];
      currentPositions[i * 3 + 2] = cloudPositions[i * 3 + 2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xf5f5f5,
      size: 0.026,
      transparent: true,
      opacity: 0.85,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Subtle framing boundary wire
    const boundaryGeo = new THREE.IcosahedronGeometry(2.0, 1);
    const boundaryMat = new THREE.MeshBasicMaterial({
      color: 0x262626,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const boundary = new THREE.Mesh(boundaryGeo, boundaryMat);
    scene.add(boundary);

    // Intersection observer
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    });
    observer.observe(container);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Animation Loop interpolating based on scrollProgress
    let progressRef = 0;

    const animate = () => {
      if (!isVisible) {
        animFrameId = requestAnimationFrame(animate);
        return;
      }

      // Smooth progress tracking
      const targetP = isReducedMotion ? 0.5 : progressRef;
      const stageP = targetP * 3; // range [0, 3]

      const baseStage = Math.floor(stageP);
      const stageFraction = stageP - baseStage;

      const getStagePos = (stage: number, idx: number) => {
        if (stage === 0) return cloudPositions[idx];
        if (stage === 1) return knotPositions[idx];
        if (stage === 2) return spherePositions[idx];
        return driftPositions[idx];
      };

      const pos = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < COUNT * 3; i++) {
        const fromVal = getStagePos(Math.min(3, baseStage), i);
        const toVal = getStagePos(Math.min(3, baseStage + 1), i);
        const targetVal = fromVal + (toVal - fromVal) * stageFraction;
        pos[i] += (targetVal - pos[i]) * 0.12;
      }
      geometry.attributes.position.needsUpdate = true;

      particles.rotation.y += 0.002;
      boundary.rotation.y -= 0.001;

      renderer.render(scene, camera);
      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    const handleProgressUpdate = () => {
      if (sectionRef.current) {
        const el = sectionRef.current;
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        if (total > 0) {
          progressRef = Math.max(0, Math.min(1, -rect.top / total));
        }
      }
    };
    window.addEventListener('scroll', handleProgressUpdate, { passive: true });

    return () => {
      cancelAnimationFrame(animFrameId);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('scroll', handleProgressUpdate);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      boundaryGeo.dispose();
      boundaryMat.dispose();
      container.innerHTML = '';
    };
  }, [isReducedMotion]);

  const activePhase = PHASES[currentPhaseIndex];
  const progressPercent = Math.round(scrollProgress * 100);

  return (
    <div ref={sectionRef} className="relative h-[300vh] bg-[#0a0a0a]">
      {/* Sticky viewport pinned for the full 300vh duration */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-between p-6 sm:p-12 overflow-hidden text-neutral-100 border-y border-neutral-800">
        {/* Pinned Three.js Particle Canvas */}
        <div ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

        {/* Top Telemetry Header */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase">
              [ 03 / SYSTEM STORYTELLING ]
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-neutral-400">PHASE:</span>
            <span className="text-white font-semibold">{activePhase.code}</span>
            <span className="text-neutral-700">|</span>
            <span className="text-neutral-400">SCROLL:</span>
            <span className="text-emerald-400 font-semibold">{progressPercent}%</span>
          </div>
        </div>

        {/* Central Dynamic Editorial Narrative */}
        <div className="relative z-10 max-w-xl space-y-4 my-auto text-left pointer-events-none select-none">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-neutral-900 border border-neutral-700 text-[11px] font-mono text-neutral-300">
            <span>{activePhase.code}</span>
            <span className="text-neutral-500">·</span>
            <span className="text-emerald-400">{activePhase.name}</span>
          </div>

          <h3 className="text-3xl sm:text-5xl font-sans font-bold text-white tracking-tight leading-[1.08]">
            {activePhase.headline}
          </h3>

          <p className="text-sm sm:text-base text-neutral-400 leading-relaxed font-normal">
            {activePhase.description}
          </p>
        </div>

        {/* Bottom Interactive Phase Strip & 0 to 100 Progress Bar */}
        <div className="relative z-10 pt-4 border-t border-neutral-800/80 space-y-3">
          {/* Progress bar */}
          <div className="w-full h-1 bg-neutral-900 rounded-sm overflow-hidden border border-neutral-800">
            <div
              className="h-full bg-neutral-200 transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
            {PHASES.map((p, idx) => {
              const isCurrent = idx === currentPhaseIndex;
              return (
                <div
                  key={p.phase}
                  className={`p-2.5 rounded-sm border transition-colors ${
                    isCurrent
                      ? 'bg-neutral-900/90 border-neutral-600 text-white'
                      : 'bg-neutral-950/40 border-neutral-900 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span>{p.code}</span>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </div>
                  <div className="text-xs font-medium truncate">{p.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
