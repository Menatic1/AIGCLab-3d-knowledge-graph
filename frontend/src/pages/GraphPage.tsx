import { useTabs } from '../context/TabContext';
import { useMemo, useState } from 'react';
import { Filter, Layers, Network, Info, ArrowRight, Share2, Library } from 'lucide-react';
import KnowledgeGraph from '../components/graph/KnowledgeGraph';
import NodeDetailCard from '../components/graph/NodeDetailCard';
import RelationLegend from '../components/graph/RelationLegend';
import { useKnowledge } from '../context/KnowledgeContext';
import type { KnowledgeNode } from '../types';
import { CATEGORY_META } from '../mock/sampleKnowledgeGraph';

export default function GraphPage() {
  const { graph, hasGraph, masteredIds } = useKnowledge();
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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
          <h2 className="text-2xl font-bold text-ink handwritten mb-2">暂未选择图谱</h2>
          <p className="text-sm text-ink-light mb-6">
            请到「我的图谱」列表中选择一份已保存的图谱，或上传文档 / 用 AIGC 生成新图谱
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <button onClick={() => openTab('graph-list')} className="sketch-btn-primary flex items-center gap-1.5">
              <Library size={16} /> 我的图谱
            </button>
            <button onClick={() => openTab('upload')} className="sketch-btn-secondary">
              上传文档
            </button>
            <button onClick={() => openTab('aigc')} className="sketch-btn-warm">
              AIGC 生成
            </button>
          </div>
        </div>
      </div>
    );
  }

  const highlightIds = useMemo(() => {
    if (!activeCategory) return new Set<string>();
    return new Set(graph.nodes.filter((n) => n.category === activeCategory).map((n) => n.id));
  }, [activeCategory, graph]);

  const relationTypeCount = new Set(graph.relations.map((r) => r.type)).size;

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
          <Stat value={graph.nodes.length} label="知识点" color="blue" icon={<Layers size={14} />} />
          <Stat value={graph.relations.length} label="关系" color="orange" icon={<Share2 size={14} />} />
          <Stat value={`${masteredIds.size}/${graph.nodes.length}`} label="已掌握" color="green" icon={<Info size={14} />} />
          <Stat value={relationTypeCount} label="关系类型" color="purple" icon={<Network size={14} />} />
          <button onClick={() => openTab('graph-list')} className="sketch-btn-secondary text-xs !px-4 flex items-center gap-1.5">
            <Library size={14} /> 切换图谱
          </button>
          <button onClick={() => openTab('qa')} className="sketch-btn-secondary text-xs !px-4">
            💬 问答
          </button>
          <button onClick={() => openTab('path')} className="sketch-btn-warm text-xs !px-4">
            🛤 路径 <ArrowRight size={12} />
          </button>
        </div>
      </div>

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

      {/* 主视图 */}
      <div className="flex-1 min-h-[480px] h-[65vh] relative">
        <div className="sketch-card h-full overflow-hidden relative">
          <KnowledgeGraph
            onSelectNode={setSelectedNode}
            selectedId={selectedNode?.id ?? null}
            highlightIds={highlightIds}
          />
          <RelationLegend className="absolute bottom-3 right-3 z-10 w-48 max-w-[40%]" />
          <NodeDetailCard
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
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
