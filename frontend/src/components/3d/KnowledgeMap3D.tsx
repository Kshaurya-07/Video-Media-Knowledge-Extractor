import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'video' | 'chapter' | 'concept';
  category?: string;
  timestamp?: string;
  projectId?: string;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
}

interface KnowledgeMap3DProps {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  onSelectNode?: (node: KnowledgeGraphNode) => void;
  className?: string;
}

export const KnowledgeMap3D: React.FC<KnowledgeMap3DProps> = ({
  nodes,
  links,
  onSelectNode,
  className = 'w-full h-80',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{
    label: string;
    type: string;
    category?: string;
    timestamp?: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !nodes.length) return;

    let isVisible = true;
    let animId: number;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    // Compute node 3D spatial layout using spherical/radial distribution
    const nodePositionMap = new Map<string, THREE.Vector3>();
    const nodeMeshes: THREE.Mesh[] = [];

    // Geometries & Materials (Monochrome system)
    const videoGeom = new THREE.IcosahedronGeometry(0.35, 1);
    const chapterGeom = new THREE.SphereGeometry(0.18, 16, 16);
    const conceptGeom = new THREE.OctahedronGeometry(0.14, 0);

    const videoMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      metalness: 0.9,
      roughness: 0.2,
    });

    const chapterMat = new THREE.MeshStandardMaterial({
      color: 0x525252,
      metalness: 0.8,
      roughness: 0.3,
    });

    const conceptMat = new THREE.MeshStandardMaterial({
      color: 0xa3a3a3,
      metalness: 0.85,
      roughness: 0.2,
    });

    // Arrange nodes
    nodes.forEach((node, idx) => {
      let pos = new THREE.Vector3();
      if (node.type === 'video') {
        pos.set(0, 0, 0);
      } else if (node.type === 'chapter') {
        const phi = (idx / nodes.length) * Math.PI * 2;
        const r = 2.4;
        pos.set(Math.cos(phi) * r, Math.sin(phi) * r * 0.65, (Math.random() - 0.5) * 1.2);
      } else {
        const theta = (idx / nodes.length) * Math.PI * 2 + 0.3;
        const r = 4.0;
        pos.set(Math.cos(theta) * r, Math.sin(theta) * r * 0.75, (Math.random() - 0.5) * 2.2);
      }

      nodePositionMap.set(node.id, pos);

      const geom =
        node.type === 'video'
          ? videoGeom
          : node.type === 'chapter'
          ? chapterGeom
          : conceptGeom;
      const mat =
        node.type === 'video'
          ? videoMat
          : node.type === 'chapter'
          ? chapterMat
          : conceptMat;

      const mesh = new THREE.Mesh(geom, mat.clone());
      mesh.position.copy(pos);
      mesh.userData = { node };
      mapGroup.add(mesh);
      nodeMeshes.push(mesh);
    });

    // Draw Connecting Lines
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xd4d4d4,
      transparent: true,
      opacity: 0.6,
    });

    links.forEach((link) => {
      const srcPos = nodePositionMap.get(link.source);
      const tgtPos = nodePositionMap.get(link.target);
      if (srcPos && tgtPos) {
        const points = [srcPos, tgtPos];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeom, lineMat);
        mapGroup.add(line);
      }
    });

    // Ambient & Directional Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 6, 5);
    scene.add(dirLight);

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const n: KnowledgeGraphNode = hit.userData.node;
        setHoveredNode({
          label: n.label,
          type: n.type,
          category: n.category,
          timestamp: n.timestamp,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredNode(null);
        document.body.style.cursor = 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const n: KnowledgeGraphNode = hit.userData.node;
        onSelectNode?.(n);
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleClick);

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    });
    observer.observe(container);

    const clock = new THREE.Clock();

    const animate = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(animate);
        return;
      }

      const elapsed = clock.getElapsedTime();
      mapGroup.rotation.y = elapsed * 0.06;
      mapGroup.rotation.x = Math.sin(elapsed * 0.12) * 0.1;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

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
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleClick);
      document.body.style.cursor = 'default';
      renderer.dispose();
      videoGeom.dispose();
      chapterGeom.dispose();
      conceptGeom.dispose();
      container.innerHTML = '';
    };
  }, [nodes, links, onSelectNode]);

  return (
    <div className={`relative bg-neutral-50/70 border border-neutral-300 rounded-sm overflow-hidden ${className}`}>
      <div className="absolute top-3 left-4 z-10 flex items-center justify-between w-[calc(100%-2rem)]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
          <span className="text-xs font-mono tracking-wider uppercase text-neutral-950 font-semibold">
            Concept topology graph
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-neutral-500 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-neutral-950" /> Video
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-neutral-600" /> Chapters
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-neutral-400" /> Concepts
          </span>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {hoveredNode && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-sm bg-white border border-neutral-300 shadow-md text-neutral-950"
          style={{ left: hoveredNode.x, top: hoveredNode.y - 12 }}
        >
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-0.5">
            {hoveredNode.type} {hoveredNode.category ? `• ${hoveredNode.category}` : ''}
          </div>
          <div className="font-semibold text-xs text-neutral-950 max-w-[220px]">{hoveredNode.label}</div>
          {hoveredNode.timestamp && (
            <div className="text-[10px] font-mono text-neutral-500 mt-1">
              Timestamp: {hoveredNode.timestamp}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
