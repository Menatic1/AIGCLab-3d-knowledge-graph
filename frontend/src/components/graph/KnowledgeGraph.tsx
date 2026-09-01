import { useEffect, useMemo, useRef, useState } from 'react';
// @antv/g
import { Canvas, Circle, Group, Rect, Text, Line, Polygon } from '@antv/g';
import { Renderer as SVGRenderer } from '@antv/g-svg';
import { Plugin as RoughSVGPlugin } from '@antv/g-plugin-rough-svg-renderer';
// d3-force 力导向
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';

import type { KnowledgeNode, KnowledgeRelation } from '../../types';
import { CATEGORY_META, RELATION_META } from '../../mock/sampleKnowledgeGraph';
import { useKnowledge } from '../../context/KnowledgeContext';

interface Props {
  onSelectNode: (n: KnowledgeNode) => void;
  selectedId?: string | null;
  highlightIds?: Set<string>;
}

// ============ 类型 ============
interface SimNode extends SimulationNodeDatum {
  id: string;
  knowledge: KnowledgeNode;
  color: string;
  radius: number;
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  type: KnowledgeRelation['type'];
}

// ============ 常量 ============
const ROUGH_BASE = { roughness: 1.5, bowing: 1.8, seed: 2026 };
const ROUGH_FILL = {
  fillStyle: 'hachure' as const,
  hachureAngle: -41,
  hachureGap: 5.5,
  fillWeight: 1.1,
};

// ============ @antv/g 样式设置统一小工具：优先 attr()，兜底直接写 SVG DOM ============
// 性能优化：用 WeakMap 缓存每个 shape 对应的 DOM 元素，避免反复 querySelectorAll
const _domCache = new WeakMap<object, Element | null>();

function _resolveDom(shape: any, extraSelector?: string): Element | null {
  const cached = _domCache.get(shape);
  if (cached !== undefined) return cached;

  let el: any = null;
  try { if (typeof shape.getDomElement === 'function') el = shape.getDomElement(); } catch { /* noop */ }
  if (!el) try { el = shape.nativeElement; } catch { /* noop */ }
  if (!el) try { el = shape.node; } catch { /* noop */ }

  if (!el && extraSelector) {
    try {
      const svgs = document.querySelectorAll('svg');
      for (let i = svgs.length - 1; i >= 0; i--) {
        const m = (svgs[i] as Element).querySelector(extraSelector);
        if (m) { el = m; break; }
      }
    } catch { /* noop */ }
  }
  if (!el) {
    try {
      const nm = typeof shape.getAttribute === 'function' ? shape.getAttribute('name') : undefined;
      if (nm) {
        const svgs = document.querySelectorAll('svg');
        for (let i = svgs.length - 1; i >= 0; i--) {
          const m = (svgs[i] as Element).querySelector(`g[name="${nm}"]`);
          if (m) { el = m; break; }
        }
      }
    } catch { /* noop */ }
  }

  const result = (el as Element) || null;
  _domCache.set(shape, result);
  return result;
}

function setStyle(shape: any, name: string, value: any, extraDomSelector?: string) {
  // 1) @antv/g 原生 API
  try {
    if (typeof shape.attr === 'function') shape.attr(name, value);
  } catch { /* noop */ }
  try {
    if (shape && shape.style) shape.style[name] = value;
  } catch { /* noop */ }

  // 2) 缓存 DOM 元素（仅首次查询）
  const el = _resolveDom(shape, extraDomSelector);
  if (el && el.style) {
    try {
      const cssName = name.replace(/([A-Z])/g, (m: string) => '-' + m.toLowerCase());
      if (typeof el.style.setProperty === 'function') {
        el.style.setProperty(cssName, String(value));
      } else {
        el.style[name] = value;
      }
      if (name === 'opacity' || name === 'visibility' || name === 'pointer-events') {
        try { el.setAttribute(cssName, String(value)); } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }
  if (name === 'visibility' && el) {
    try { el.setAttribute('visibility', String(value)); } catch { /* noop */ }
  }
  if (name === 'opacity' && el && !isNaN(Number(value))) {
    try { el.setAttribute('opacity', String(value)); } catch { /* noop */ }
  }
}
function getStyleNum(shape: any, name: string, fallback: number): number {
  try {
    const v = typeof shape.attr === 'function' ? shape.attr(name) : undefined;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  } catch { /* noop */ }
  try {
    const v = shape.style[name];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return n;
    }
  } catch { /* noop */ }
  try {
    const el = shape.getDomElement?.() ?? shape.nativeElement ?? (shape.node ?? null);
    if (el) {
      const s = getComputedStyle(el)[name] || el.getAttribute?.(name);
      if (s) {
        const n = parseFloat(s);
        if (!Number.isNaN(n)) return n;
      }
    }
  } catch { /* noop */ }
  return fallback;
}

export default function KnowledgeGraph({ onSelectNode, selectedId, highlightIds }: Props) {
  const { graph, masteredIds } = useKnowledge();
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef({ zoom: 1, tx: 0, ty: 0 });
  const searchRef = useRef('');
  const selectedIdRef = useRef<string | null | undefined>(selectedId);
  const highlightIdsRef = useRef<Set<string>>(highlightIds ?? new Set());
  const [searchText, setSearchText] = useState('');

  const data = useMemo(() => {
    if (!graph) return { nodes: [] as KnowledgeNode[], links: [] as KnowledgeRelation[] };
    return { nodes: graph.nodes, links: graph.relations };
  }, [graph]);

  useEffect(() => {
    searchRef.current = searchText;
  }, [searchText]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    highlightIdsRef.current = highlightIds ?? new Set();
  }, [highlightIds]);

  const dataHash = `${data.nodes.length}-${data.links.length}`;

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    // ===== 0. 等待容器拿到真实尺寸（避免 flex h-full 尚未布局完成的 0 尺寸）=====
    let cancelled = false;
    const waitStart = Date.now();
    const waitForSize = (): Promise<{ w: number; h: number }> =>
      new Promise((resolve) => {
        const tryIt = () => {
          if (cancelled || !containerRef.current) return resolve({ w: 800, h: 600 });
          const r = containerRef.current.getBoundingClientRect();
          if (r.width > 20 && r.height > 20) return resolve({ w: Math.max(320, r.width), h: Math.max(320, r.height) });
          if (Date.now() - waitStart > 2500) return resolve({ w: Math.max(320, r.width), h: Math.max(320, r.height) });
          requestAnimationFrame(tryIt);
        };
        tryIt();
      });
    let _destroy: (() => void) | null = null;
    waitForSize().then(({ w: width, h: height }) => {
      if (cancelled) return;
      _destroy = build({ width, height });
    });
    return () => {
      cancelled = true;
      if (_destroy) _destroy();
    };

    function build({ width, height }: { width: number; height: number }) {
      if (!containerRef.current || cancelled) return () => undefined;

    // ===== 1. 初始化渲染器 + Rough 插件 =====
    const renderer = new SVGRenderer();
    try {
      const plugin = new (RoughSVGPlugin as any)();
      if (typeof (renderer as any).registerPlugin === 'function') (renderer as any).registerPlugin(plugin);
    } catch {
      /* ignore */
    }

    const canvas = new Canvas({
      container: containerRef.current,
      width,
      height,
      renderer,
      background: 'transparent',
    });
    const root = canvas.document.documentElement;

    const resizeObs = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      canvas.resize(Math.max(400, r.width), Math.max(400, r.height));
      sim.force('center', forceCenter(r.width / 2, r.height / 2));
      sim.alpha(0.25).restart();
    });
    resizeObs.observe(containerRef.current);

    // ===== 2. 图层 =====
    const layerLinks = new Group({ name: 'links' });
    const layerNodes = new Group({ name: 'nodes' });
    root.appendChild(layerLinks);
    root.appendChild(layerNodes);

    // ===== 3. 力导向数据 =====
    const nodeMap = new Map<string, SimNode>();
    const simNodes: SimNode[] = data.nodes.map((n) => {
      const meta = CATEGORY_META[n.category];
      const radius = 14 + n.importance * 3.2;
      const sn: SimNode = {
        id: n.id,
        knowledge: n,
        color: masteredIds.has(n.id) ? '#8abf8a' : meta.color,
        radius,
        x: width / 2 + (Math.random() - 0.5) * width * 0.7,
        y: height / 2 + (Math.random() - 0.5) * height * 0.7,
      };
      nodeMap.set(n.id, sn);
      return sn;
    });
    const simLinks: SimLink[] = data.links.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      type: r.type,
    }));

    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l: any) => (l.type === 'contains' ? 150 : l.type === 'prerequisite' ? 200 : 260))
          .strength(0.5),
      )
      .force('charge', forceManyBody<SimNode>().strength(-480))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 38).strength(0.85))
      .alphaDecay(0.02)
      .velocityDecay(0.35);

    // ===== 4. 渲染连线 =====
    const linkShapes = new Map<string, { line: Line; arrow: Polygon }>();
    simLinks.forEach((sl) => {
      const meta = RELATION_META[sl.type];
      const stroke = meta.color;
      const lineWidth = sl.type === 'contains' ? 1.6 : sl.type === 'prerequisite' ? 2 : 1.2;
      const line = new Line({
        style: {
          x1: 0, y1: 0, x2: 0, y2: 0,
          stroke,
          lineWidth,
          lineDash: meta.dash ? [5, 3] : undefined,
          lineCap: 'round',
          opacity: 0.95,
          rough: {
            ...ROUGH_BASE,
            stroke,
            roughness: sl.type === 'related' ? 2.3 : 1.5,
            seed: 100 + parseInt(sl.id.replace(/\D/g, '')) || 100,
          },
        },
      });
      const arrow = new Polygon({
        style: {
          points: [[0, 0], [0, 0], [0, 0]],
          fill: stroke,
          stroke,
          lineWidth: 1,
          opacity: 0.95,
          rough: {
            ...ROUGH_BASE,
            fill: stroke,
            stroke,
            roughness: 0.9,
            seed: 500 + parseInt(sl.id.replace(/\D/g, '')) || 500,
          },
        },
      });
      layerLinks.appendChild(line);
      layerLinks.appendChild(arrow);
      linkShapes.set(sl.id, { line, arrow });
    });

    // ===== 5. 渲染节点 =====
    type NodeObj = {
      group: Group;
      circle: Circle;
      halo: Circle;
      labelGroup: Group;
      origRadius: number;
      badge?: Circle;
    };
    const nodeShapes = new Map<string, NodeObj>();

    simNodes.forEach((sn) => {
      const origR = sn.radius;
      const baseColor = sn.color;
      const group = new Group({ style: { cursor: 'pointer', opacity: 1 }, name: sn.id });

      // 命中区域（透明圆，解决 rough fill=none 导致内部不可点击）
      const hitArea = new Circle({
        style: {
          cx: 0, cy: 0, r: origR,
          fill: 'transparent',
          pointerEvents: 'all',
        },
      });
      group.appendChild(hitArea);

      // 虚线 halo（选中）
      const halo = new Circle({
        style: {
          cx: 0, cy: 0, r: origR + 6,
          fill: 'transparent',
          stroke: '#d18040',
          lineWidth: 1.5,
          lineDash: [4, 3],
          visibility: 'hidden',
          pointerEvents: 'none',
        },
      });
      group.appendChild(halo);

      // 主圆（rough 风格）
      const circle = new Circle({
        style: {
          cx: 0, cy: 0, r: origR,
          fill: baseColor,
          stroke: '#3b332b',
          lineWidth: 1.8,
          rough: {
            ...ROUGH_BASE,
            ...ROUGH_FILL,
            fill: baseColor,
            stroke: '#3b332b',
            fillOpacity: 0.92,
            seed: 1000 + sn.knowledge.importance * 19 + parseInt(sn.id.replace(/\D/g, '')) || 1000,
          },
        },
      });
      group.appendChild(circle);

      // 标签
      const name = sn.knowledge.name;
      const fontSize = Math.max(10, Math.min(12, 9 + sn.knowledge.importance * 0.5));
      const tw = Math.max(52, name.length * (fontSize * 0.85) + 12);
      const th = 22;
      const labelGroup = new Group();
      const labelBg = new Rect({
        style: {
          x: -tw / 2, y: origR + 6,
          width: tw, height: th,
          fill: '#fdfaf3',
          stroke: 'rgba(59,51,43,0.4)',
          lineWidth: 1,
          radius: 5,
          rough: {
            roughness: 1, bowing: 1,
            fill: '#fdfaf3', stroke: 'rgba(59,51,43,0.3)',
            seed: 2000 + parseInt(sn.id.replace(/\D/g, '')) || 2000,
          },
        },
      });
      const labelText = new Text({
        style: {
          x: 0, y: origR + 6 + th / 2,
          text: name,
          fontSize,
          fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
          fontWeight: 600,
          fill: '#3b332b',
          textAlign: 'center',
          textBaseline: 'middle',
          pointerEvents: 'none',
        },
      });
      labelGroup.appendChild(labelBg);
      labelGroup.appendChild(labelText);
      group.appendChild(labelGroup);

      // 已掌握徽章
      let badge: Circle | undefined;
      if (masteredIds.has(sn.id)) {
        badge = new Circle({
          style: {
            cx: origR - 2, cy: -origR + 2, r: 6.5,
            fill: '#5a9b5a',
            stroke: '#fff',
            lineWidth: 1.6,
          },
        });
        group.appendChild(badge);
        const check = new Text({
          style: {
            x: origR - 2, y: -origR + 2,
            text: '✓',
            fontSize: 10, fontWeight: 700,
            fill: '#fff',
            textAlign: 'center',
            textBaseline: 'middle',
            pointerEvents: 'none',
          },
        });
        group.appendChild(check);
      }

      layerNodes.appendChild(group);
      nodeShapes.set(sn.id, { group, circle, halo, labelGroup, origRadius: origR, badge });

      // ===== 节点交互：拖拽 + 点击合一，用 window 级监听 =====
      group.addEventListener('pointerdown', (e: any) => {
        try { e.stopPropagation?.(); } catch { /* noop */ }

        // 计算指针在画布坐标系中的位置
        const rect = containerRef.current!.getBoundingClientRect();
        const cx0 = e.clientX - rect.left;
        const cy0 = e.clientY - rect.top;
        const cam = canvas.getCamera();
        let canvasPt: [number, number];
        try {
          const cp = cam.viewportToCanvas([cx0, cy0]);
          canvasPt = [cp[0], cp[1]];
        } catch {
          canvasPt = [sn.x ?? 0, sn.y ?? 0];
        }

        const offX = (sn.x ?? 0) - canvasPt[0];
        const offY = (sn.y ?? 0) - canvasPt[1];
        let moved = false;

        sim.alphaTarget(0.3).restart();

        const onMove = (ev: PointerEvent) => {
          const cx = ev.clientX - rect.left;
          const cy = ev.clientY - rect.top;
          let cp2: [number, number];
          try {
            const r2 = cam.viewportToCanvas([cx, cy]);
            cp2 = [r2[0], r2[1]];
          } catch { return; }
          // 拖拽阈值：移动 > 3px 才算拖拽
          if (!moved && (Math.abs(cp2[0] - canvasPt[0]) > 3 || Math.abs(cp2[1] - canvasPt[1]) > 3)) {
            moved = true;
          }
          if (moved) {
            sn.fx = cp2[0] + offX;
            sn.fy = cp2[1] + offY;
          }
        };

        const onUp = () => {
          sim.alphaTarget(0);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          // 未拖拽 → 当作点击
          if (!moved) {
            onSelectNode(sn.knowledge);
          }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });

      group.addEventListener('contextmenu', (e: any) => {
        try { e.preventDefault?.(); } catch { /* noop */ }
        sn.fx = null;
        sn.fy = null;
        sim.alpha(0.4).restart();
      });
    });

    // ===== 6. 空白画布平移（window 级监听，不与节点拖拽冲突）=====
    let panStart: null | { sx: number; sy: number; tx: number; ty: number } = null;
    const rootPointerDown = (e: any) => {
      const tgt = e.target as any;
      // 仅在空白区域触发（非节点 group 内）
      if (tgt !== root && tgt !== layerLinks && tgt !== layerNodes) return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      panStart = { sx, sy, tx: cameraRef.current.tx, ty: cameraRef.current.ty };

      const onPanMove = (ev: PointerEvent) => {
        if (!panStart) return;
        const cx = ev.clientX - rect.left;
        const cy = ev.clientY - rect.top;
        const cam = canvas.getCamera();
        const nx = panStart.tx + (cx - panStart.sx) / cameraRef.current.zoom;
        const ny = panStart.ty + (cy - panStart.sy) / cameraRef.current.zoom;
        try { cam.pan(nx, ny); } catch { /* noop */ }
        cameraRef.current.tx = nx;
        cameraRef.current.ty = ny;
      };
      const onPanUp = () => {
        panStart = null;
        window.removeEventListener('pointermove', onPanMove);
        window.removeEventListener('pointerup', onPanUp);
      };
      window.addEventListener('pointermove', onPanMove);
      window.addEventListener('pointerup', onPanUp);
    };
    root.addEventListener('pointerdown', rootPointerDown);

    // ===== 7. 滚轮缩放 =====
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;
      const cam = canvas.getCamera();
      const r2 = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - r2.left;
      const my = e.clientY - r2.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newZoom = Math.min(4, Math.max(0.25, cameraRef.current.zoom * factor));
      try {
        const before = cam.viewportToCanvas([mx, my]);
        cam.setZoom(newZoom);
        const after = cam.viewportToCanvas([mx, my]);
        const ntx = cameraRef.current.tx + (before[0] - after[0]);
        const nty = cameraRef.current.ty + (before[1] - after[1]);
        cam.pan(ntx, nty);
        cameraRef.current = { zoom: newZoom, tx: ntx, ty: nty };
      } catch {
        cam.setZoom(newZoom);
        cameraRef.current.zoom = newZoom;
      }
    };
    containerRef.current.addEventListener('wheel', onWheel, { passive: false });

    // ===== 8. tick 同步位置 =====
    sim.on('tick', () => {
      // 节点位置
      simNodes.forEach((sn) => {
        const obj = nodeShapes.get(sn.id);
        if (!obj) return;
        obj.group.setPosition(sn.x ?? 0, sn.y ?? 0);
      });
      // 连线 & 箭头
      simLinks.forEach((sl) => {
        const s = resolveNode(sl.source);
        const t = resolveNode(sl.target);
        const obj = linkShapes.get(sl.id);
        if (!obj || !s || !t || s.x == null || t.x == null) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const sx = s.x + ux * s.radius;
        const sy = s.y + uy * s.radius;
        const ex = t.x - ux * (t.radius + 8);
        const ey = t.y - uy * (t.radius + 8);
        setStyle(obj.line, 'x1', sx);
        setStyle(obj.line, 'y1', sy);
        setStyle(obj.line, 'x2', ex);
        setStyle(obj.line, 'y2', ey);
        const size = 8;
        const a = Math.atan2(ey - sy, ex - sx);
        const p1: [number, number] = [ex, ey];
        const p2: [number, number] = [ex - size * Math.cos(a - Math.PI / 7), ey - size * Math.sin(a - Math.PI / 7)];
        const p3: [number, number] = [ex - size * Math.cos(a + Math.PI / 7), ey - size * Math.sin(a + Math.PI / 7)];
        setStyle(obj.arrow, 'points', [p1, p2, p3]);
      });
    });

    function resolveNode(v: string | SimNode): SimNode | undefined {
      if (typeof v === 'string') return nodeMap.get(v);
      return v;
    }

    // ===== 9. 视觉过滤器 =====
    const api = {
      applyVisual() {
        const kw = (searchRef.current || '').trim().toLowerCase();
        const matchSet = new Set<string>();
        if (kw) {
          data.nodes.forEach((n) => {
            if (n.name.toLowerCase().includes(kw) || n.description.toLowerCase().includes(kw)) matchSet.add(n.id);
          });
        }
        const hl = highlightIdsRef.current ?? new Set<string>();
        const currentSelectedId = selectedIdRef.current;

        // 选中节点时：计算其邻居 + 关联连线
        let neighborIds = new Set<string>();
        let neighborLinkIds = new Set<string>();
        if (currentSelectedId) {
          neighborIds.add(currentSelectedId);
          simLinks.forEach((sl) => {
            const sId = typeof sl.source === 'string' ? sl.source : sl.source?.id;
            const tId = typeof sl.target === 'string' ? sl.target : sl.target?.id;
            if (sId === currentSelectedId && tId) { neighborIds.add(tId); neighborLinkIds.add(sl.id); }
            if (tId === currentSelectedId && sId) { neighborIds.add(sId); neighborLinkIds.add(sl.id); }
          });
        }

        simNodes.forEach((sn) => {
          const obj = nodeShapes.get(sn.id);
          if (!obj) return;
          const selected = sn.id === currentSelectedId;
          const isNeighbor = neighborIds.has(sn.id);
          let dim = false;
          if (kw && !matchSet.has(sn.id) && !selected) dim = true;
          if (hl.size > 0 && !hl.has(sn.id) && !selected) dim = true;
          // 选中节点时：非邻居节点变暗
          if (currentSelectedId && !isNeighbor) dim = true;
          setStyle(obj.group, 'opacity', dim ? 0.15 : 1, `g[name="${sn.id}"]`);
          setStyle(obj.halo, 'visibility', selected ? 'visible' : 'hidden', `g[name="${sn.id}"] .halo`);
          // 选中节点放大
          const targetR = selected ? obj.origRadius * 1.15 : obj.origRadius;
          setStyle(obj.circle, 'r', targetR);
        });
        // 连线：选中节点的关联连线高亮加粗，其余变暗
        linkShapes.forEach((lo, id) => {
          const sl = simLinks.find((x) => x.id === id);
          if (!sl) return;
          const s = resolveNode(sl.source);
          const t = resolveNode(sl.target);
          if (!s || !t) return;
          let o = 0.9;
          let lw = 1.8;
          if (currentSelectedId) {
            if (neighborLinkIds.has(id)) { o = 1; lw = 3.2; }
            else { o = 0.08; lw = 1.2; }
          } else {
            const aObj = nodeShapes.get(s.id);
            const bObj = nodeShapes.get(t.id);
            const oa = aObj ? getStyleNum(aObj.group, 'opacity', 1) : 1;
            const ob = bObj ? getStyleNum(bObj.group, 'opacity', 1) : 1;
            o = Math.min(oa, ob) < 1 ? Math.max(Math.min(oa, ob), 0.12) : 0.9;
          }
          setStyle(lo.line, 'opacity', o);
          setStyle(lo.line, 'lineWidth', lw);
          setStyle(lo.arrow, 'opacity', o);
        });
      },
      focusSelected() {
        const selId = selectedIdRef.current;
        if (!selId || !containerRef.current) return;
        const sn = nodeMap.get(selId);
        if (!sn || sn.x == null) return;
        try {
          const cam = canvas.getCamera();
          const r = containerRef.current.getBoundingClientRect();
          // 居中选中节点，缩放适中以看到邻居
          const targetZoom = 1.35;
          cam.setZoom(targetZoom);
          cameraRef.current.zoom = targetZoom;
          const tx = r.width / 2 - sn.x * targetZoom;
          const ty = r.height / 2 - sn.y * targetZoom;
          cam.pan(tx, ty);
          cameraRef.current.tx = tx;
          cameraRef.current.ty = ty;
        } catch {
          /* noop */
        }
      },
    };
    (window as any).__kg = api;

    // 首次 fit
    const fitTimeout = setTimeout(() => {
      api.applyVisual();
      if (!containerRef.current || simNodes.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      simNodes.forEach((sn) => {
        const x = sn.x ?? 0;
        const y = sn.y ?? 0;
        minX = Math.min(minX, x - sn.radius);
        minY = Math.min(minY, y - sn.radius - 36);
        maxX = Math.max(maxX, x + sn.radius);
        maxY = Math.max(maxY, y + sn.radius);
      });
      const r = containerRef.current.getBoundingClientRect();
      const pad = 70;
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      const z = Math.min((r.width - pad * 2) / bw, (r.height - pad * 2) / bh, 1.4);
      try {
        const cam = canvas.getCamera();
        cam.setZoom(z);
        cameraRef.current.zoom = z;
        const tx = r.width / 2 - (minX + maxX) / 2;
        const ty = r.height / 2 - (minY + maxY) / 2;
        cam.pan(tx, ty);
        cameraRef.current.tx = tx;
        cameraRef.current.ty = ty;
      } catch {
        /* noop */
      }
    }, 1000);

    return function cleanup() {
      clearTimeout(fitTimeout);
      resizeObs.disconnect();
      if (containerRef.current) containerRef.current.removeEventListener('wheel', onWheel as EventListener);
      sim.stop();
      try { canvas.destroy(); } catch { /* noop */ }
      delete (window as any).__kg;
    };
    } // close build()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataHash, graph]);

  // 外部触发
  useEffect(() => {
    (window as any).__kg?.applyVisual();
  }, [selectedId, highlightIds, masteredIds.size, searchText, graph]);
  useEffect(() => {
    (window as any).__kg?.focusSelected();
  }, [selectedId]);

  if (!graph) return null;

  const matchedCount = useMemo(() => {
    const s = searchText.trim();
    if (!s) return 0;
    return data.nodes.filter((n) => n.name.includes(s) || n.description.includes(s)).length;
  }, [searchText, data.nodes]);

  return (
    <div className="relative h-full w-full min-h-[380px]">
      {/* 搜索栏 */}
      <div className="absolute top-3 left-3 z-10 w-72 max-w-[45%]">
        <div className="sketch-card p-2 flex items-center gap-2 shadow-sketch-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-ink-light shrink-0 ml-1">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索知识点名称..."
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-ink-soft"
          />
          {searchText && (
            <span className="text-[11px] sketch-tag bg-sketch-yellow/30 text-sketch-orangeDeep border-sketch-orange/30">
              {matchedCount} 个结果
            </span>
          )}
        </div>
      </div>

      {/* @antv/g 容器 */}
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{
          minHeight: '480px',
          minWidth: '100%',
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(232,207,106,0.06) 0%, transparent 40%),' +
            'radial-gradient(circle at 70% 80%, rgba(107,164,201,0.08) 0%, transparent 45%)',
        }}
      />
    </div>
  );
}
