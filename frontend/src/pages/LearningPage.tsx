import { ArrowLeft, BookOpen, CircleDot, Network, Route, Sparkles } from 'lucide-react';
import NodeDetailCard from '../components/graph/NodeDetailCard';
import { useKnowledge } from '../context/KnowledgeContext';
import { useTabs } from '../context/TabContext';
import { CATEGORY_META } from '../mock/sampleKnowledgeGraph';

export default function LearningPage() {
  const { graph, learningNode, setLearningNode, masteredIds, weakNodeIds } = useKnowledge();
  const { setActive, openTab } = useTabs();

  if (!learningNode) {
    return (
      <div className="h-full min-h-[560px] flex items-center justify-center">
        <div className="sketch-card p-10 max-w-md text-center">
          <Network size={34} className="mx-auto mb-4 text-sketch-blueDeep" />
          <h2 className="text-xl font-bold text-ink handwritten mb-2">还没有选择学习节点</h2>
          <p className="text-sm text-ink-light mb-5">请回到知识图谱，点击节点后进入详细学习。</p>
          <button onClick={() => setActive('graph')} className="sketch-btn-primary">
            <ArrowLeft size={16} /> 返回知识图谱
          </button>
        </div>
      </div>
    );
  }

  const category = CATEGORY_META[learningNode.category] ?? CATEGORY_META.concept;
  const peerNodes = graph?.nodes
    .filter((node) => node.id !== learningNode.id)
    .map((node) => {
      const sharedParent = graph.relations.some((relation) =>
        relation.type === 'contains'
        && graph.relations.some((other) => other.type === 'contains' && other.target === learningNode.id && other.source === relation.source)
        && relation.target === node.id,
      );
      const isDirectlyRelated = graph.relations.some((relation) =>
        relation.type === 'related'
        && ((relation.source === learningNode.id && relation.target === node.id) || (relation.target === learningNode.id && relation.source === node.id)),
      );
      const sameCategory = node.category === learningNode.category;
      return { node, score: (isDirectlyRelated ? 8 : 0) + (sharedParent ? 6 : 0) + (sameCategory ? 3 : 0) - Math.abs(node.importance - learningNode.importance) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6) ?? [];

  const jumpToNode = (nodeId: string) => {
    const next = graph?.nodes.find((node) => node.id === nodeId);
    if (next) setLearningNode(next);
  };

  return (
    <div className="flex flex-col gap-5 min-h-full pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActive('graph')}
            className="w-9 h-9 rounded-full border-2 border-ink/15 bg-paper-50 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink hover:bg-paper-100"
            title="返回知识图谱"
            aria-label="返回知识图谱"
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-ink-light">
              <BookOpen size={14} className="text-sketch-blueDeep" />
              <span>详细学习</span>
              <span>·</span>
              <span>{graph?.courseName ?? '知识图谱'}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-ink handwritten tracking-wide mt-1">
              {learningNode.name}
            </h2>
          </div>
        </div>
        <span className="sketch-tag text-sm border-2" style={{ color: category.color, borderColor: `${category.color}66`, background: category.bgColor }}>
          {category.label} · 重要度 {learningNode.importance}/5
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_310px] gap-5 items-start">
        <NodeDetailCard
          node={learningNode}
          variant="page"
          onClose={() => setActive('graph')}
          onJump={jumpToNode}
          onQuiz={() => openTab('quiz')}
        />

        <aside className="space-y-4 xl:sticky xl:top-0">
          <section className="sketch-card p-4 border-sketch-blue/25">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-sketch-sm bg-sketch-blue/15 flex items-center justify-center"><Route size={16} className="text-sketch-blueDeep" /></div>
              <div><h3 className="text-sm font-bold text-ink handwritten">继续学习相关知识点</h3><p className="text-[11px] text-ink-light">同级节点 · 点击直接跳转</p></div>
            </div>
            <div className="space-y-2">
              {peerNodes.length ? peerNodes.map(({ node }) => {
                const meta = CATEGORY_META[node.category] ?? CATEGORY_META.concept;
                const completed = masteredIds.has(node.id);
                const weak = weakNodeIds.has(node.id);
                return <button key={node.id} onClick={() => jumpToNode(node.id)} className="w-full flex items-center gap-2.5 p-2.5 text-left rounded-sketch-sm border-2 border-ink/10 bg-paper-50 hover:border-sketch-blue/45 hover:bg-sketch-blue/5 transition-all">
                  <span className="w-2 h-8 rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1 min-w-0"><span className="block text-xs font-bold text-ink truncate">{node.name}</span><span className="block text-[10px] text-ink-light mt-0.5">{completed ? '已通过测试' : weak ? '建议巩固' : `${meta.label} · 重要度 ${node.importance}`}</span></span>
                  <ArrowLeft size={14} className="rotate-180 text-ink-light shrink-0" />
                </button>;
              }) : <div className="text-xs text-ink-light py-4 text-center border-2 border-dashed border-ink/10 rounded-sketch-sm">当前节点暂未关联同级知识点</div>}
            </div>
          </section>

          <section className="sketch-card p-4 bg-gradient-to-br from-sketch-orange/10 to-paper-50 border-sketch-orange/25">
            <div className="flex items-center gap-2"><Sparkles size={16} className="text-sketch-orangeDeep" /><h3 className="text-sm font-bold text-ink handwritten">学习建议</h3></div>
            <p className="text-xs text-ink-light leading-relaxed mt-2">完成本页学习后进入小测试。正确率达到 67% 会自动记录为已掌握；未达标的内容将进入个人报告，并优先获得巩固建议。</p>
            <button onClick={() => openTab('quiz')} className="sketch-btn-warm w-full justify-center text-xs mt-3"><CircleDot size={14} />开始本节测试</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
