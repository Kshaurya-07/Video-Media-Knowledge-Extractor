import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

export interface VyoraIntelligenceOrbitProps {
  className?: string;
  stage?: 1 | 2 | 3 | 4;
  interactive?: boolean;
  showOverlay?: boolean;
  scale?: number;
  onMorph?: (mode: number) => void;
}

export const VyoraIntelligenceOrbit: React.FC<VyoraIntelligenceOrbitProps> = ({
  className = 'w-full h-full min-h-[420px]',
  stage = 1,
  interactive = true,
  showOverlay = true,
  scale = 1.0,
  onMorph,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeMode, setActiveMode] = useState<number>(0);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);

  // Mouse tracking references
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  const modes = [
    { id: '01', title: 'TORUS KNOT (2,3) / INTELLIGENCE ORBIT', code: 'FIG. 01' },
    { id: '02', title: 'DUAL SIGNAL PATHWAYS (A/V)', code: 'FIG. 02' },
    { id: '03', title: 'KNOWLEDGE LATTICE CONSTELLATION', code: 'FIG. 03' },
  ];

  const handleToggleMode = useCallback(() => {
    setActiveMode((prev) => {
      const next = (prev + 1) % modes.length;
      onMorph?.(next);
      return next;
    });
  }, [onMorph, modes.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability safely
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

    let isVisible = true;
    let animFrameId: number;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030304, 0.04);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2 / scale);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Root Assembly Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // -------------------------------------------------------------
    // 1. Central Core: Sculpted Metallic Torus Knot Geometry
    // -------------------------------------------------------------
    const knotGeom = new THREE.TorusKnotGeometry(0.85, 0.22, 140, 24, 2, 3);
    const knotMat = new THREE.MeshStandardMaterial({
      color: 0x121217,
      metalness: 0.94,
      roughness: 0.18,
      wireframe: false,
    });
    const knotMesh = new THREE.Mesh(knotGeom, knotMat);
    rootGroup.add(knotMesh);

    // Wireframe lattice layer around the knot
    const knotWireGeom = new THREE.TorusKnotGeometry(0.86, 0.222, 90, 16, 2, 3);
    const knotWireMat = new THREE.MeshBasicMaterial({
      color: 0x71717a,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const knotWireMesh = new THREE.Mesh(knotWireGeom, knotWireMat);
    rootGroup.add(knotWireMesh);

    // Luminous inner core nucleus (Icosahedron)
    const nucleusGeom = new THREE.IcosahedronGeometry(0.38, 2);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeom, nucleusMat);
    rootGroup.add(nucleusMesh);

    // -------------------------------------------------------------
    // 2. Gimbal Orbital Rings (Precision Thin Silver Bands)
    // -------------------------------------------------------------
    const gimbalGroup = new THREE.Group();
    rootGroup.add(gimbalGroup);

    const ringMatPrimary = new THREE.MeshStandardMaterial({
      color: 0x2e2e38,
      metalness: 0.9,
      roughness: 0.15,
    });
    const ringMatAccent = new THREE.MeshStandardMaterial({
      color: 0x4c4068,
      metalness: 0.85,
      roughness: 0.2,
    });

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.012, 16, 120), ringMatPrimary);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.009, 16, 120), ringMatAccent);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.007, 16, 120), ringMatPrimary);

    ring1.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    ring3.rotation.z = Math.PI / 6;

    gimbalGroup.add(ring1);
    gimbalGroup.add(ring2);
    gimbalGroup.add(ring3);

    // -------------------------------------------------------------
    // 3. Floating Video Frame Planes (Representing Raw Media Frames)
    // -------------------------------------------------------------
    const frameGroup = new THREE.Group();
    rootGroup.add(frameGroup);

    const framePlanes: THREE.Mesh[] = [];
    const frameCount = 7;
    const frameGeom = new THREE.PlaneGeometry(0.38, 0.24);

    for (let i = 0; i < frameCount; i++) {
      const angle = (i / frameCount) * Math.PI * 2;
      const radius = 1.95;

      const fCanvas = document.createElement('canvas');
      fCanvas.width = 128;
      fCanvas.height = 80;
      const ctx = fCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, 128, 80);
        ctx.strokeStyle = i % 2 === 0 ? '#8B5CF6' : '#D4D4D8';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, 120, 72);

        // Simulated timecode on frame
        ctx.fillStyle = '#A1A1AA';
        ctx.font = '10px monospace';
        const sec = (i * 24).toString().padStart(2, '0');
        ctx.fillText(`00:${sec}`, 12, 22);

        // Visual frame bars
        ctx.fillStyle = i % 2 === 0 ? 'rgba(139, 92, 246, 0.4)' : 'rgba(212, 212, 216, 0.3)';
        ctx.fillRect(12, 34, 104, 30);
      }

      const fTexture = new THREE.CanvasTexture(fCanvas);
      const fMat = new THREE.MeshBasicMaterial({
        map: fTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });

      const plane = new THREE.Mesh(frameGeom, fMat);
      plane.position.set(Math.cos(angle) * radius, Math.sin(angle) * 0.45, Math.sin(angle) * radius);
      plane.lookAt(0, 0, 0);
      plane.userData = { angle, speed: 0.003 + (i % 3) * 0.001, radius };

      frameGroup.add(plane);
      framePlanes.push(plane);
    }

    // -------------------------------------------------------------
    // 4. Dual Particle Signal Streams (Visual Stream & Audio Waveform)
    // -------------------------------------------------------------
    const visualParticleCount = 280;
    const visualPositions = new Float32Array(visualParticleCount * 3);
    const visualColors = new Float32Array(visualParticleCount * 3);

    for (let i = 0; i < visualParticleCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = (Math.random() - 0.5) * 1.5;
      const r = 1.35 + Math.random() * 0.9;

      visualPositions[i * 3] = Math.cos(u) * r;
      visualPositions[i * 3 + 1] = v;
      visualPositions[i * 3 + 2] = Math.sin(u) * r;

      // Silver / white tones
      visualColors[i * 3] = 0.85;
      visualColors[i * 3 + 1] = 0.85;
      visualColors[i * 3 + 2] = 0.92;
    }

    const visualGeom = new THREE.BufferGeometry();
    visualGeom.setAttribute('position', new THREE.BufferAttribute(visualPositions, 3));
    visualGeom.setAttribute('color', new THREE.BufferAttribute(visualColors, 3));

    const visualMat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const visualParticles = new THREE.Points(visualGeom, visualMat);
    rootGroup.add(visualParticles);

    // Audio Waveform Particle Stream (Subtle Violet)
    const audioParticleCount = 220;
    const audioPositions = new Float32Array(audioParticleCount * 3);
    for (let i = 0; i < audioParticleCount; i++) {
      const u = (i / audioParticleCount) * Math.PI * 4;
      const r = 1.1 + Math.sin(u * 3) * 0.15;
      audioPositions[i * 3] = Math.cos(u) * r;
      audioPositions[i * 3 + 1] = Math.sin(u * 5) * 0.28;
      audioPositions[i * 3 + 2] = Math.sin(u) * r;
    }

    const audioGeom = new THREE.BufferGeometry();
    audioGeom.setAttribute('position', new THREE.BufferAttribute(audioPositions, 3));
    const audioMat = new THREE.PointsMaterial({
      size: 0.04,
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const audioParticles = new THREE.Points(audioGeom, audioMat);
    rootGroup.add(audioParticles);

    // -------------------------------------------------------------
    // 5. Interconnected Knowledge Nodes (Synthesis Constellation)
    // -------------------------------------------------------------
    const nodeGroup = new THREE.Group();
    rootGroup.add(nodeGroup);

    const nodeLabels = ['SUMMARY', 'CHAPTERS', 'TRANSCRIPT', 'KEY MOMENTS', 'ENTITIES'];
    const nodeSpheres: THREE.Mesh[] = [];
    const nodeLinePositions: number[] = [];

    nodeLabels.forEach((label, idx) => {
      const theta = (idx / nodeLabels.length) * Math.PI * 2;
      const r = 1.65;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta * 2) * 0.35;
      const z = Math.sin(theta) * r;

      const nGeom = new THREE.SphereGeometry(0.045, 16, 16);
      const nMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0xffffff : 0xa78bfa,
      });
      const node = new THREE.Mesh(nGeom, nMat);
      node.name = label;
      node.position.set(x, y, z);
      nodeGroup.add(node);
      nodeSpheres.push(node);

      nodeLinePositions.push(0, 0, 0);
      nodeLinePositions.push(x, y, z);
    });

    const linesGeom = new THREE.BufferGeometry();
    linesGeom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(nodeLinePositions, 3)
    );
    const linesMat = new THREE.LineBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.25,
    });
    const connectorLines = new THREE.LineSegments(linesGeom, linesMat);
    nodeGroup.add(connectorLines);

    // -------------------------------------------------------------
    // 6. Lights & Illumination
    // -------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(4, 5, 4);
    scene.add(dirLight1);

    const violetAccentLight = new THREE.PointLight(0x8b5cf6, 2.5, 10);
    violetAccentLight.position.set(0, 0, 0);
    scene.add(violetAccentLight);

    const rimLight = new THREE.DirectionalLight(0xd4d4d8, 0.8);
    rimLight.position.set(-4, -3, -3);
    scene.add(rimLight);

    // -------------------------------------------------------------
    // Interaction Handlers
    // -------------------------------------------------------------
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current.targetX = x * 0.45;
      mouseRef.current.targetY = y * 0.45;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // Optimization: Pause when scrolled offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // -------------------------------------------------------------
    // Animation Loop
    // -------------------------------------------------------------
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // Base rotations
      knotMesh.rotation.x = elapsed * 0.18 + mouseRef.current.y * 0.5;
      knotMesh.rotation.y = elapsed * 0.28 + mouseRef.current.x * 0.5;
      knotWireMesh.rotation.x = knotMesh.rotation.x;
      knotWireMesh.rotation.y = knotMesh.rotation.y;

      nucleusMesh.rotation.x = -elapsed * 0.35;
      nucleusMesh.rotation.y = elapsed * 0.45;

      ring1.rotation.x = Math.PI / 3 + elapsed * 0.12;
      ring2.rotation.y = Math.PI / 4 - elapsed * 0.15;
      ring3.rotation.z = Math.PI / 6 + elapsed * 0.08;

      visualParticles.rotation.y = elapsed * 0.08;
      audioParticles.rotation.y = -elapsed * 0.14;

      // Orbiting video frames
      framePlanes.forEach((plane, i) => {
        const u = plane.userData.angle + elapsed * plane.userData.speed;
        const r = plane.userData.radius;
        plane.position.x = Math.cos(u) * r;
        plane.position.z = Math.sin(u) * r;
        plane.position.y = Math.sin(u * 2 + i) * 0.35;
        plane.lookAt(0, 0, 0);
      });

      // Stage Evolution Logic for Scroll Storytelling
      if (stage === 1) {
        // Stage 1: Raw Media focus (frames prominent, node group subdued)
        frameGroup.visible = true;
        nodeGroup.visible = false;
        visualParticles.visible = true;
        audioParticles.visible = false;
        knotWireMat.opacity = 0.15;
      } else if (stage === 2) {
        // Stage 2: Intelligence focus (both signal streams activated)
        frameGroup.visible = true;
        nodeGroup.visible = false;
        visualParticles.visible = true;
        audioParticles.visible = true;
        knotWireMat.opacity = 0.35;
      } else if (stage === 3) {
        // Stage 3: Knowledge Extraction (nodes emerge, connecting lines visible)
        frameGroup.visible = true;
        nodeGroup.visible = true;
        linesMat.opacity = 0.25;
        audioParticles.visible = true;
      } else {
        // Stage 4: Complete Understanding Constellation
        frameGroup.visible = true;
        nodeGroup.visible = true;
        linesMat.opacity = 0.45;
        visualParticles.visible = true;
        audioParticles.visible = true;
      }

      // Root group reaction to cursor
      rootGroup.rotation.y = mouseRef.current.x * 0.35;
      rootGroup.rotation.x = -mouseRef.current.y * 0.25;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(animFrameId);
      renderer.dispose();
      knotGeom.dispose();
      knotMat.dispose();
      visualGeom.dispose();
      visualMat.dispose();
      audioGeom.dispose();
      audioMat.dispose();
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [interactive, scale, stage, activeMode]);

  return (
    <div className={`relative ${className} select-none`}>
      {!hasWebGL ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center border border-[#26262E] rounded-2xl bg-[#070709]">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 mb-3">
            3D
          </div>
          <p className="text-xs font-mono text-[#A1A1AA]">
            Interactive Intelligence Orbit (WebGL hardware acceleration unavailable).
          </p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Technical ORDO-Inspired Telemetry Overlay */}
          {showOverlay && (
            <>
              {/* Top-Left Figure Identifier */}
              <div className="absolute top-4 left-4 pointer-events-none z-10 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
                    {modes[activeMode].code} — {modes[activeMode].title}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[#52525B]">
                  INTELLIGENCE SPACE / MULTIMODAL MESH
                </span>
              </div>

              {/* Bottom Interactive Mode Morph Trigger */}
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-auto">
                <button
                  type="button"
                  onClick={handleToggleMode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0A0E]/80 hover:bg-[#121217] border border-[#26262E] text-[10px] font-mono text-[#D4D4D8] hover:text-white transition-all backdrop-blur-md shadow-lg"
                >
                  <span className="text-violet-400 font-bold">MORPH</span>
                  <span className="text-[#52525B]">|</span>
                  <span>{modes[activeMode].id} / 03 FORMS</span>
                </button>

                <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-[#71717A]">
                  <span>DRAG TO DISPLACE</span>
                  <span>·</span>
                  <span>4D INTERLEAVED</span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};