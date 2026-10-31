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
  theme?: 'dark' | 'light';
}

const STAGE_CONFIG: Record<ProcessingStage, { color: number; speed: number; particleDensity: number }> = {
  QUEUED: { color: 0x737373, speed: 0.005, particleDensity: 120 },
  UPLOADING: { color: 0xa3a3a3, speed: 0.015, particleDensity: 220 },
  VALIDATING: { color: 0xd4d4d4, speed: 0.018, particleDensity: 260 },
  EXTRACTING_MEDIA: { color: 0xe5e5e5, speed: 0.02, particleDensity: 300 },
  SENDING_TO_AI: { color: 0xffffff, speed: 0.022, particleDensity: 340 },
  ANALYZING_VIDEO: { color: 0xffffff, speed: 0.028, particleDensity: 400 },
  GENERATING_CHAPTERS: { color: 0xe5e5e5, speed: 0.024, particleDensity: 360 },
  SAVING_RESULTS: { color: 0x34d399, speed: 0.018, particleDensity: 280 },
  EXTRACTING_AUDIO: { color: 0xd4d4d4, speed: 0.02, particleDensity: 280 },
  TRANSCRIBING: { color: 0xffffff, speed: 0.025, particleDensity: 380 },
  IDENTIFYING_CHAPTERS: { color: 0xe5e5e5, speed: 0.02, particleDensity: 320 },
  INDEXING: { color: 0xffffff, speed: 0.03, particleDensity: 420 },
  FINALIZING: { color: 0x34d399, speed: 0.015, particleDensity: 260 },
  COMPLETED: { color: 0x34d399, speed: 0.008, particleDensity: 180 },
  FAILED: { color: 0xf87171, speed: 0.003, particleDensity: 90 },
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

    let isVisible = true;
    let animId: number;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 260;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.QUEUED;

    // Center Core Octahedron
    const coreGeom = new THREE.OctahedronGeometry(0.7, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.25,
      metalness: 0.85,
      emissive: cfg.color,
      emissiveIntensity: stage === 'COMPLETED' ? 0.6 : 0.25,
      wireframe: stage === 'TRANSCRIBING' || stage === 'INDEXING',
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    scene.add(core);

    // Orbital Ring
    const ringGeom = new THREE.TorusGeometry(1.2, 0.015, 16, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.6,
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
      size: 0.026,
      color: cfg.color,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeom, pMat);
    scene.add(particles);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(amb);
    const point = new THREE.PointLight(cfg.color, 1.8, 6);
    scene.add(point);

    const clock = new THREE.Clock();

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    });
    observer.observe(container);

    const animate = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(animate);
        return;
      }

      const elapsed = clock.getElapsedTime();

      core.rotation.y += cfg.speed;
      core.rotation.x += cfg.speed * 0.6;

      ring.rotation.z += cfg.speed * 1.5;
      ring.rotation.y = Math.sin(elapsed * 0.8) * 0.4;

      particles.rotation.y = elapsed * cfg.speed * 4;

      const pulse = 1 + Math.sin(elapsed * 3) * (0.04 * (progressPercent / 100 + 0.2));
      core.scale.set(pulse, pulse, pulse);

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
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
      observer.disconnect();
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
