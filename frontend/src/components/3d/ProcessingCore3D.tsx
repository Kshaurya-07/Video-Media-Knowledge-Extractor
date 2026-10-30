import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type ProcessingStage =
  | 'QUEUED'
  | 'UPLOADING'
  | 'VALIDATING'
  | 'EXTRACTING_MEDIA'
  | 'SENDING_TO_AI'
  | 'ANALYZING_VIDEO'
  | 'GENERATING_CHAPTERS'
  | 'SAVING_RESULTS'
  | 'EXTRACTING_AUDIO'
  | 'TRANSCRIBING'
  | 'IDENTIFYING_CHAPTERS'
  | 'INDEXING'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED';

interface ProcessingCore3DProps {
  stage: ProcessingStage;
  progressPercent: number;
  className?: string;
}

const STAGE_CONFIG: Record<ProcessingStage, { color: number; speed: number; particleDensity: number }> = {
  QUEUED: { color: 0x71717a, speed: 0.005, particleDensity: 100 },
  UPLOADING: { color: 0x60a5fa, speed: 0.015, particleDensity: 250 },
  VALIDATING: { color: 0x38bdf8, speed: 0.018, particleDensity: 280 },
  EXTRACTING_MEDIA: { color: 0xa855f7, speed: 0.02, particleDensity: 320 },
  SENDING_TO_AI: { color: 0x818cf8, speed: 0.022, particleDensity: 360 },
  ANALYZING_VIDEO: { color: 0x8b5cf6, speed: 0.028, particleDensity: 420 },
  GENERATING_CHAPTERS: { color: 0xc084fc, speed: 0.024, particleDensity: 380 },
  SAVING_RESULTS: { color: 0x10b981, speed: 0.018, particleDensity: 300 },
  EXTRACTING_AUDIO: { color: 0xa855f7, speed: 0.02, particleDensity: 300 },
  TRANSCRIBING: { color: 0x8b5cf6, speed: 0.025, particleDensity: 400 },
  IDENTIFYING_CHAPTERS: { color: 0xc084fc, speed: 0.02, particleDensity: 350 },
  INDEXING: { color: 0xec4899, speed: 0.03, particleDensity: 450 },
  FINALIZING: { color: 0x10b981, speed: 0.015, particleDensity: 300 },
  COMPLETED: { color: 0x34d399, speed: 0.008, particleDensity: 200 },
  FAILED: { color: 0xef4444, speed: 0.002, particleDensity: 100 },
};

export const ProcessingCore3D: React.FC<ProcessingCore3DProps> = ({
  stage,
  progressPercent,
  className = 'w-full h-64',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 260;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.QUEUED;

    // Center Core Mesh
    const coreGeom = new THREE.OctahedronGeometry(0.7, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.2,
      metalness: 0.9,
      emissive: cfg.color,
      emissiveIntensity: 0.4,
      wireframe: stage === 'TRANSCRIBING' || stage === 'INDEXING',
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    scene.add(core);

    // Orbital Ring
    const ringGeom = new THREE.TorusGeometry(1.2, 0.02, 16, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 3;
    scene.add(ring);

    // Particle Swarm
    const pCount = cfg.particleDensity;
    const pGeom = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const r = 0.9 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.03,
      color: cfg.color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeom, pMat);
    scene.add(particles);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(amb);
    const point = new THREE.PointLight(cfg.color, 2.5, 6);
    scene.add(point);

    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      core.rotation.y += cfg.speed;
      core.rotation.x += cfg.speed * 0.6;

      ring.rotation.z += cfg.speed * 1.5;
      ring.rotation.y = Math.sin(elapsed * 0.8) * 0.4;

      particles.rotation.y = elapsed * cfg.speed * 4;

      const pulse = 1 + Math.sin(elapsed * 3) * (0.05 * (progressPercent / 100 + 0.2));
      core.scale.set(pulse, pulse, pulse);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      pGeom.dispose();
      pMat.dispose();
      container.innerHTML = '';
    };
  }, [stage, progressPercent]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
