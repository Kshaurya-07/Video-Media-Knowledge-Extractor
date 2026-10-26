import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface VyoraKnowledgeCoreProps {
  className?: string;
  interactive?: boolean;
  scale?: number;
  particleCount?: number;
  glowColor?: string;
  coreSpeed?: number;
}

export const VyoraKnowledgeCore: React.FC<VyoraKnowledgeCoreProps> = ({
  className = 'w-full h-full min-h-[360px]',
  interactive = true,
  scale = 1.0,
  particleCount = 200,
  glowColor = '#8B5CF6',
  coreSpeed = 0.005,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    // Three.js Scene Setup
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.8 / scale;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Group containing all core elements
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // 1. Central Sculptural Metallic Core (Icosahedron with reflective metallic material)
    const coreGeom = new THREE.IcosahedronGeometry(0.9, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.92,
      roughness: 0.18,
      flatShading: true,
    });
    const centralCore = new THREE.Mesh(coreGeom, coreMat);
    coreGroup.add(centralCore);

    // Core Wireframe Cage
    const wireGeom = new THREE.IcosahedronGeometry(0.92, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xd4d4d8,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const wireCore = new THREE.Mesh(wireGeom, wireMat);
    coreGroup.add(wireCore);

    // 2. Gimbal Orbital Rings (Metallic Toruses)
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.95,
      roughness: 0.15,
    });
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      metalness: 0.9,
      roughness: 0.2,
    });

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.018, 16, 100), ringMat1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.015, 16, 100), ringMat2);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.012, 16, 100), ringMat1);

    ring1.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    ring3.rotation.z = Math.PI / 6;

    coreGroup.add(ring1);
    coreGroup.add(ring2);
    coreGroup.add(ring3);

    // 3. Luminous Node Spheres placed around the orbital paths
    const nodeGeom = new THREE.SphereGeometry(0.045, 16, 16);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(glowColor),
    });

    const nodes: THREE.Mesh[] = [];
    const numNodes = 7;
    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * Math.PI * 2;
      const radius = 1.35;
      const node = new THREE.Mesh(nodeGeom, nodeMat);
      node.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      ring1.add(node);
      nodes.push(node);
    }

    // 4. Surrounding Quantum Particle Swarm
    const pGeom = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const colorArray = new Float32Array(particleCount * 3);
    const violetColor = new THREE.Color(glowColor);
    const silverColor = new THREE.Color(0xd4d4d8);

    for (let i = 0; i < particleCount; i++) {
      const r = 1.4 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      posArray[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      posArray[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      posArray[i * 3 + 2] = r * Math.cos(phi);

      const mixed = Math.random() > 0.4 ? violetColor : silverColor;
      colorArray[i * 3] = mixed.r;
      colorArray[i * 3 + 1] = mixed.g;
      colorArray[i * 3 + 2] = mixed.b;
    }

    pGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    pGeom.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeom, pMat);
    coreGroup.add(particles);

    // 5. Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(4, 5, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xd4d4d8, 1.2);
    dirLight2.position.set(-4, -2, -3);
    scene.add(dirLight2);

    const pointLightViolet = new THREE.PointLight(glowColor, 3.5, 6);
    pointLightViolet.position.set(0, 0, 0);
    scene.add(pointLightViolet);

    // Pointer Interaction & Parallax
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotationY = x * 1.5;
      targetRotationX = y * 1.5;
    };

    if (interactive) {
      window.addEventListener('mousemove', handlePointerMove, { passive: true });
    }

    // Animation Loop
    let animId: number;
    let isVisible = true;

    // Pause when off-screen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();

      // Continuous Slow Orbital Rotations
      ring1.rotation.x += coreSpeed * 1.2;
      ring1.rotation.y += coreSpeed * 0.8;

      ring2.rotation.y += coreSpeed * 1.5;
      ring2.rotation.z += coreSpeed * 0.6;

      ring3.rotation.z += coreSpeed * 1.1;
      ring3.rotation.x += coreSpeed * 0.9;

      centralCore.rotation.y += coreSpeed * 0.5;
      centralCore.rotation.x += coreSpeed * 0.3;

      wireCore.rotation.y -= coreSpeed * 0.7;

      particles.rotation.y = elapsed * 0.05;

      // Pointer Inertia Damping
      currentRotationX += (targetRotationX - currentRotationX) * 0.05;
      currentRotationY += (targetRotationY - currentRotationY) * 0.05;

      coreGroup.rotation.x = currentRotationX + Math.sin(elapsed * 0.5) * 0.08;
      coreGroup.rotation.y = currentRotationY + elapsed * 0.1;

      // Subtle breathing scale
      const breath = 1 + Math.sin(elapsed * 1.2) * 0.02;
      centralCore.scale.set(breath, breath, breath);

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
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
      if (interactive) {
        window.removeEventListener('mousemove', handlePointerMove);
      }
      renderer.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      pGeom.dispose();
      pMat.dispose();
      container.innerHTML = '';
    };
  }, [interactive, scale, particleCount, glowColor, coreSpeed]);

  if (!hasWebGL) {
    return (
      <div className={`flex items-center justify-center bg-[#0a0a0a] rounded-3xl border border-[#27272A] ${className}`}>
        <div className="relative flex items-center justify-center w-48 h-48 rounded-full border border-violet-500/30 animate-pulse">
          <div className="w-32 h-32 rounded-full border border-zinc-700 animate-spin" />
          <div className="absolute w-16 h-16 rounded-full bg-gradient-to-tr from-violet-600 to-zinc-400 blur-sm" />
          <span className="text-xs font-mono text-zinc-400">VYORA CORE</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative cursor-grab active:cursor-grabbing overflow-hidden ${className}`}
      aria-label="3D Vyora Knowledge Core Visualization"
    />
  );
};
