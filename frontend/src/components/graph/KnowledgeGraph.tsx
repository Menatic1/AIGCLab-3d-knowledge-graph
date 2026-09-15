import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import { Move3d, RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import type { KnowledgeNode, KnowledgeRelation } from '../../types';
import { CATEGORY_META, MULTIMODAL_META, RELATION_META } from '../../mock/sampleKnowledgeGraph';
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

const DEFAULT_CAMERA = { x: 0, y: 0, z: 520 };

function getNodeId(node: string | number | { id?: string | number } | undefined): string {
  if (typeof node === 'object' && node !== null) return String(node.id ?? '');
  return String(node ?? '');
}

function textSprite(text: string, color: string, opacity: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Sprite();

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '600 34px "Microsoft YaHei", "PingFang SC", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.globalAlpha = opacity;
  context.shadowColor = 'rgba(253, 250, 243, 0.95)';
  context.shadowBlur = 8;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity,
  }));
  sprite.scale.set(Math.max(20, Math.min(50, text.length * 4.2)), 7, 1);
  return sprite;
}

function makeNodeObject(node: ViewNode, selected: boolean, highlighted: boolean, dimmed: boolean, mastered: boolean) {
  const meta = CATEGORY_META[node.category] ?? CATEGORY_META.concept;
  const mediaMeta = node.multimodal ? MULTIMODAL_META[node.multimodal.type] : null;
  const radius = node.isRoot ? 56 : Math.max(8, 9 + node.importance * 1.25 - node.depth * 0.45);
  const opacity = dimmed ? 0.18 : 1;
  const group = new THREE.Group();
  group.userData.nodeId = node.id;

  // Basic 材质不依赖场景灯光，浅色舞台中节点始终保持清晰可辨。
  const material = new THREE.MeshBasicMaterial({
    color: mastered ? '#5a9b5a' : meta.color,
    transparent: true,
    opacity,
  });

  if (node.isRoot) {
    const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, 6, 32), material);
    core.rotation.x = Math.PI / 2;
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.54, radius * 0.62, 3, 32),
      new THREE.MeshBasicMaterial({ color: '#f5e7bd', transparent: true, opacity }),
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.z = radius * 0.13;
    group.add(cap);

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 7, 1.05, 8, 48),
      new THREE.MeshBasicMaterial({ color: selected ? '#d18040' : '#3f7ba0', transparent: true, opacity: dimmed ? 0.18 : 0.82 }),
    );
    orbit.rotation.x = Math.PI / 2;
    group.add(orbit);

    const orbitCross = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 11, 0.55, 8, 48),
      new THREE.MeshBasicMaterial({ color: '#d08b31', transparent: true, opacity: dimmed ? 0.12 : 0.58 }),
    );
    orbitCross.rotation.x = Math.PI / 3.1;
    orbitCross.rotation.y = Math.PI / 5;
    group.add(orbitCross);
  } else if (mediaMeta) {
    // 多模态资源使用横向资料卡形态，与普通知识点的六边形区分开来。
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 2.45, radius * 1.48, Math.max(4, radius * 0.34)),
      material,
    );
    card.castShadow = true;
    card.receiveShadow = true;
    group.add(card);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2.06, radius * 1.1),
      new THREE.MeshBasicMaterial({ color: '#f8f3e5', transparent: true, opacity: dimmed ? 0.2 : 0.96 }),
    );
    screen.position.z = Math.max(2.2, radius * 0.2);
    group.add(screen);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(radius * 2.45, radius * 1.48, Math.max(4, radius * 0.34))),
      new THREE.LineBasicMaterial({ color: selected ? '#d18040' : '#3b332b', transparent: true, opacity: dimmed ? 0.12 : 0.52 }),
    );
    group.add(frame);

    const marker = textSprite(mediaMeta.marker, mediaMeta.color, opacity);
    marker.scale.set(10, 10, 1);
    marker.position.set(0, 0, Math.max(2.5, radius * 0.22) + 0.2);
    group.add(marker);
  } else {
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, radius * 0.78, 6), material);
    panel.rotation.x = Math.PI / 2;
    panel.rotation.z = Math.PI / 6;
    panel.castShadow = true;
    panel.receiveShadow = true;
    group.add(panel);

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, 0.8, 6),
      new THREE.MeshBasicMaterial({ color: '#f7f1df', transparent: true, opacity: dimmed ? 0.2 : 0.92 }),
    );
    plate.rotation.x = Math.PI / 2;
    plate.rotation.z = Math.PI / 6;
    plate.position.z = radius * 0.42;
    group.add(plate);

    const edgeMaterial = new THREE.LineBasicMaterial({ color: selected ? '#d18040' : '#3b332b', transparent: true, opacity: dimmed ? 0.12 : 0.42 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), edgeMaterial);
    edges.rotation.copy(panel.rotation);
    edges.position.copy(panel.position);
    edges.renderOrder = 2;
    group.add(edges);
  }

  if (selected || highlighted) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius + (node.isRoot ? 15 : 5), selected ? 1.15 : 0.72, 8, 32),
      new THREE.MeshBasicMaterial({ color: selected ? '#d18040' : '#ffffff', transparent: true, opacity: dimmed ? 0.2 : 0.85 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  const showLabel = node.isRoot || Boolean(mediaMeta) || selected || highlighted || node.depth <= 1;
  if (showLabel) {
    const label = textSprite(node.name, '#3b332b', opacity);
    // 标签贴在六边形面板正面中央，不再漂浮在节点上方。
    label.position.set(0, 0, node.isRoot ? radius * 0.22 + 3 : radius * 0.52 + 2);
    group.add(label);
  }

  return group;
}

export default function KnowledgeGraph({ onSelectNode, selectedId, highlightIds }: Props) {
  const { graph, masteredIds } = useKnowledge();
  const graphRef = useRef<GraphApi | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [panMode, setPanMode] = useState(false);

  const rootId = useMemo(() => {
    if (!graph?.nodes.length) return '';
    const incoming = new Set(graph.relations.map((relation) => relation.target));
    return graph.nodes.find((node) => !incoming.has(node.id))?.id ?? graph.nodes[0].id;
  }, [graph]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!graph) return map;
    const contains = graph.relations.filter((relation) => relation.type === 'contains');
    const hierarchy = contains.length ? contains : graph.relations;
    hierarchy.forEach((relation) => {
      const children = map.get(relation.source) ?? [];
      if (!children.includes(relation.target) && relation.source !== relation.target) children.push(relation.target);
      map.set(relation.source, children);
    });
    return map;
  }, [graph]);

  useEffect(() => {
    setExpandedIds(new Set());
  }, [rootId, graph?.nodes.length, graph?.relations.length]);

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

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    if (!graph || !rootId) return ids;
    const parentByChild = new Map<string, string>();
    childrenMap.forEach((children, parent) => children.forEach((child) => {
      if (!parentByChild.has(child)) parentByChild.set(child, parent);
    }));

    const visit = (id: string) => {
      ids.add(id);
      if (!expandedIds.has(id)) return;
      (childrenMap.get(id) ?? []).forEach(visit);
    };
    visit(rootId);

    // 搜索结果自动带出从中心到匹配节点的路径。
    matchedIds.forEach((id) => {
      let current: string | undefined = id;
      while (current) {
        ids.add(current);
        current = parentByChild.get(current);
      }
    });
    return ids;
  }, [graph, rootId, childrenMap, expandedIds, matchedIds]);

  const viewData = useMemo(() => {
    if (!graph || !rootId) return { nodes: [] as ViewNode[], links: [] as ViewLink[] };
    const depthMap = new Map<string, number>([[rootId, 0]]);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      const depth = depthMap.get(current) ?? 0;
      (childrenMap.get(current) ?? []).forEach((child) => {
        if (!depthMap.has(child)) {
          depthMap.set(child, depth + 1);
          queue.push(child);
        }
      });
    }

    const parentByChild = new Map<string, string>();
    childrenMap.forEach((children, parent) => children.forEach((child) => {
      if (!parentByChild.has(child)) parentByChild.set(child, parent);
    }));
    const siblingIndex = new Map<string, number>();
    childrenMap.forEach((children) => children.forEach((child, index) => siblingIndex.set(child, index)));

    const nodes = graph.nodes.filter((node) => visibleIds.has(node.id)).map((node) => {
      const depth = depthMap.get(node.id) ?? 1;
      const siblings = parentByChild.get(node.id) ? (childrenMap.get(parentByChild.get(node.id)!) ?? []) : [];
      const index = siblingIndex.get(node.id) ?? 0;
      const angle = siblings.length ? (index / siblings.length) * Math.PI * 2 - Math.PI / 2 : 0;
      const ringRadius = node.id === rootId ? 0 : 105 + Math.min(depth, 4) * 82;
      const spread = Math.max(0.62, Math.min(1.15, siblings.length / 5));
      return {
        ...node,
        depth,
        isRoot: node.id === rootId,
        x: node.id === rootId ? 0 : Math.cos(angle) * ringRadius * spread,
        y: node.id === rootId ? 0 : Math.sin(angle) * ringRadius * 0.58,
        z: node.id === rootId ? 0 : Math.cos(angle * 1.7) * ringRadius * 0.28,
        fx: node.id === rootId ? 0 : Math.cos(angle) * ringRadius * spread,
        fy: node.id === rootId ? 0 : Math.sin(angle) * ringRadius * 0.58,
        fz: node.id === rootId ? 0 : Math.cos(angle * 1.7) * ringRadius * 0.28,
      };
    });
    const nodeSet = new Set(nodes.map((node) => node.id));
    const links = graph.relations
      .filter((relation) => nodeSet.has(relation.source) && nodeSet.has(relation.target))
      .map((relation) => ({ ...relation, relation }));
    return { nodes, links };
  }, [graph, rootId, childrenMap, visibleIds]);

  const toggleExpanded = useCallback((nodeId: string) => {
    if (!(childrenMap.get(nodeId)?.length)) return;
    setExpandedIds((current) => {
      if (current.has(nodeId)) return current;
      const next = new Set(current);
      next.add(nodeId);
      return next;
    });
  }, [childrenMap]);

  const resetView = useCallback(() => {
    graphRef.current?.cameraPosition(DEFAULT_CAMERA, { x: 0, y: 0, z: 0 }, 600);
  }, []);

  const zoom = useCallback((factor: number) => {
    const camera = graphRef.current?.camera();
    if (!camera) return;
    // OrbitControls 通过相机与目标点的距离实现缩放。
    camera.position.multiplyScalar(1 / factor);
    (graphRef.current?.controls() as any)?.update?.();
  }, []);

  const syncNavigationMode = useCallback(() => {
    const controls = graphRef.current?.controls() as any;
    if (!controls) return;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    if (controls.mouseButtons) {
      controls.mouseButtons.LEFT = panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    }
  }, [panMode]);

  useEffect(() => {
    syncNavigationMode();
    const timer = window.setTimeout(syncNavigationMode, 250);
    return () => window.clearTimeout(timer);
  }, [syncNavigationMode, viewData.nodes.length]);

  const ensureScenePresentation = useCallback(() => {
    const instance = graphRef.current;
    const scene = instance?.scene();
    const renderer = instance?.renderer();
    if (!scene || !renderer) return false;

    // ForceGraph 初始化时会覆盖清屏色，挂载完成后再次设定可确保不会回到黑色。
    const stageColor = new THREE.Color('#e8eef0');
    renderer.setClearColor(stageColor, 1);
    renderer.domElement.style.backgroundColor = '#e8eef0';
    scene.background = stageColor;

    if (!scene.getObjectByName('knowledge-graph-backdrop')) {
      const backdrop = new THREE.Group();
      backdrop.name = 'knowledge-graph-backdrop';

      const grid = new THREE.GridHelper(1180, 24, '#7ba1b8', '#b9ced8');
      grid.rotation.x = Math.PI / 2;
      grid.position.z = -210;
      grid.material.transparent = true;
      grid.material.opacity = 0.4;
      backdrop.add(grid);

      const innerGrid = new THREE.GridHelper(680, 20, '#d18b31', '#d7e3e5');
      innerGrid.rotation.x = Math.PI / 2;
      innerGrid.position.z = -206;
      innerGrid.material.transparent = true;
      innerGrid.material.opacity = 0.22;
      backdrop.add(innerGrid);
      scene.add(backdrop);
    }
    return true;
  }, []);

  useEffect(() => {
    const timers = [80, 320, 900].map((delay) => window.setTimeout(ensureScenePresentation, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [ensureScenePresentation, viewData.nodes.length]);

  const isNodeDimmed = useCallback((node: ViewNode) => {
    const categoryMatch = !highlightIds?.size || highlightIds.has(node.id);
    const searchMatch = !matchedIds.size || matchedIds.has(node.id);
    // 选中中心核心时只表示展开入口，不应把刚展开的第一层分支压暗。
    const pathMatch = !selectedId || selectedId === rootId || !pathIds.size || pathIds.has(node.id);
    return !(categoryMatch && searchMatch && pathMatch);
  }, [highlightIds, matchedIds, pathIds, rootId, selectedId]);

  if (!graph) return null;

  return (
    <div className="knowledge-graph-stage relative h-full w-full min-h-[480px] overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.92),rgba(233,241,245,0.6)_44%,rgba(215,230,242,0.35))]">
      <div className="graph-orbit graph-orbit-a" aria-hidden="true" />
      <div className="graph-orbit graph-orbit-b" aria-hidden="true" />
      <div className="graph-crosshair" aria-hidden="true"><span /><span /></div>
      <div className="graph-console-mark" aria-hidden="true">NODE FIELD / 3D</div>
      <div className="absolute top-3 left-3 z-10 w-[min(360px,48%)]">
        <div className="sketch-card p-2 flex items-center gap-2 shadow-sketch-lg bg-paper-50/90 backdrop-blur-sm">
          <Search size={15} className="text-ink-light shrink-0 ml-1" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="搜索知识点，自动展开路径"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-ink-soft"
          />
          {searchText && <span className="text-[11px] sketch-tag bg-sketch-yellow/30 text-sketch-orangeDeep border-sketch-orange/30 shrink-0">{matchedIds.size} 个结果</span>}
        </div>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button onClick={() => setPanMode((value) => !value)} className={`w-8 h-8 rounded-full border-2 shadow-sketch-sm flex items-center justify-center transition-colors ${panMode ? 'bg-sketch-blue text-white border-sketch-blueDeep' : 'bg-paper-50/90 border-ink/15 text-ink-light hover:text-ink'}`} title={panMode ? '当前为平移模式，点击切换旋转' : '切换平移模式'} aria-label={panMode ? '切换旋转模式' : '切换平移模式'}><Move3d size={15} /></button>
        <button onClick={() => zoom(0.8)} className="w-8 h-8 rounded-full bg-paper-50/90 border-2 border-ink/15 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="缩小视图" aria-label="缩小视图"><ZoomOut size={15} /></button>
        <button onClick={() => zoom(1.25)} className="w-8 h-8 rounded-full bg-paper-50/90 border-2 border-ink/15 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="放大视图" aria-label="放大视图"><ZoomIn size={15} /></button>
        <button onClick={resetView} className="w-8 h-8 rounded-full bg-paper-50/90 border-2 border-ink/15 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="重置视角" aria-label="重置视角"><RotateCcw size={15} /></button>
      </div>

      <div className="graph-hint absolute bottom-3 left-3 z-10 sketch-card px-3 py-2 bg-paper-50/85 backdrop-blur-sm text-[11px] text-ink-light leading-relaxed">
        <span className="font-bold text-ink">中心核心</span> 点击展开分支 · {panMode ? '拖拽平移图谱' : '拖拽旋转视角'} · 滚轮缩放
        {selectedId && <span className="ml-2 text-sketch-orangeDeep">已高亮前置路径</span>}
      </div>

      <ForceGraph3D
        ref={graphRef as any}
        graphData={viewData as any}
        backgroundColor="#e8eef0"
        rendererConfig={{ alpha: false, antialias: true }}
        showNavInfo={false}
        enableNodeDrag={false}
        enableNavigationControls
        controlType="orbit"
        numDimensions={3}
        nodeRelSize={4}
        nodeVal={(node: any) => (node.isRoot ? 7 : 2.5 + node.importance * 0.9)}
        nodeLabel={(node: any) => `${node.name}<br/><small>${CATEGORY_META[node.category]?.label ?? '知识点'} · 第 ${node.depth + 1} 层</small>`}
        nodeThreeObject={(node: any) => {
          const viewNode = node as ViewNode;
          const categoryMatch = !highlightIds?.size || highlightIds.has(viewNode.id);
          const selected = selectedId === viewNode.id;
          const highlighted = categoryMatch && (matchedIds.has(viewNode.id) || pathIds.has(viewNode.id));
          return makeNodeObject(viewNode, selected, highlighted, isNodeDimmed(viewNode), masteredIds.has(viewNode.id));
        }}
        nodeThreeObjectExtend={false}
        linkLabel={(link: any) => `${RELATION_META[link.type]?.label ?? link.label ?? '关系'}`}
        linkColor={(link: any) => {
          const source = getNodeId(link.source);
          const target = getNodeId(link.target);
          const active = !selectedId || (pathIds.has(source) && pathIds.has(target));
          const categoryActive = !highlightIds?.size || highlightIds.has(source) || highlightIds.has(target);
          return active && categoryActive ? (RELATION_META[link.type]?.color ?? '#a89880') : 'rgba(100,100,100,0.12)';
        }}
        linkWidth={(link: any) => {
          const source = getNodeId(link.source);
          const target = getNodeId(link.target);
          return selectedId && pathIds.has(source) && pathIds.has(target) ? 2.6 : 1.1;
        }}
        linkOpacity={0.78}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalArrowColor={(link: any) => RELATION_META[link.type]?.color ?? '#a89880'}
        warmupTicks={20}
        cooldownTicks={100}
        d3VelocityDecay={0.35}
        onNodeClick={(node: any) => {
          const viewNode = node as ViewNode;
          onSelectNode(viewNode);
          toggleExpanded(viewNode.id);
        }}
        onNodeRightClick={(node: any, event: MouseEvent) => {
          event.preventDefault();
          const viewNode = node as ViewNode;
          setExpandedIds((current) => {
            const next = new Set(current);
            next.delete(viewNode.id);
            return next;
          });
        }}
        onEngineStop={() => {
          syncNavigationMode();
          ensureScenePresentation();
          graphRef.current?.cameraPosition(DEFAULT_CAMERA, { x: 0, y: 0, z: 0 }, 0);
        }}
      />
    </div>
  );
}
