import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Chapter } from '../../lib/types';

interface SpatialTimeline3DProps {
  chapters: Chapter[];
  currentTime: number;
  duration: number;
  onSelectChapter: (seconds: number) => void;
  className?: string;
}

export const SpatialTimeline3D: React.FC<SpatialTimeline3DProps> = ({
  chapters,
  currentTime,
  duration,
  onSelectChapter,
  className = 'w-full h-36',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredChapter, setHoveredChapter] = useState<{ title: string; time: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !chapters.length) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 140;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Timeline Path (Curved Arc)
    const curvePoints = [];
    const numPoints = 80;
    const span = 4.2;
    for (let i = 0; i <= numPoints; i++) {
      const u = (i / numPoints) * 2 - 1; // -1 to 1
      const x = u * (span / 2);
      const y = -Math.pow(u, 2) * 0.45 + 0.2;
      const z = Math.sin(u * Math.PI) * 0.35;
      curvePoints.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const pathGeom = new THREE.TubeGeometry(curve, 64, 0.015, 8, false);
    const pathMat = new THREE.MeshBasicMaterial({
      color: 0x27272a,
      transparent: true,
      opacity: 0.8,
    });
    const tubeMesh = new THREE.Mesh(pathGeom, pathMat);
    group.add(tubeMesh);

    // Progress Glow Arc

    // Chapter Nodes
    const chapterMeshes: THREE.Mesh[] = [];
    const chapterGeom = new THREE.SphereGeometry(0.09, 16, 16);

    chapters.forEach((ch, idx) => {
      const frac = duration > 0 ? ch.start_time / duration : idx / (chapters.length - 1 || 1);
      const pt = curve.getPointAt(Math.min(Math.max(frac, 0), 1));

      const isActive = currentTime >= ch.start_time && currentTime <= ch.end_time;

      const mat = new THREE.MeshStandardMaterial({
        color: isActive ? 0x8b5cf6 : 0xd4d4d8,
        emissive: isActive ? 0x8b5cf6 : 0x000000,
        emissiveIntensity: isActive ? 1.2 : 0,
        metalness: 0.8,
        roughness: 0.2,
      });

      const nodeMesh = new THREE.Mesh(chapterGeom, mat);
      nodeMesh.position.copy(pt);
      nodeMesh.userData = { chapterIndex: idx, chapter: ch };
      group.add(nodeMesh);
      chapterMeshes.push(nodeMesh);

      // Ring around active node
      if (isActive) {
        const ringGeom = new THREE.RingGeometry(0.13, 0.16, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x8b5cf6,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.position.copy(pt);
        group.add(ringMesh);
      }
    });

    // Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(0, 4, 3);
    scene.add(dirLight);

    // Raycasting for Interactivity
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(chapterMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const ch: Chapter = hit.userData.chapter;
        setHoveredChapter({
          title: ch.title,
          time: ch.start_time_formatted,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredChapter(null);
        document.body.style.cursor = 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(chapterMeshes);
      if (intersects.length > 0) {
        const ch: Chapter = intersects[0].object.userData.chapter;
        onSelectChapter(ch.start_time);
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleClick);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Subtle breathing motion
      group.rotation.y = Math.sin(elapsed * 0.4) * 0.05;
      group.rotation.x = Math.sin(elapsed * 0.3) * 0.03;

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
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleClick);
      document.body.style.cursor = 'default';
      renderer.dispose();
      pathGeom.dispose();
      pathMat.dispose();
      chapterGeom.dispose();
      container.innerHTML = '';
    };
  }, [chapters, currentTime, duration, onSelectChapter]);

  return (
    <div className={`relative bg-[#0d0d0d] border border-[#27272A] rounded-2xl overflow-hidden ${className}`}>
      <div className="absolute top-2.5 left-3.5 z-10 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
        <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">
          3D Spatial Chapter Timeline
        </span>
      </div>

      <div ref={containerRef} className="w-full h-full" />

      {hoveredChapter && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-1.5 rounded-xl bg-[#151515] border border-violet-500/40 text-xs shadow-2xl text-zinc-200"
          style={{ left: hoveredChapter.x, top: hoveredChapter.y - 12 }}
        >
          <div className="font-semibold text-white truncate max-w-[200px]">{hoveredChapter.title}</div>
          <div className="text-[10px] font-mono text-violet-400">{hoveredChapter.time} • Click to seek</div>
        </div>
      )}
    </div>
  );
};
