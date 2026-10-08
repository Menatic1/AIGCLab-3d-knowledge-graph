import { useTabs } from '../context/TabContext';
import { useEffect, useMemo, useState } from 'react';
import { Filter, Layers, Network, Info, ArrowRight, Share2, Edit3, Plus, Trash2, Save, X, Image, List, ChevronLeft, ChevronRight, CheckCircle2, Circle, Search } from 'lucide-react';
import KnowledgeGraph from '../components/graph/KnowledgeGraph';
import NodeDetailCard from '../components/graph/NodeDetailCard';
import RelationLegend from '../components/graph/RelationLegend';
import { useKnowledge } from '../context/KnowledgeContext';
import type { KnowledgeNode, MultimodalType } from '../types';
import { CATEGORY_META } from '../mock/sampleKnowledgeGraph';
import { useAuth } from '../context/AuthContext';

const RESOURCE_CATEGORY_TYPE: Partial<Record<KnowledgeNode['category'], MultimodalType>> = {
  image: 'image', formula: 'formula', code: 'code', video: 'video',
};

const DEFAULT_MULTIMODAL_CONTENT: Record<MultimodalType, string> = {
  image: '资源内容|请补充图示说明',
  formula: 'y = f(x)',
  code: 'function example() {\n  return true;\n}',
  video: '课程导入|核心讲解|案例演示|知识回顾',
};

export default function GraphPage() {
  const { graph, hasGraph, masteredIds, setLearningNode } = useKnowledge();
  const { user } = useAuth();
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [listSearch, setListSearch] = useState('');
  const { openTab } = useTabs();

  const categoryStats = useMemo(() => {
    if (!graph) return [] as { key: string; label: string; count: number; color: string }[];
    const map = new Map<string, number>();
    graph.nodes.forEach((n) => map.set(n.category, (map.get(n.category) ?? 0) + 1));
    return Object.entries(CATEGORY_META).map(([k, v]) => ({
      key: k,
      label: v.label,
      count: map.get(k) ?? 0,
      color: v.color,
    }));
  }, [graph]);

  if (!hasGraph || !graph) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <div className="sketch-card p-10 max-w-lg text-center">
          <div className="mx-auto w-20 h-20 mb-5 rounded-sketch bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink shadow-sketch flex items-center justify-center border-2 border-white/60 rotate-[-4deg]">
            <Network size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-ink handwritten mb-2">暂无图谱</h2>
          <p className="text-sm text-ink-light mb-6">
            请先上传文档并启动 AI 解析，或直接加载示例图谱
          </p>
          <button onClick={() => openTab('upload')} className="sketch-btn-primary">
            去上传文档
          </button>
        </div>
      </div>
    );
  }

  const highlightIds = useMemo(() => {
    if (!activeCategory) return new Set<string>();
    return new Set(graph.nodes.filter((n) => n.category === activeCategory).map((n) => n.id));
  }, [activeCategory, graph]);

  const relationTypeCount = new Set(graph.relations.map((r) => r.type)).size;
  const multimodalCount = graph.nodes.filter((node) => Boolean(node.multimodal)).length;

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-140px)]">
      {/* 顶部：课程信息 + 统计 + 跳转 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-ink handwritten">
            {graph.courseName}
            <span className="text-sketch-blueDeep ml-2">· {graph.chapterName}</span>
          </h2>
          <p className="text-xs text-ink-light mt-1">
            {graph.documentName} · {new Date(graph.extractedAt).toLocaleString('zh-CN', { hour12: false })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Stat value={graph.nodes.length} label="图谱节点" color="blue" icon={<Layers size={14} />} />
          <Stat value={graph.relations.length} label="关系" color="orange" icon={<Share2 size={14} />} />
          <Stat value={multimodalCount} label="多模态资源" color="purple" icon={<Image size={14} />} />
          <Stat value={`${masteredIds.size}/${graph.nodes.length}`} label="已掌握" color="green" icon={<Info size={14} />} />
          <Stat value={relationTypeCount} label="关系类型" color="purple" icon={<Network size={14} />} />
          {user?.role !== 'teacher' && (
            <button onClick={() => openTab('qa')} className="sketch-btn-secondary text-xs !px-4">
              💬 问答
            </button>
          )}
          <button onClick={() => openTab('path')} className="sketch-btn-warm text-xs !px-4">
            🛤 路径 <ArrowRight size={12} />
          </button>
          {user?.role === 'teacher' && (
            <button onClick={() => setEditorOpen((value) => !value)} className="sketch-btn-secondary text-xs !px-4"><Edit3 size={13} /> {editorOpen ? '关闭编辑' : '编辑图谱'}</button>
          )}
        </div>
      </div>

      {editorOpen && user?.role === 'teacher' && <GraphEditor />}

      {/* 分类筛选条 */}
      <div className="sketch-card p-2.5 flex flex-wrap items-center gap-2">
        <Filter size={15} className="text-sketch-blueDeep ml-1" />
        <button
          onClick={() => setActiveCategory(null)}
          className={
            'sketch-tag transition-all ' +
            (activeCategory === null
              ? 'bg-ink text-paper-50 border-ink shadow-sm'
              : 'bg-paper-100 text-ink border-ink/20 hover:bg-paper-200')
          }
        >
          全部 ({graph.nodes.length})
        </button>
        {categoryStats.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveCategory(activeCategory === c.key ? null : c.key)}
            className={
              'sketch-tag transition-all items-center gap-1.5 ' +
              (activeCategory === c.key
                ? 'border-ink/50 shadow-sm'
                : 'border-ink/15 hover:border-ink/30')
            }
            style={{
              background: activeCategory === c.key ? c.color : CATEGORY_META[c.key].bgColor,
              color: activeCategory === c.key ? '#fff' : c.color,
            }}
          >
            <span className="w-2 h-2 rounded-full border border-white/60" style={{ background: c.color }} />
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      {/* 主视图：左侧节点列表 + 右侧3D图谱 */}
      <div className="flex-1 min-h-[480px] h-[65vh] relative flex gap-4">
        {/* 左侧：节点列表面板 */}
        <div
          className={
            'shrink-0 transition-all duration-300 ease-out ' +
            (listOpen ? 'w-72' : 'w-0')
          }
        >
          <div className={'h-full flex flex-col sketch-card overflow-hidden ' + (listOpen ? '' : 'invisible')}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b-2 border-ink/10 bg-paper-100/60">
              <div className="flex items-center gap-2">
                <List size={15} className="text-sketch-blueDeep" />
                <span className="text-sm font-bold text-ink handwritten">知识点列表</span>
                <span className="text-[10px] text-ink-light bg-paper-50 px-1.5 py-0.5 rounded-full border border-ink/10">
                  {graph.nodes.length}
                </span>
              </div>
              <button
                onClick={() => setListOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-ink-light hover:bg-paper-200 hover:text-ink transition-colors"
                title="收起列表"
                aria-label="收起列表"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            {/* 搜索框 */}
            <div className="p-2.5 border-b border-ink/8">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sketch-sm border border-ink/15 bg-paper-50 focus-within:border-sketch-blue/40">
                <Search size={13} className="text-ink-light shrink-0" />
                <input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="搜索知识点"
                  className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ink placeholder:text-ink-soft"
                />
              </div>
            </div>

            {/* 节点列表（按分类分组） */}
            <div className="flex-1 overflow-y-auto scrollbar-sketch p-2">
              <NodeListGroups
                graph={graph}
                selectedId={selectedNode?.id ?? null}
                onSelect={setSelectedNode}
                masteredIds={masteredIds}
                activeCategory={activeCategory}
                search={listSearch}
              />
            </div>
          </div>
        </div>

        {/* 展开按钮（列表收起时显示） */}
        {!listOpen && (
          <button
            onClick={() => setListOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-16 sketch-card !p-0 flex items-center justify-center text-ink-light hover:text-sketch-blueDeep hover:border-sketch-blue/40 transition-colors rounded-l-sketch-sm border-r-0"
            title="展开列表"
            aria-label="展开列表"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* 右侧：3D 图谱 */}
        <div className="flex-1 min-w-0 sketch-card h-full overflow-hidden relative">
          <KnowledgeGraph
            onSelectNode={setSelectedNode}
            selectedId={selectedNode?.id ?? null}
            highlightIds={highlightIds}
          />
          <RelationLegend className="absolute bottom-3 right-3 z-10 w-48 max-w-[40%]" />
          <NodeDetailCard
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onStudy={() => {
              if (selectedNode) {
                setLearningNode(selectedNode);
                openTab('learning');
              }
            }}
            onJump={(id) => {
              const n = graph.nodes.find((x) => x.id === id);
              if (n) setSelectedNode(n);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** 节点列表面板：按分类分组展示所有知识点，支持搜索与分类筛选 */
function NodeListGroups({
  graph,
  selectedId,
  onSelect,
  masteredIds,
  activeCategory,
  search,
}: {
  graph: { nodes: KnowledgeNode[] };
  selectedId: string | null;
  onSelect: (node: KnowledgeNode) => void;
  masteredIds: Set<string>;
  activeCategory: string | null;
  search: string;
}) {
  const query = search.trim().toLowerCase();
  // 按分类分组（保持 CATEGORY_META 定义顺序）
  const groups = useMemo(() => {
    const map = new Map<string, KnowledgeNode[]>();
    for (const node of graph.nodes) {
      if (activeCategory && node.category !== activeCategory) continue;
      if (query && !node.name.toLowerCase().includes(query)) continue;
      const list = map.get(node.category) ?? [];
      list.push(node);
      map.set(node.category, list);
    }
    // 按 CATEGORY_META 顺序排列，没有的分类放最后
    const order = Object.keys(CATEGORY_META);
    return Array.from(map.entries()).sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [graph.nodes, activeCategory, query]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10">
        <Circle size={28} className="text-ink-soft mb-2" strokeWidth={1.2} />
        <p className="text-xs text-ink-light">
          {query ? '没有匹配的知识点' : '暂无节点'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([category, nodes]) => {
        const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
        const color = meta?.color ?? '#8a8070';
        const label = meta?.label ?? category;
        const masteredCount = nodes.filter((n) => masteredIds.has(n.id)).length;
        return (
          <div key={category}>
            {/* 分类标题 */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] font-bold text-ink tracking-wide">{label}</span>
              <span className="text-[10px] text-ink-soft">
                {masteredCount}/{nodes.length}
              </span>
            </div>
            {/* 节点条目 */}
            <div className="flex flex-col gap-0.5">
              {nodes.map((node) => {
                const selected = selectedId === node.id;
                const mastered = masteredIds.has(node.id);
                return (
                  <button
                    key={node.id}
                    onClick={() => onSelect(node)}
                    className={
                      'group flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-sketch-sm transition-all ' +
                      (selected
                        ? 'bg-sketch-blue/12 border border-sketch-blue/30'
                        : 'hover:bg-paper-100 border border-transparent')
                    }
                  >
                    {/* 左侧色条 */}
                    <span
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {/* 节点名称 */}
                    <span
                      className={
                        'flex-1 min-w-0 truncate text-xs ' +
                        (selected ? 'text-sketch-blueDeep font-semibold' : 'text-ink')
                      }
                    >
                      {node.name}
                    </span>
                    {/* 已掌握标记 */}
                    {mastered && (
                      <CheckCircle2
                        size={13}
                        className="text-sketch-green shrink-0"
                        strokeWidth={2}
                      />
                    )}
                    {/* 选中箭头 */}
                    {selected && (
                      <ArrowRight size={13} className="text-sketch-blue shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GraphEditor() {
  const { graph, updateNode, addNode, deleteNode, addRelation, deleteRelation } = useKnowledge();
  const [selectedId, setSelectedId] = useState(graph?.nodes[0]?.id ?? '');
  const selected = graph?.nodes.find((node) => node.id === selectedId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [definition, setDefinition] = useState('');
  const [category, setCategory] = useState<KnowledgeNode['category']>('concept');
  const [importance, setImportance] = useState(3);
  const [resourceContent, setResourceContent] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<KnowledgeNode['category']>('concept');
  const [relSource, setRelSource] = useState('');
  const [relTarget, setRelTarget] = useState('');
  const [relType, setRelType] = useState<'contains' | 'prerequisite' | 'related'>('related');

  useEffect(() => {
    if (!selected) return;
    setName(selected.name); setDescription(selected.description); setDefinition(selected.definition); setCategory(selected.category); setImportance(selected.importance); setResourceContent(selected.multimodal?.content ?? '');
  }, [selectedId, selected]);
  useEffect(() => { if (graph?.nodes.length && !graph.nodes.some((node) => node.id === selectedId)) setSelectedId(graph.nodes[0].id); }, [graph, selectedId]);

  if (!graph) return null;
  const resourceType = RESOURCE_CATEGORY_TYPE[category];
  const save = () => selected && updateNode(selected.id, {
    name: name.trim() || selected.name, description, definition, category, importance,
    multimodal: resourceType ? { type: resourceType, content: resourceContent.trim() || DEFAULT_MULTIMODAL_CONTENT[resourceType] } : undefined,
  });
  const createNode = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newResourceType = RESOURCE_CATEGORY_TYPE[newCategory];
    const id = addNode({ name: trimmed, category: newCategory, description: newResourceType ? `教师新增${CATEGORY_META[newCategory].label}` : '教师新增知识点', definition: newResourceType ? '请补充资源说明。' : '请补充定义。', examples: [], resources: [], multimodal: newResourceType ? { type: newResourceType, content: DEFAULT_MULTIMODAL_CONTENT[newResourceType] } : undefined, importance: 3 });
    setSelectedId(id); setNewName('');
  };
  const createRelation = () => {
    if (!relSource || !relTarget || relSource === relTarget) return;
    addRelation({ source: relSource, target: relTarget, type: relType, label: relType === 'contains' ? '包含' : relType === 'prerequisite' ? '前置于' : '相关于' });
  };
  return (
    <div className="sketch-card p-4 border-sketch-orange/35 bg-sketch-orange/5 space-y-4">
      <div className="flex items-center justify-between"><div><h3 className="font-bold text-ink handwritten">教师图谱与资源编辑器</h3><p className="text-xs text-ink-light mt-0.5">图片、公式、代码和视频会作为独立节点同步到图谱</p></div><Edit3 size={18} className="text-sketch-orangeDeep" /></div>
      <div className="grid lg:grid-cols-[220px_1fr_1fr] gap-4">
        <div className="space-y-2"><div className="text-xs font-bold text-ink-light">节点与资源列表</div><div className="max-h-52 overflow-auto scrollbar-sketch space-y-1 pr-1">{graph.nodes.map((node) => <button key={node.id} onClick={() => setSelectedId(node.id)} className={`w-full text-left text-xs px-2.5 py-2 rounded-sketch-sm border-2 ${node.id === selectedId ? 'bg-sketch-orange/20 border-sketch-orange/50 text-ink' : 'bg-paper-50 border-ink/10 text-ink-light hover:border-ink/25'}`}><span className="mr-1.5" style={{ color: CATEGORY_META[node.category].color }}>●</span>{node.name}</button>)}</div><div className="space-y-1.5"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新增节点或资源名称" className="sketch-input !py-2 text-xs" /><div className="flex gap-1.5"><select value={newCategory} onChange={(e) => setNewCategory(e.target.value as KnowledgeNode['category'])} className="sketch-input !py-2 text-xs flex-1">{Object.entries(CATEGORY_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select><button onClick={createNode} className="sketch-btn-primary !px-2.5" title="新增节点或资源" aria-label="新增节点或资源"><Plus size={15} /></button></div></div></div>
        <div className="space-y-2"><div className="text-xs font-bold text-ink-light">节点属性</div><input value={name} onChange={(e) => setName(e.target.value)} className="sketch-input !py-2 text-sm" placeholder="名称" /><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="sketch-input !py-2 text-xs resize-none" rows={2} placeholder="描述" /><textarea value={definition} onChange={(e) => setDefinition(e.target.value)} className="sketch-input !py-2 text-xs resize-none" rows={3} placeholder="定义" /><div className="flex gap-2"><select value={category} onChange={(e) => setCategory(e.target.value as KnowledgeNode['category'])} className="sketch-input !py-2 text-xs">{Object.entries(CATEGORY_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select><input type="number" min={1} max={5} value={importance} onChange={(e) => setImportance(Number(e.target.value))} className="sketch-input !py-2 text-xs w-20" /></div>{resourceType && <textarea value={resourceContent} onChange={(e) => setResourceContent(e.target.value)} className="sketch-input !py-2 text-xs resize-none" rows={4} placeholder={`${CATEGORY_META[category].label}内容`} />}<div className="flex gap-2"><button onClick={save} disabled={!selected} className="sketch-btn-success text-xs !py-2"><Save size={13} />保存节点</button><button onClick={() => selected && deleteNode(selected.id)} disabled={!selected} className="sketch-btn-secondary text-xs !py-2 text-sketch-red"><Trash2 size={13} />删除节点</button></div></div>
        <div className="space-y-2"><div className="text-xs font-bold text-ink-light">关系管理</div><select value={relSource} onChange={(e) => setRelSource(e.target.value)} className="sketch-input !py-2 text-xs"><option value="">选择起点</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select><select value={relTarget} onChange={(e) => setRelTarget(e.target.value)} className="sketch-input !py-2 text-xs"><option value="">选择终点</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select><div className="flex gap-2"><select value={relType} onChange={(e) => setRelType(e.target.value as typeof relType)} className="sketch-input !py-2 text-xs"><option value="contains">包含关系</option><option value="prerequisite">前置关系</option><option value="related">相关关系</option></select><button onClick={createRelation} className="sketch-btn-primary text-xs !py-2"><Plus size={13} />添加</button></div><div className="max-h-36 overflow-auto scrollbar-sketch space-y-1 pr-1">{graph.relations.map((relation) => <div key={relation.id} className="flex items-center gap-2 text-[11px] text-ink-light bg-paper-50 border border-ink/10 rounded-sketch-sm px-2 py-1.5"><span className="flex-1 truncate">{graph.nodes.find((node) => node.id === relation.source)?.name} → {graph.nodes.find((node) => node.id === relation.target)?.name}</span><button onClick={() => deleteRelation(relation.id)} className="text-ink-light hover:text-sketch-red" title="删除关系" aria-label="删除关系"><X size={12} /></button></div>)}</div></div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  color: 'blue' | 'orange' | 'green' | 'purple';
  icon: React.ReactNode;
}) {
  const palette: Record<string, string> = {
    blue:   'from-sketch-blue/20 to-sketch-blue/5 text-sketch-blueDeep border-sketch-blue/30',
    orange: 'from-sketch-orange/20 to-sketch-orange/5 text-sketch-orangeDeep border-sketch-orange/30',
    green:  'from-sketch-green/20 to-sketch-green/5 text-sketch-greenDeep border-sketch-green/30',
    purple: 'from-sketch-purple/20 to-sketch-purple/5 text-sketch-purple border-sketch-purple/40',
  };
  return (
    <div
      className={
        'flex items-center gap-2 px-3.5 py-2 rounded-sketch-sm border-2 shadow-sketch-sm bg-gradient-to-br ' +
        palette[color]
      }
    >
      <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center">{icon}</div>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
        <div className="text-base font-bold handwritten">{value}</div>
      </div>
    </div>
  );
}
