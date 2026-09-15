import { useTabs } from '../context/TabContext';
import { CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import KnowledgeChecklist from '../components/learning-path/KnowledgeChecklist';
import PathRecommendation from '../components/learning-path/PathRecommendation';
import PathVisualization from '../components/learning-path/PathVisualization';
import { useKnowledge } from '../context/KnowledgeContext';

export default function LearningPathPage() {
  const { hasGraph, graph, masteredIds, recommendations, setLearningNode } = useKnowledge();
  const { openTab } = useTabs();

  const handleFocusNode = (id: string) => {
    const node = graph?.nodes.find((item) => item.id === id);
    if (!node) return;
    setLearningNode(node);
    openTab('learning');
  };

  const handleStartQuiz = (id: string) => {
    const node = graph?.nodes.find((item) => item.id === id);
    if (!node) return;
    setLearningNode(node);
    openTab('quiz');
  };

  if (!hasGraph || !graph) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <div className="sketch-card p-10 max-w-lg text-center">
          <h2 className="text-2xl font-bold text-ink handwritten mb-2">暂无图谱</h2>
          <p className="text-sm text-ink-light mb-6">请先上传文档或加载示例图谱</p>
          <button onClick={() => openTab('upload')} className="sketch-btn-primary">
            去上传文档
          </button>
        </div>
      </div>
    );
  }

  const topCount = Math.min(3, recommendations.length);
  const readyCount = recommendations.filter(
    (r) =>
      r.missingPrerequisites.length === 0 ||
      (r.satisfiedPrerequisites.length /
        (r.satisfiedPrerequisites.length + r.missingPrerequisites.length || 1)) >= 0.5
  ).length;
  const progress = graph.nodes.length > 0 ? Math.round((masteredIds.size / graph.nodes.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 min-h-full pb-6">
      {/* 顶部：标题 + 统计 + 进度条 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-ink handwritten mb-1.5">
            学习路径
          </h2>
          <div className="w-[280px] max-w-full">
            <div className="flex justify-between text-[11px] text-ink-light mb-1">
              <span>总体进度</span>
              <span className="font-bold text-sketch-greenDeep handwritten">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-paper-200 overflow-hidden border border-ink/10">
              <div
                className="h-full bg-gradient-to-r from-sketch-green via-sketch-blue to-sketch-purple transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <QuickStat
            label="已掌握"
            value={`${masteredIds.size}`}
            sub={`共 ${graph.nodes.length}`}
            color="green"
            icon={<CheckCircle2 size={15} />}
          />
          <QuickStat
            label="可学"
            value={`${readyCount}`}
            sub="就绪 / 半就绪"
            color="orange"
            icon={<Zap size={15} />}
          />
          <QuickStat
            label="推荐"
            value={`Top ${topCount}`}
            sub="点击「学会了」推进"
            color="purple"
            icon={<ArrowRight size={15} />}
          />
        </div>
      </div>

      {/* 上方两个工作框，页面整体负责纵向滚动 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <div className="h-[620px] min-h-0">
          <KnowledgeChecklist autoFocus={handleFocusNode} />
        </div>
        <div className="h-[620px] min-h-0">
          <PathRecommendation onFocusNode={handleFocusNode} onStartQuiz={handleStartQuiz} />
        </div>
      </div>

      {/* 下方全宽可视化框，内容完整展开 */}
      <div>
        <PathVisualization onFocusNode={handleFocusNode} />
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  color: 'green' | 'orange' | 'purple';
  icon: React.ReactNode;
}) {
  const palette: Record<string, string> = {
    green:  'from-sketch-green/20  to-sketch-green/5  text-sketch-greenDeep border-sketch-green/30',
    orange: 'from-sketch-orange/20 to-sketch-orange/5 text-sketch-orangeDeep border-sketch-orange/30',
    purple: 'from-sketch-purple/20 to-sketch-purple/5 text-sketch-purple      border-sketch-purple/40',
  };
  return (
    <div
      className={
        'flex items-center gap-2.5 px-3.5 py-2 rounded-sketch-sm border-2 shadow-sketch-sm bg-gradient-to-br ' +
        palette[color]
      }
    >
      <div className="w-8 h-8 rounded-sketch-sm bg-white/70 flex items-center justify-center border border-white/80">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
        <div className="text-lg font-bold handwritten leading-tight">{value}</div>
        <div className="text-[10px] opacity-80 leading-tight">{sub}</div>
      </div>
    </div>
  );
}
