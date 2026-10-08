import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import type { KnowledgeNode, KnowledgeRelation } from '../../types';
import { CATEGORY_META, RELATION_META } from '../../mock/sampleKnowledgeGraph';
import { useKnowledge } from '../../context/KnowledgeContext';

interface Props {
  onSelectNode: (node: KnowledgeNode) => void;
  selectedId?: string | null;
  highlightIds?: Set<string>;
}

interface ViewNode extends KnowledgeNode {
  depth: number;
  isRoot?: boolean;
}

interface ViewLink extends KnowledgeRelation {
  relation: KnowledgeRelation;
}

type GraphApi = ForceGraphMethods<any, any>;

function getNodeId(node: string | number | { id?: string | number } | undefined): string {
  if (typeof node === 'object' && node !== null) return String(node.id ?? '');
  return String(node ?? '');
}

export default function KnowledgeGraph({ onSelectNode, selectedId, highlightIds }: Props) {
  const { graph, masteredIds } = useKnowledge();
  const graphRef = useRef<GraphApi | undefined>(undefined);
  const rafRef = useRef<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 持续触发重绘，让节点浮动动效生效（不修改节点坐标，只在绘制时偏移）
  useEffect(() => {
    const tick = () => {
      graphRef.current?.refresh();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const rootId = useMemo(() => {
    if (!graph?.nodes.length) return '';
    const containsRels = graph.relations.filter((r) => r.type === 'contains');
    const incoming = new Set(containsRels.map((r) => r.target));
    const root = graph.nodes.find((n) => !incoming.has(n.id) && containsRels.some((r) => r.source === n.id));
    return root?.id ?? graph.nodes[0].id;
  }, [graph]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!graph) return map;
    const contains = graph.relations.filter((r) => r.type === 'contains');
    contains.forEach((r) => {
      if (r.source === r.target) return;
      const children = map.get(r.source) ?? [];
      if (!children.includes(r.target)) children.push(r.target);
      map.set(r.source, children);
    });
    return map;
  }, [graph]);

  const matchedIds = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query || !graph) return new Set<string>();
    return new Set(
      graph.nodes
        .filter((node) => `${node.name} ${node.description} ${node.definition}`.toLowerCase().includes(query))
        .map((node) => node.id),
    );
  }, [graph, searchText]);

  const pathIds = useMemo(() => {
    const result = new Set<string>();
    if (!graph || !selectedId) return result;
    result.add(selectedId);
    let frontier = [selectedId];
    while (frontier.length) {
      const next: string[] = [];
      graph.relations.forEach((relation) => {
        if ((relation.type === 'prerequisite' || relation.type === 'contains') && frontier.includes(relation.target) && !result.has(relation.source)) {
          result.add(relation.source);
          next.push(relation.source);
        }
      });
      frontier = next;
    }
    return result;
  }, [graph, selectedId]);

  // hover 节点的所有邻居（用于高亮关联连线）
  const hoveredNeighborIds = useMemo(() => {
    const ids = new Set<string>();
    if (!graph || !hoveredId) return ids;
    graph.relations.forEach((r) => {
      if (r.source === hoveredId) ids.add(r.target);
      if (r.target === hoveredId) ids.add(r.source);
    });
    return ids;
  }, [graph, hoveredId]);

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    if (!graph) return ids;
    graph.nodes.forEach((n) => ids.add(n.id));
    return ids;
  }, [graph]);

  const viewData = useMemo(() => {
    if (!graph) return { nodes: [] as ViewNode[], links: [] as ViewLink[] };
    const nodes = graph.nodes
      .filter((node) => visibleIds.has(node.id))
      .map((node) => ({ ...node, depth: 0, isRoot: node.id === rootId }));
    const nodeSet = new Set(nodes.map((node) => node.id));
    const links = graph.relations
      .filter((relation) => nodeSet.has(relation.source) && nodeSet.has(relation.target))
      .map((relation) => ({ ...relation, relation }));
    return { nodes, links };
  }, [graph, rootId, visibleIds]);

  const resetView = useCallback(() => {
    const inst = graphRef.current;
    if (!inst) return;
    inst.zoom(1.1, 400);
    inst.centerAt(0, 0, 400);
  }, []);

  const zoom = useCallback((factor: number) => {
    const inst = graphRef.current;
    if (!inst) return;
    const current = inst.zoom() ?? 1;
    inst.zoom(current * factor, 200);
  }, []);

  // 节点是否被压暗（非匹配路径/搜索/分类）
  const isNodeDimmed = useCallback((node: ViewNode) => {
    const categoryMatch = !highlightIds?.size || highlightIds.has(node.id);
    const searchMatch = !matchedIds.size || matchedIds.has(node.id);
    const pathMatch = !selectedId || selectedId === rootId || !pathIds.size || pathIds.has(node.id);
    return !(categoryMatch && searchMatch && pathMatch);
  }, [highlightIds, matchedIds, pathIds, rootId, selectedId]);

  if (!graph) return null;

  // 2D Canvas 节点绘制
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const viewNode = node as ViewNode;
    const selected = selectedId === viewNode.id;
    const hovered = hoveredId === viewNode.id;
    const dimmed = isNodeDimmed(viewNode);
    const mastered = masteredIds.has(viewNode.id);
    const isRoot = viewNode.isRoot;

    const meta = CATEGORY_META[viewNode.category] ?? CATEGORY_META.concept;
    const baseRadius = isRoot ? 16 : 8 + (viewNode.importance ?? 3) * 1.2;
    const radius = (selected || hovered) ? baseRadius * 1.4 : baseRadius;

    // 浮动动效：基于节点 id 哈希生成不同相位，让节点不同步地轻微浮动
    let hash = 0;
    for (let i = 0; i < viewNode.id.length; i++) {
      hash = ((hash << 5) - hash) + viewNode.id.charCodeAt(i);
      hash |= 0;
    }
    const phase = hash * 0.013;
    const t = performance.now() * 0.001;
    const amplitude = selected || hovered ? 3 : 1.8;
    const floatX = Math.sin(t * 0.9 + phase) * amplitude;
    const floatY = Math.cos(t * 0.7 + phase * 1.3) * amplitude;
    const x = node.x + floatX;
    const y = node.y + floatY;

    ctx.save();
    if (dimmed) ctx.globalAlpha = 0.25;

    // 选中/悬停光晕（带呼吸效果）
    if (selected || hovered) {
      const pulse = 1 + Math.sin(t * 3) * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, (radius + 5) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = selected ? 'rgba(109, 86, 166, 0.28)' : 'rgba(109, 86, 166, 0.14)';
      ctx.fill();
    }

    // 节点主体（带轻微缩放呼吸）
    const breathScale = 1 + Math.sin(t * 1.2 + phase) * 0.04;
    const r = radius * breathScale;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = meta.color;
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? '#6d56a6' : mastered ? '#5a9b5a' : 'rgba(255,255,255,0.85)';
    ctx.stroke();

    // 已掌握对勾
    if (mastered) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(9, r * 0.85)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x, y + 0.5);
    }

    // 所有节点都显示文字标签
    const fontSize = Math.max(9, Math.min(14, 12 / globalScale));
    ctx.font = `600 ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelY = y + r + 3;
    // 白色描边，确保在任何背景上都清晰可读
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(253, 250, 243, 0.92)';
    ctx.strokeText(viewNode.name, x, labelY);
    ctx.fillStyle = selected ? '#6d56a6' : hovered ? '#4a3b73' : '#2a2520';
    ctx.fillText(viewNode.name, x, labelY);

    ctx.restore();
  }, [selectedId, hoveredId, isNodeDimmed, masteredIds]);

  // 节点可点击区域（与绘制时的浮动偏移保持一致）
  const paintNodeArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const viewNode = node as ViewNode;
    const isRoot = viewNode.isRoot;
    const baseRadius = isRoot ? 16 : 8 + (viewNode.importance ?? 3) * 1.2;
    const radius = baseRadius * 1.4 + 4; // 加上悬停放大和边距
    // 同步浮动偏移
    let hash = 0;
    for (let i = 0; i < viewNode.id.length; i++) {
      hash = ((hash << 5) - hash) + viewNode.id.charCodeAt(i);
      hash |= 0;
    }
    const phase = hash * 0.013;
    const t = performance.now() * 0.001;
    const floatX = Math.sin(t * 0.9 + phase) * 3;
    const floatY = Math.cos(t * 0.7 + phase * 1.3) * 3;
    ctx.beginPath();
    ctx.arc(node.x + floatX, node.y + floatY, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  return (
    <div className="knowledge-graph-stage relative h-full w-full min-h-[480px] overflow-hidden rounded-[inherit] bg-[#eef1f7]">
      {/* 搜索框 */}
      <div className="absolute top-3 left-3 z-10 w-[min(360px,48%)]">
        <div className="sketch-card p-2 flex items-center gap-2 shadow-sketch-lg bg-paper-50/90 backdrop-blur-sm">
          <Search size={15} className="text-ink-light shrink-0 ml-1" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="搜索知识点，自动高亮匹配"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-ink-soft"
          />
          {searchText && <span className="text-[11px] sketch-tag bg-sketch-yellow/30 text-sketch-orangeDeep border-sketch-orange/30 shrink-0">{matchedIds.size} 个结果</span>}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button onClick={() => zoom(0.8)} className="w-8 h-8 rounded-full bg-paper-50/90 border-2 border-ink/15 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="缩小视图" aria-label="缩小视图"><ZoomOut size={15} /></button>
        <button onClick={() => zoom(1.25)} className="w-8 h-8 rounded-full bg-paper-50/90 border-2 border-ink/15 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="放大视图" aria-label="放大视图"><ZoomIn size={15} /></button>
        <button onClick={resetView} className="w-8 h-8 rounded-full bg-paper-50/90 border-2 border-ink/15 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="重置视角" aria-label="重置视角"><RotateCcw size={15} /></button>
      </div>

      {/* 提示 */}
      <div className="graph-hint absolute bottom-3 left-3 z-10 sketch-card px-3 py-2 bg-paper-50/85 backdrop-blur-sm text-[11px] text-ink-light leading-relaxed">
        <span className="font-bold text-ink">左键拖动平移</span> · 滚轮缩放 · 拖拽节点调整位置 · 点击查看详情
        {selectedId && <span className="ml-2 text-sketch-orangeDeep">已高亮前置路径</span>}
      </div>

      {/* 图例 */}
      <div className="absolute bottom-3 right-3 z-10 sketch-card px-3 py-2 bg-paper-50/85 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[11px] text-ink-light">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#3f7ba0]" />包含</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#d18040]" />前置</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 border-t border-dashed border-[#a89880]" />相关</span>
        </div>
      </div>

      <ForceGraph2D
        ref={graphRef as any}
        graphData={viewData as any}
        backgroundColor="#eef1f7"
        showNavInfo={false}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        nodeRelSize={1}
        nodeVal={1}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={paintNodeArea}
        nodeLabel={(node: any) => {
          const n = node as ViewNode;
          return `${n.name}<br/><small>${CATEGORY_META[n.category]?.label ?? '知识点'}</small>`;
        }}
        linkLabel={(link: any) => `${RELATION_META[link.type]?.label ?? link.label ?? '关系'}`}
        linkColor={(link: any) => {
          const source = getNodeId(link.source);
          const target = getNodeId(link.target);
          const typeColor = RELATION_META[link.type]?.color ?? '#a89880';
          // hover 时：关联连线高亮，其余变淡
          if (hoveredId) {
            const isConnected = source === hoveredId || target === hoveredId;
            return isConnected ? typeColor : 'rgba(160,160,160,0.15)';
          }
          // 选中时：路径内连线高亮
          const active = !selectedId || (pathIds.has(source) && pathIds.has(target));
          const categoryActive = !highlightIds?.size || highlightIds.has(source) || highlightIds.has(target);
          return active && categoryActive ? typeColor : 'rgba(160,160,160,0.15)';
        }}
        linkWidth={(link: any) => {
          const source = getNodeId(link.source);
          const target = getNodeId(link.target);
          if (hoveredId && (source === hoveredId || target === hoveredId)) return 3;
          if (selectedId && pathIds.has(source) && pathIds.has(target)) return 2.5;
          return 1.2;
        }}
        linkOpacity={0.85}
        linkDirectionalArrowLength={7}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalArrowColor={(link: any) => {
          const source = getNodeId(link.source);
          const target = getNodeId(link.target);
          const dimmed = (hoveredId && source !== hoveredId && target !== hoveredId) ||
            (selectedId && !(pathIds.has(source) && pathIds.has(target)));
          return dimmed ? 'rgba(160,160,160,0.2)' : (RELATION_META[link.type]?.color ?? '#a89880');
        }}
        linkDash={(link: any) => RELATION_META[link.type]?.dash === true}
        warmupTicks={30}
        cooldownTicks={80}
        d3VelocityDecay={0.4}
        d3Force={(d3: any) => {
          // 增大节点斥力和连线距离，避免文字标签重叠
          const charge = d3.force('charge');
          if (charge) charge.strength(-180);
          const link = d3.force('link');
          if (link) link.distance(70).strength(0.6);
        }}
        onNodeClick={(node: any) => {
          onSelectNode(node as ViewNode);
        }}
        onNodeHover={(node: any) => {
          setHoveredId(node ? getNodeId(node) : null);
        }}
      />
    </div>
  );
}
