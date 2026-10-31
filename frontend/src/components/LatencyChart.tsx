import React, { useState, useRef } from 'react';

interface DataPoint {
  id: string;
  sizeMb: number;
  durationSec: number;
  label: string;
  type: string;
}

const SAMPLE_BENCHMARKS: DataPoint[] = [
  { id: 'JOB-941', sizeMb: 12.4, durationSec: 14.2, label: 'Tech Keynote (1080p)', type: 'Direct Upload' },
  { id: 'JOB-942', sizeMb: 24.8, durationSec: 21.6, label: 'Architecture Walkthrough', type: 'YouTube Stream' },
  { id: 'JOB-943', sizeMb: 40.7, durationSec: 32.4, label: 'Lecture Session (480p)', type: 'Direct Upload' },
  { id: 'JOB-944', sizeMb: 68.2, durationSec: 46.1, label: 'Panel Discussion', type: 'Direct URL' },
  { id: 'JOB-945', sizeMb: 110.5, durationSec: 68.3, label: 'Engineering Workshop', type: 'Direct Upload' },
  { id: 'JOB-946', sizeMb: 180.0, durationSec: 94.7, label: 'Symposium Recording', type: 'Direct Upload' },
  { id: 'JOB-947', sizeMb: 245.2, durationSec: 118.0, label: 'Quarterly Townhall', type: 'YouTube Stream' },
  { id: 'JOB-948', sizeMb: 340.0, durationSec: 152.5, label: 'Conference Stream (1080p)', type: 'Direct Upload' },
  { id: 'JOB-949', sizeMb: 420.0, durationSec: 184.2, label: 'Multi-hour Seminar', type: 'Direct URL' },
  { id: 'JOB-950', sizeMb: 495.0, durationSec: 210.0, label: 'Full Length Masterclass (Max 500MB)', type: 'Direct Upload' },
];

export const LatencyChart: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState<number>(2); // Default to 40.7MB benchmark
  const containerRef = useRef<HTMLDivElement>(null);

  const width = 640;
  const height = 220;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 40;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const maxDuration = 240; // 240 seconds scale

  const getX = (index: number) => {
    return paddingX + (index / (SAMPLE_BENCHMARKS.length - 1)) * innerWidth;
  };

  const getY = (duration: number) => {
    return height - paddingBottom - (duration / maxDuration) * innerHeight;
  };

  const linePath = SAMPLE_BENCHMARKS.map((pt, i) => {
    const x = getX(i);
    const y = getY(pt.durationSec);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(SAMPLE_BENCHMARKS.length - 1, prev + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratio = (clientX / rect.width) * width;
    
    // Find closest index
    let closestIdx = 0;
    let closestDist = Infinity;
    SAMPLE_BENCHMARKS.forEach((_, i) => {
      const x = getX(i);
      const dist = Math.abs(ratio - x);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });
    setSelectedIndex(closestIdx);
  };

  const activePoint = SAMPLE_BENCHMARKS[selectedIndex];
  const activeX = getX(selectedIndex);
  const activeY = getY(activePoint.durationSec);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="p-5 sm:p-6 bg-white border border-neutral-300 rounded-sm text-neutral-950 focus:outline-none focus-visible:outline-neutral-950 select-none space-y-4"
      aria-label="Interactive latency benchmark chart. Use left and right arrow keys to explore sample data."
    >
      {/* Chart Telemetry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neutral-900" />
          <span className="text-xs font-mono font-semibold tracking-wider uppercase text-neutral-950">
            PROCESSING LATENCY PROFILE
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-neutral-100 border border-neutral-300 text-neutral-500">
            Sample data
          </span>
        </div>

        <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-3">
          <span>Arrows / Hover to probe</span>
          <span className="text-neutral-300">|</span>
          <span className="text-neutral-950 font-semibold">{activePoint.sizeMb} MB in {activePoint.durationSec}s</span>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div className="relative w-full aspect-[640/220] max-h-64">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair overflow-visible"
          onPointerMove={handlePointerMove}
        >
          {/* Hairline Grid Y-Lines */}
          {[60, 120, 180, 240].map((sec) => {
            const y = getY(sec);
            return (
              <g key={sec}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#e5e5e5"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fontFamily="Geist Mono, monospace"
                  fill="#a3a3a3"
                >
                  {sec}s
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={paddingX}
            y1={height - paddingBottom}
            x2={width - paddingX}
            y2={height - paddingBottom}
            stroke="#d4d4d4"
            strokeWidth="1"
          />

          {/* Vertical Bars for Each Point */}
          {SAMPLE_BENCHMARKS.map((pt, i) => {
            const x = getX(i);
            const y = getY(pt.durationSec);
            const isSelected = i === selectedIndex;
            return (
              <g key={pt.id}>
                <line
                  x1={x}
                  y1={height - paddingBottom}
                  x2={x}
                  y2={y}
                  stroke={isSelected ? '#0a0a0a' : '#e5e5e5'}
                  strokeWidth={isSelected ? '2' : '1'}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 4 : 2}
                  fill={isSelected ? '#0a0a0a' : '#ffffff'}
                  stroke="#0a0a0a"
                  strokeWidth={isSelected ? '2' : '1'}
                />
                {/* Size Labels */}
                <text
                  x={x}
                  y={height - paddingBottom + 16}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily="Geist Mono, monospace"
                  fill={isSelected ? '#0a0a0a' : '#737373'}
                  fontWeight={isSelected ? '600' : '400'}
                >
                  {Math.round(pt.sizeMb)}M
                </text>
              </g>
            );
          })}

          {/* Connected Thin Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#0a0a0a"
            strokeWidth="1.5"
          />

          {/* Hover / Selected Crosshair Guideline */}
          <line
            x1={activeX}
            y1={paddingTop}
            x2={activeX}
            y2={height - paddingBottom}
            stroke="#0a0a0a"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Active Probe Node */}
          <circle
            cx={activeX}
            cy={activeY}
            r="6"
            fill="#ffffff"
            stroke="#0a0a0a"
            strokeWidth="2.5"
          />
        </svg>

        {/* Floating Tooltip Box */}
        <div
          className="absolute z-20 pointer-events-none transition-all duration-75 text-left bg-neutral-950 text-white p-2.5 rounded-sm border border-neutral-800 shadow-md text-xs font-mono"
          style={{
            left: `${(activeX / width) * 100}%`,
            top: `${(activeY / height) * 100}%`,
            transform: `translate(${activeX > width / 2 ? '-105%' : '8%'}, -110%)`,
          }}
        >
          <div className="flex items-center justify-between gap-4 text-[10px] text-neutral-400 border-b border-neutral-800 pb-1 mb-1">
            <span>{activePoint.id}</span>
            <span className="text-emerald-400">READY</span>
          </div>
          <div className="font-semibold text-white truncate max-w-[180px]">{activePoint.label}</div>
          <div className="flex items-center gap-3 text-[11px] text-neutral-300 mt-1">
            <span>Size: <strong>{activePoint.sizeMb} MB</strong></span>
            <span>Duration: <strong>{activePoint.durationSec}s</strong></span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">{activePoint.type} · 1M token context</div>
        </div>
      </div>

      {/* Verified Repository Facts Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-200 text-left text-[11px] font-mono">
        <div>
          <span className="text-neutral-400 block text-[9.5px]">FILE CEILING</span>
          <span className="font-semibold text-neutral-900">500 MB Limit</span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[9.5px]">INGEST MODES</span>
          <span className="font-semibold text-neutral-900">Upload / URL / YouTube</span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[9.5px]">SSRF ISOLATION</span>
          <span className="font-semibold text-neutral-900">Max 3 Hops · Peer Guard</span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[9.5px]">GROUNDING CITATION</span>
          <span className="font-semibold text-neutral-900">Exact Millisecond Sync</span>
        </div>
      </div>
    </div>
  );
};
