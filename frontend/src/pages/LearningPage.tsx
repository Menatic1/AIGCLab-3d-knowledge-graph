import { ArrowLeft, BookOpen, Network } from 'lucide-react';
import NodeDetailCard from '../components/graph/NodeDetailCard';
import { useKnowledge } from '../context/KnowledgeContext';
import { useTabs } from '../context/TabContext';
import { CATEGORY_META } from '../mock/sampleKnowledgeGraph';

export default function LearningPage() {
  const { graph, learningNode, setLearningNode } = useKnowledge();
  const { setActive } = useTabs();

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

      <NodeDetailCard
        node={learningNode}
        variant="page"
        onClose={() => setActive('graph')}
        onJump={(nodeId) => {
          const next = graph?.nodes.find((node) => node.id === nodeId);
          if (next) setLearningNode(next);
        }}
      />
    </div>
  );
}
