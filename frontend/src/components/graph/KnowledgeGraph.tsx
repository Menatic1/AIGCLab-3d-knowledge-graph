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

function addEdgeFrame(group: THREE.Group, geometry: THREE.BufferGeometry, color: string, opacity: number, rotationX = 0) {
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 22),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(0.62, opacity * 0.58), depthWrite: false }),
  );
  frame.rotation.x = rotationX;
  group.add(frame);
  return frame;
}

function createPetalGeometry(radius: number) {
  const petal = new THREE.Shape();
  petal.moveTo(0, 0);
  petal.quadraticCurveTo(radius * 0.58, radius * 0.1, radius * 0.62, radius * 0.6);
  petal.quadraticCurveTo(radius * 0.56, radius * 0.97, 0, radius * 1.2);
  petal.quadraticCurveTo(-radius * 0.56, radius * 0.97, -radius * 0.62, radius * 0.6);
  petal.quadraticCurveTo(-radius * 0.58, radius * 0.1, 0, 0);
  return new THREE.ExtrudeGeometry(petal, {
    depth: Math.max(0.55, radius * 0.06),
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.max(0.12, radius * 0.018),
    bevelThickness: Math.max(0.12, radius * 0.018),
  });
}

function addCrystalPetals(group: THREE.Group, radius: number, color: string, opacity: number, count: number, z: number) {
  const petalGeometry = createPetalGeometry(radius);
  const petalMaterial = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: opacity * 0.24,
    roughness: 0.14,
    metalness: 0.02,
    transmission: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeometry, petalMaterial);
    petal.rotation.z = angle;
    petal.position.z = z - (index % 2) * radius * 0.045;
    group.add(petal);
  }
}

function addSparkles(group: THREE.Group, radius: number, color: string, opacity: number, count = 4) {
  const sparkleGeometry = new THREE.OctahedronGeometry(Math.max(0.9, radius * 0.075), 0);
  const sparkleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: Math.min(0.85, opacity * 0.8), depthWrite: false });
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + Math.PI / 8;
    const distance = radius * (0.88 + (index % 2) * 0.16);
    const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
    sparkle.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance, radius * (0.1 + (index % 2) * 0.13));
    sparkle.rotation.z = angle;
    group.add(sparkle);
  }
}

function makeNodeObject(node: ViewNode, selected: boolean, highlighted: boolean, dimmed: boolean, mastered: boolean) {
  const meta = CATEGORY_META[node.category] ?? CATEGORY_META.concept;
  const mediaMeta = node.multimodal ? MULTIMODAL_META[node.multimodal.type] : null;
  const radius = node.isRoot ? 56 : Math.max(8, 9 + node.importance * 1.25 - node.depth * 0.45);
  const opacity = dimmed ? 0.18 : 1;
  const group = new THREE.Group();
  group.userData.nodeId = node.id;

  const nodeColor = selected ? '#c77bb3' : mastered ? '#76a875' : meta.color;
  const glassOpacity = dimmed ? 0.04 : 0.34;
  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color: nodeColor,
    transparent: true,
    opacity: glassOpacity,
    roughness: 0.16,
    metalness: 0.04,
    transmission: 0.16,
    flatShading: true,
    depthWrite: false,
  });
  const luminousMaterial = new THREE.MeshStandardMaterial({
    color: selected ? '#f5c8e8' : mastered ? '#d9f0d0' : '#fff6df',
    transparent: true,
    opacity: dimmed ? 0.12 : 0.9,
    roughness: 0.18,
    metalness: 0.08,
    flatShading: true,
  });

  if (node.isRoot) {
    addCrystalPetals(group, radius * 0.78, nodeColor, opacity, 8, -radius * 0.24);

    const outerCrystalGeometry = new THREE.IcosahedronGeometry(radius * 0.78, 1);
    const outerCrystal = new THREE.Mesh(outerCrystalGeometry, crystalMaterial);
    outerCrystal.scale.set(1, 0.82, 0.42);
    outerCrystal.rotation.z = Math.PI / 8;
    group.add(outerCrystal);
    const outerFrame = addEdgeFrame(group, outerCrystalGeometry, nodeColor, opacity);
    outerFrame.scale.set(1, 0.82, 0.42);
    outerFrame.rotation.z = Math.PI / 8;

    const innerCrystalGeometry = new THREE.DodecahedronGeometry(radius * 0.34, 0);
    const innerCrystal = new THREE.Mesh(innerCrystalGeometry, luminousMaterial);
    innerCrystal.scale.z = 0.62;
    innerCrystal.position.z = radius * 0.36;
    group.add(innerCrystal);
    const innerFrame = addEdgeFrame(group, innerCrystalGeometry, selected ? '#c77bb3' : '#fff4d6', opacity);
    innerFrame.scale.z = 0.62;

    const crescent = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.94, Math.max(0.7, radius * 0.018), 6, 36, Math.PI * 1.38),
      new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: dimmed ? 0.08 : 0.45, depthWrite: false }),
    );
    crescent.rotation.z = -Math.PI * 0.18;
    crescent.position.z = -radius * 0.1;
    group.add(crescent);
    addSparkles(group, radius, selected ? '#c77bb3' : '#fff1ca', opacity, 6);
  } else if (mediaMeta) {
    // 多模态资源是轻薄的六角记忆卡，与知识晶体保持清晰区分。
    addCrystalPetals(group, radius * 0.58, mediaMeta.color, opacity, 4, -radius * 0.2);
    const cardGeometry = new THREE.CylinderGeometry(radius * 1.02, radius * 1.12, radius * 0.24, 6);
    const card = new THREE.Mesh(cardGeometry, crystalMaterial);
    card.rotation.x = Math.PI / 2;
    group.add(card);
    addEdgeFrame(group, cardGeometry, mediaMeta.color, opacity, Math.PI / 2);

    const screenGeometry = new THREE.CylinderGeometry(radius * 0.72, radius * 0.76, Math.max(0.9, radius * 0.1), 6);
    const screen = new THREE.Mesh(screenGeometry, luminousMaterial);
    screen.rotation.x = Math.PI / 2;
    screen.position.z = Math.max(1.4, radius * 0.22);
    group.add(screen);
    addEdgeFrame(group, screenGeometry, mediaMeta.color, opacity, Math.PI / 2);

    const mediaCoreGeometry = new THREE.OctahedronGeometry(radius * 0.28, 0);
    const mediaCore = new THREE.Mesh(
      mediaCoreGeometry,
      new THREE.MeshStandardMaterial({ color: mediaMeta.color, roughness: 0.18, metalness: 0.12, transparent: true, opacity, flatShading: true }),
    );
    mediaCore.scale.z = 0.48;
    mediaCore.position.z = Math.max(2, radius * 0.34);
    group.add(mediaCore);
    const mediaFrame = addEdgeFrame(group, mediaCoreGeometry, mediaMeta.color, opacity);
    mediaFrame.scale.z = 0.48;

    addSparkles(group, radius, mediaMeta.color, opacity, 3);

    const marker = textSprite(mediaMeta.marker, mediaMeta.color, opacity);
    marker.scale.set(7, 7, 1);
    marker.position.set(0, 0, Math.max(2.4, radius * 0.42));
    group.add(marker);
  } else {
    addCrystalPetals(group, radius * 0.66, nodeColor, opacity, 5, -radius * 0.16);

    const shellGeometry = new THREE.IcosahedronGeometry(radius * 0.62, 1);
    const shell = new THREE.Mesh(shellGeometry, crystalMaterial);
    shell.scale.set(1, 0.86, 0.4);
    shell.rotation.z = Math.PI / 10;
    group.add(shell);
    const shellFrame = addEdgeFrame(group, shellGeometry, nodeColor, opacity);
    shellFrame.scale.set(1, 0.86, 0.4);
    shellFrame.rotation.z = Math.PI / 10;

    const coreGeometry = new THREE.OctahedronGeometry(Math.max(2, radius * 0.26), 0);
    const core = new THREE.Mesh(coreGeometry, luminousMaterial);
    core.scale.z = 0.52;
    core.position.z = radius * 0.32;
    core.rotation.z = Math.PI / 4;
    group.add(core);
    const coreFrame = addEdgeFrame(group, coreGeometry, selected ? '#c77bb3' : nodeColor, opacity);
    coreFrame.scale.z = 0.52;
    coreFrame.rotation.z = Math.PI / 4;

    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.7, Math.max(0.45, radius * 0.018), 5, 28, Math.PI * 0.72),
      new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: dimmed ? 0.06 : 0.35, depthWrite: false }),
    );
    arc.rotation.z = Math.PI * 0.72;
    arc.position.z = -radius * 0.04;
    group.add(arc);
    addSparkles(group, radius, nodeColor, opacity);
  }

  const showLabel = node.isRoot || Boolean(mediaMeta) || selected || highlighted || node.depth <= 1;
  if (showLabel) {
    const label = textSprite(node.name, '#3b332b', opacity);
    // 标签仍贴在节点正面中央，保证旋转后也易读。
    label.position.set(0, 0, node.isRoot ? radius * 0.68 + 3 : radius * 0.55 + 2);
    group.add(label);
  }

  // 每个节点有独立的相位，避免所有图形同步上下跳动，形成自然的“呼吸”状态。
  group.userData.floatPhase = (node.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 628) / 100;
  group.userData.floatAmplitude = node.isRoot ? 22 : 13 + (node.importance % 3) * 1.35;
  group.userData.floatSpeed = node.isRoot ? 0.42 : 0.32 + (node.depth % 3) * 0.045;
  group.userData.baseX = Number(node.x ?? 0);
  group.userData.baseY = Number(node.y ?? 0);
  group.userData.baseZ = Number((node as ViewNode & { z?: number }).z ?? 0);
  group.userData.baseRotationY = node.isRoot ? 0 : (node.depth % 2 ? 0.12 : -0.12);

  return group;
}

export default function KnowledgeGraph({ onSelectNode, selectedId, highlightIds }: Props) {
  const { graph, masteredIds } = useKnowledge();
  const graphRef = useRef<GraphApi | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [panMode, setPanMode] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  const animateNodes = useCallback((timestamp: number) => {
    const scene = graphRef.current?.scene();
    if (scene) {
      scene.traverse((object) => {
        if (!object.userData?.nodeId) return;
        const phase = object.userData.floatPhase ?? 0;
        const amplitude = object.userData.floatAmplitude ?? 1.8;
        const speed = object.userData.floatSpeed ?? 0.52;
        const baseX = object.userData.baseX ?? object.position.x;
        const baseY = object.userData.baseY ?? object.position.y;
        const baseZ = object.userData.baseZ ?? object.position.z;
        const wave = timestamp * 0.001 * speed + phase;
        object.position.x = baseX + Math.cos(wave * 0.82) * amplitude * 0.26;
        object.position.y = baseY + Math.sin(wave) * amplitude;
        object.position.z = baseZ + Math.sin(wave * 0.64) * amplitude * 0.34;
        object.rotation.y = (object.userData.baseRotationY ?? 0) + Math.sin(timestamp * 0.0007 * speed + phase) * 0.035;
        object.rotation.z = Math.cos(timestamp * 0.00055 * speed + phase) * 0.018;
      });
    }
    animationFrameRef.current = requestAnimationFrame(animateNodes);
  }, []);

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
    const stageColor = new THREE.Color('#eef1f7');
    renderer.setClearColor(stageColor, 1);
    renderer.domElement.style.backgroundColor = '#eef1f7';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.background = stageColor;

    if (!scene.getObjectByName('knowledge-graph-light-key')) {
      const keyLight = new THREE.DirectionalLight('#fff3dc', 1.45);
      keyLight.name = 'knowledge-graph-light-key';
      keyLight.position.set(180, 240, 340);
      scene.add(keyLight);
      const fillLight = new THREE.AmbientLight('#d9d4f4', 1.35);
      fillLight.name = 'knowledge-graph-light-fill';
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight('#b7dce5', 0.7);
      rimLight.name = 'knowledge-graph-light-rim';
      rimLight.position.set(-240, -120, 220);
      scene.add(rimLight);
    }

    if (!scene.getObjectByName('knowledge-graph-backdrop')) {
      const backdrop = new THREE.Group();
      backdrop.name = 'knowledge-graph-backdrop';

      const starCount = 132;
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);
      const palette = ['#d5b5df', '#9fc8d6', '#f1cf94', '#f5f1e7'].map((color) => new THREE.Color(color));
      for (let index = 0; index < starCount; index += 1) {
        const x = Math.sin(index * 18.23) * 510;
        const y = Math.cos(index * 9.71) * 300;
        const color = palette[index % palette.length];
        starPositions.set([x, y, -230 - (index % 5) * 7], index * 3);
        starColors.set([color.r, color.g, color.b], index * 3);
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
      const stardust = new THREE.Points(starGeometry, new THREE.PointsMaterial({
        size: 2.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        sizeAttenuation: true,
      }));
      backdrop.add(stardust);

      const constellationGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-410, 190, -218), new THREE.Vector3(-320, 122, -218),
        new THREE.Vector3(-320, 122, -218), new THREE.Vector3(-254, 176, -218),
        new THREE.Vector3(248, -152, -218), new THREE.Vector3(342, -92, -218),
        new THREE.Vector3(342, -92, -218), new THREE.Vector3(414, -156, -218),
      ]);
      const constellation = new THREE.LineSegments(
        constellationGeometry,
        new THREE.LineBasicMaterial({ color: '#b69bc8', transparent: true, opacity: 0.24, depthWrite: false }),
      );
      backdrop.add(constellation);
      scene.add(backdrop);
    }
    return true;
  }, []);

  useEffect(() => {
    const timers = [80, 320, 900].map((delay) => window.setTimeout(ensureScenePresentation, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [ensureScenePresentation, viewData.nodes.length]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animateNodes);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [animateNodes, viewData.nodes.length]);

  const isNodeDimmed = useCallback((node: ViewNode) => {
    const categoryMatch = !highlightIds?.size || highlightIds.has(node.id);
    const searchMatch = !matchedIds.size || matchedIds.has(node.id);
    // 选中中心核心时只表示展开入口，不应把刚展开的第一层分支压暗。
    const pathMatch = !selectedId || selectedId === rootId || !pathIds.size || pathIds.has(node.id);
    return !(categoryMatch && searchMatch && pathMatch);
  }, [highlightIds, matchedIds, pathIds, rootId, selectedId]);

  if (!graph) return null;

  return (
    <div className="knowledge-graph-stage relative h-full w-full min-h-[480px] overflow-hidden rounded-[inherit] bg-[#eef1f7]">
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
        backgroundColor="#eef1f7"
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
