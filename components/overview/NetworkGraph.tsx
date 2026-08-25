'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationFrame } from "motion/react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export type GraphNodeKind = 'app' | 'provider' | 'model';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  weight: number;
  color?: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  /** Real call-volume weight, or null when the edge only represents live routing (no usage data exists). */
  weight: number | null;
  color?: string;
}

interface NetworkGraphProps {
  appNodes: GraphNode[];
  providerNodes: GraphNode[];
  modelNodes: GraphNode[];
  appProviderEdges: GraphEdge[];
  providerModelEdges: GraphEdge[];
  highlightedId: string | null;
  onNodeClick: (id: string, kind: GraphNodeKind) => void;
  emptyAppsLabel: string;
  emptyProvidersLabel: string;
  emptyModelsLabel: string;
  theme: 'dark' | 'light';
}

const VIEW_W = 900;
const VIEW_H = 440;
const COL_MARGIN = 40;
const MIN_R = 2.5;
const MAX_R = 9;
const MAX_PULSES = 10;
const TIER_X: Record<GraphNodeKind, number> = { app: VIEW_W * 0.1, provider: VIEW_W * 0.5, model: VIEW_W * 0.9 };

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  r: number;
}

// Small deterministic hash so node scatter/curve-bow looks organic but is stable across
// re-renders (no Math.random(), which would reshuffle the layout on every prop change).
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function layoutColumn(nodes: GraphNode[], x: number): PositionedNode[] {
  const maxWeight = Math.max(0, ...nodes.map(n => n.weight));
  const n = nodes.length;
  return nodes.map((node, i) => {
    const baseY = n === 1 ? VIEW_H / 2 : COL_MARGIN + (i * (VIEW_H - COL_MARGIN * 2)) / (n - 1);
    // +/- up to ~5% of height jitter, seeded by id — organic scatter instead of a rigid grid.
    const jitter = ((hashId(node.id) % 100) / 100 - 0.5) * VIEW_H * 0.1;
    const jitterX = ((hashId(node.id + 'x') % 100) / 100 - 0.5) * VIEW_W * 0.02;
    const t = maxWeight > 0 ? Math.sqrt(Math.max(node.weight, 0) / maxWeight) : 0;
    const r = MIN_R + (MAX_R - MIN_R) * t;
    return { ...node, x: x + jitterX, y: Math.min(VIEW_H - COL_MARGIN / 2, Math.max(COL_MARGIN / 2, baseY + jitter)), r };
  });
}

// A fuller, more organic bow than a plain S-curve — bulges outward before narrowing in, closer
// to the flowing "hair strand" look of the reference than a flat bezier.
function edgePath(x1: number, y1: number, x2: number, y2: number, bow: number): string {
  const midX = (x1 + x2) / 2;
  const dy = (y2 - y1) * 0.15 * bow;
  const c1x = x1 + (midX - x1) * 0.55;
  const c2x = x2 - (x2 - midX) * 0.55;
  return `M ${x1} ${y1} C ${c1x} ${y1 + dy}, ${c2x} ${y2 - dy}, ${x2} ${y2}`;
}

function truncateLabel(label: string, max = 13): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function withPlaceholder(nodes: GraphNode[], kind: GraphNodeKind, emptyLabel: string): GraphNode[] {
  if (nodes.length > 0) return nodes;
  return [{ id: `__empty__:${kind}`, kind, label: emptyLabel, weight: 0 }];
}

const COMET_TAIL_OFFSETS_MS = [0, 90, 180, 270];
const COMET_CYCLE_MS = 2600;

function AnimatedEdge({
  d, stroke, strokeWidth, strokeOpacity, dashed, pulse, delayMs,
}: {
  d: string; stroke: string; strokeWidth: number; strokeOpacity: number;
  dashed: boolean; pulse: boolean; delayMs: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);

  useAnimationFrame((t) => {
    if (!pulse || !pathRef.current) return;
    const length = pathRef.current.getTotalLength();
    if (!length) return;
    COMET_TAIL_OFFSETS_MS.forEach((offset, i) => {
      const dot = dotRefs.current[i];
      if (!dot) return;
      const progress = ((t + delayMs - offset + COMET_CYCLE_MS * 10) % COMET_CYCLE_MS) / COMET_CYCLE_MS;
      const point = pathRef.current!.getPointAtLength(progress * length);
      dot.setAttribute('cx', String(point.x));
      dot.setAttribute('cy', String(point.y));
    });
  });

  return (
    <>
      <motion.path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={dashed ? "3 4" : undefined}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: delayMs / 1000, ease: "easeOut" }}
      />
      {pulse && COMET_TAIL_OFFSETS_MS.map((_, i) => (
        <circle
          key={i}
          ref={el => { dotRefs.current[i] = el; }}
          r={2.2 - i * 0.4}
          fill={stroke}
          opacity={0.95 - i * 0.22}
          filter={i === 0 ? "url(#edge-glow)" : undefined}
        />
      ))}
    </>
  );
}

export default function NetworkGraph({
  appNodes, providerNodes, modelNodes,
  appProviderEdges, providerModelEdges,
  highlightedId, onNodeClick,
  emptyAppsLabel, emptyProvidersLabel, emptyModelsLabel,
  theme,
}: NetworkGraphProps) {
  // Zoom in/out (scroll wheel or the +/- buttons) with drag-to-pan once zoomed — the SVG itself
  // stays a fixed viewBox, so this is purely a CSS transform, no re-layout cost.
  const MIN_SCALE = 1;
  const MAX_SCALE = 3.5;
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const wheelTargetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = wheelTargetRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(s => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s - e.deltaY * 0.0015));
        if (next <= MIN_SCALE) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= MIN_SCALE) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  const stopDragging = () => setIsDragging(false);

  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, s + 0.5));
  const zoomOut = () => setScale(s => {
    const next = Math.max(MIN_SCALE, s - 0.5);
    if (next <= MIN_SCALE) setPan({ x: 0, y: 0 });
    return next;
  });
  const resetZoom = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  const appColSrc = useMemo(() => withPlaceholder(appNodes, 'app', emptyAppsLabel), [appNodes, emptyAppsLabel]);
  const providerColSrc = useMemo(() => withPlaceholder(providerNodes, 'provider', emptyProvidersLabel), [providerNodes, emptyProvidersLabel]);
  const modelColSrc = useMemo(() => withPlaceholder(modelNodes, 'model', emptyModelsLabel), [modelNodes, emptyModelsLabel]);

  const appCol = useMemo(() => layoutColumn(appColSrc, TIER_X.app), [appColSrc]);
  const providerCol = useMemo(() => layoutColumn(providerColSrc, TIER_X.provider), [providerColSrc]);
  const modelCol = useMemo(() => layoutColumn(modelColSrc, TIER_X.model), [modelColSrc]);

  const positionById = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    [...appCol, ...providerCol, ...modelCol].forEach(n => map.set(n.id, n));
    return map;
  }, [appCol, providerCol, modelCol]);

  const connectedIds = useMemo(() => {
    if (!highlightedId) return null;
    const set = new Set<string>([highlightedId]);
    [...appProviderEdges, ...providerModelEdges].forEach(e => {
      if (e.sourceId === highlightedId) set.add(e.targetId);
      if (e.targetId === highlightedId) set.add(e.sourceId);
    });
    return set;
  }, [highlightedId, appProviderEdges, providerModelEdges]);

  const maxAppProviderWeight = useMemo(
    () => Math.max(0, ...appProviderEdges.map(e => e.weight ?? 0)),
    [appProviderEdges]
  );

  const pulseEdgeIds = useMemo(() => {
    const weighted = appProviderEdges.filter(e => (e.weight ?? 0) > 0);
    const topByVolume = [...weighted]
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, MAX_PULSES)
      .map(e => e.id);
    if (!highlightedId) return new Set(topByVolume);
    const connected = weighted
      .filter(e => e.sourceId === highlightedId || e.targetId === highlightedId)
      .map(e => e.id);
    return new Set([...topByVolume, ...connected]);
  }, [appProviderEdges, highlightedId]);

  const renderEdges = (edges: GraphEdge[], weighted: boolean) => edges.map((edge, i) => {
    const from = positionById.get(edge.sourceId);
    const to = positionById.get(edge.targetId);
    if (!from || !to) return null;

    const isDimmed = connectedIds != null && !(connectedIds.has(edge.sourceId) && connectedIds.has(edge.targetId));
    const w = weighted && maxAppProviderWeight > 0 ? (edge.weight ?? 0) / maxAppProviderWeight : 0;
    const strokeWidth = weighted ? 0.6 + w * 2.6 : 0.5;
    const baseOpacity = weighted ? 0.15 + w * 0.55 : 0.14;
    const strokeOpacity = isDimmed ? baseOpacity * 0.3 : baseOpacity;
    const bow = 0.6 + (hashId(edge.id) % 100) / 100;

    return (
      <AnimatedEdge
        key={edge.id}
        d={edgePath(from.x, from.y, to.x, to.y, bow)}
        stroke={edge.color || "var(--text-secondary)"}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        dashed={!weighted}
        pulse={weighted && pulseEdgeIds.has(edge.id) && !isDimmed}
        delayMs={i * 30}
      />
    );
  });

  const renderNodes = (nodes: PositionedNode[], x: number) => nodes.map(node => {
    const isDimmed = connectedIds != null && !connectedIds.has(node.id);
    const isFocused = highlightedId === node.id;
    const isPlaceholder = node.id.startsWith('__empty__:');
    const fill = node.color || "var(--text-secondary)";
    const labelY = node.y + node.r + 13;

    return (
      <motion.g
        key={node.id}
        className={isPlaceholder ? "" : "cursor-pointer"}
        onClick={() => !isPlaceholder && onNodeClick(node.id, node.kind)}
        animate={{ scale: isFocused ? 1.4 : 1, opacity: isDimmed ? 0.3 : isPlaceholder ? 0.35 : 1 }}
        transition={{ duration: 0.25 }}
        style={{ transformOrigin: `${node.x}px ${node.y}px` }}
      >
        {!isPlaceholder && <title>{node.label}</title>}
        {isFocused && (
          <motion.circle
            cx={node.x}
            cy={node.y}
            r={node.r}
            fill="none"
            stroke={fill}
            strokeWidth={1.5}
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 2.6 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          />
        )}
        <circle
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill={fill}
          strokeDasharray={isPlaceholder ? "2 2" : undefined}
          stroke={isPlaceholder ? fill : undefined}
          fillOpacity={isPlaceholder ? 0 : 1}
          filter={isFocused ? "url(#node-glow)" : "url(#node-glow-soft)"}
        />
        {!isPlaceholder && (
          <g className="hidden sm:block">
            <text x={x} y={labelY} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="var(--text-secondary)">
              {truncateLabel(node.label)}
            </text>
          </g>
        )}
        {isPlaceholder && (
          <text x={x} y={labelY} textAnchor="middle" fontSize={9} fill="var(--text-secondary)">
            {node.label}
          </text>
        )}
      </motion.g>
    );
  });

  return (
    <div className="w-full aspect-[5/4] sm:aspect-[16/10] relative rounded-xl overflow-hidden">
      {theme === 'dark' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 65% at 12% 50%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 65%), ' +
              'radial-gradient(ellipse 55% 65% at 88% 50%, color-mix(in srgb, var(--success) 14%, transparent), transparent 65%)',
          }}
        />
      )}
      <div
        ref={wheelTargetRef}
        className="w-full h-full"
        style={{
          cursor: scale > MIN_SCALE ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: scale > MIN_SCALE ? 'none' : 'auto',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
      >
        <div style={{ width: '100%', height: '100%', transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <div style={{ width: '100%', height: '100%', transform: `scale(${scale})`, transformOrigin: 'center center' }}>
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full overflow-visible relative">
              <defs>
                <filter id="edge-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="node-glow-soft" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="1.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g>{renderEdges(providerModelEdges, false)}</g>
              <g>{renderEdges(appProviderEdges, true)}</g>
              <g>{renderNodes(appCol, TIER_X.app)}</g>
              <g>{renderNodes(providerCol, TIER_X.provider)}</g>
              <g>{renderNodes(modelCol, TIER_X.model)}</g>
            </svg>
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          className="p-1.5 rounded-lg bg-bento-surface-lighter/90 border border-bento-border text-bento-text-secondary hover:text-bento-text-primary backdrop-blur-sm transition-colors"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          className="p-1.5 rounded-lg bg-bento-surface-lighter/90 border border-bento-border text-bento-text-secondary hover:text-bento-text-primary backdrop-blur-sm transition-colors"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        {scale !== MIN_SCALE && (
          <button
            type="button"
            onClick={resetZoom}
            aria-label="Reset zoom"
            className="p-1.5 rounded-lg bg-bento-surface-lighter/90 border border-bento-border text-bento-text-secondary hover:text-bento-text-primary backdrop-blur-sm transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
