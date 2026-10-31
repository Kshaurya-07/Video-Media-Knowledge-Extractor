import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

export interface VyoraIntelligenceOrbitProps {
  className?: string;
  stage?: 1 | 2 | 3 | 4;
  interactive?: boolean;
  showOverlay?: boolean;
  scale?: number;
  theme?: 'light' | 'dark';
  shape?: 'knot' | 'sphere' | 'torus' | 'cloud';
  onMorph?: (modeIndex: number) => void;
}

export const VyoraIntelligenceOrbit: React.FC<VyoraIntelligenceOrbitProps> = ({
  className = 'w-full h-full min-h-[360px]',
  interactive = true,
  showOverlay = true,
  scale = 1.0,
  theme = 'light',
  shape,
  onMorph,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeShapeIndex, setActiveShapeIndex] = useState<number>(0);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);

  const shapes = ['knot', 'sphere', 'torus'] as const;
  const currentShape = shape || shapes[activeShapeIndex % shapes.length];

  const handleToggleShape = useCallback(() => {
    if (!interactive) return;
    setActiveShapeIndex((prev) => {
      const next = (prev + 1) % shapes.length;
      onMorph?.(next);
      return next;
    });
  }, [interactive, onMorph, shapes.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    // Prefers reduced motion check
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let isVisible = true;
    let animFrameId: number;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.8 / scale);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Color tokens based on theme
    const isDark = theme === 'dark';
    const pointColor = isDark ? 0xffffff : 0x0a0a0a;
    const wireColor = isDark ? 0x404040 : 0xd4d4d4;

    const PARTICLE_COUNT = 1400;
    const currentPositions = new Float32Array(PARTICLE_COUNT * 3);
    const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

    // Helper functions to generate positions
    const getKnotPosition = (i: number): [number, number, number] => {
      const t = (i / PARTICLE_COUNT) * Math.PI * 2 * 3;
      const p = 2;
      const q = 3;
      const r = 0.8 + 0.3 * Math.cos(q * t);
      const x = r * Math.cos(p * t);
      const y = r * Math.sin(p * t);
      const z = -0.35 * Math.sin(q * t);
      const jitter = (Math.random() - 0.5) * 0.04;
      return [x + jitter, y + jitter, z + jitter];
    };

    const getSpherePosition = (i: number): [number, number, number] => {
      const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
      const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
      const radius = 1.1 + (Math.random() - 0.5) * 0.05;
      return [
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi),
      ];
    };

    const getTorusPosition = (i: number): [number, number, number] => {
      const u = (i / PARTICLE_COUNT) * Math.PI * 2;
      const v = ((i * 7) % PARTICLE_COUNT) * ((Math.PI * 2) / PARTICLE_COUNT);
      const R = 1.0;
      const r = 0.35;
      return [
        (R + r * Math.cos(v)) * Math.cos(u),
        (R + r * Math.cos(v)) * Math.sin(u),
        r * Math.sin(v) + (Math.random() - 0.5) * 0.03,
      ];
    };

    const getCloudPosition = (): [number, number, number] => {
      const r = 1.4 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.6,
        r * Math.cos(phi),
      ];
    };

    // Calculate targets for chosen shape
    const setShapeTargets = (s: string) => {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let pos: [number, number, number];
        if (s === 'sphere') pos = getSpherePosition(i);
        else if (s === 'torus') pos = getTorusPosition(i);
        else if (s === 'cloud') pos = getCloudPosition();
        else pos = getKnotPosition(i);

        targetPositions[i * 3] = pos[0];
        targetPositions[i * 3 + 1] = pos[1];
        targetPositions[i * 3 + 2] = pos[2];
      }
    };

    setShapeTargets(currentShape);

    // Initial fill
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
      currentPositions[i] = targetPositions[i];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

    const material = new THREE.PointsMaterial({
      color: pointColor,
      size: 0.024,
      transparent: true,
      opacity: isDark ? 0.85 : 0.75,
    });

    const pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);

    // Hairline ring orbit guide
    const ringGeo = new THREE.RingGeometry(1.4, 1.402, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: wireColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    scene.add(ring);

    // Mouse tracking
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive || prefersReducedMotion) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotationY = x * 0.6;
      targetRotationX = y * 0.4;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // IntersectionObserver to pause when off-screen
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      if (!isVisible) {
        animFrameId = requestAnimationFrame(animate);
        return;
      }

      const delta = clock.getDelta();

      if (!prefersReducedMotion) {
        currentRotationX += (targetRotationX - currentRotationX) * 0.05;
        currentRotationY += (targetRotationY - currentRotationY) * 0.05;

        pointCloud.rotation.y += 0.003;
        pointCloud.rotation.x = currentRotationX;
        pointCloud.rotation.y += currentRotationY * 0.02;

        ring.rotation.z += 0.001;
      }

      // Smoothly morph points toward target positions
      const positions = geometry.attributes.position.array as Float32Array;
      let needsUpdate = false;
      const morphSpeed = prefersReducedMotion ? 1.0 : Math.min(delta * 4.5, 0.2);

      for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        const diff = targetPositions[i] - positions[i];
        if (Math.abs(diff) > 0.001) {
          positions[i] += diff * morphSpeed;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      observer.disconnect();
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      container.innerHTML = '';
    };
  }, [scale, theme, currentShape, interactive]);

  if (!hasWebGL) {
    return (
      <div className={`flex items-center justify-center border border-neutral-300 rounded-sm p-6 text-xs font-mono text-neutral-500 ${className}`}>
        [WebGL not supported in current environment]
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={handleToggleShape}
      className={`relative cursor-pointer select-none overflow-hidden ${className}`}
      title={interactive ? 'Click to morph geometry (Knot / Sphere / Torus)' : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleToggleShape();
        }
      }}
    >
      {showOverlay && interactive && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-sm bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 text-[10px] font-mono text-neutral-300 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="uppercase">{currentShape}</span>
          <span className="text-neutral-500">· Click to morph</span>
        </div>
      )}
    </div>
  );
};
