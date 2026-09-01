import { useMemo } from 'react';
import { Route, CheckCircle2, Circle, Flag, Sparkles } from 'lucide-react';
import { useKnowledge } from '../../context/KnowledgeContext';
import { CATEGORY_META } from '../../mock/sampleKnowledgeGraph';
import type { PathStage } from '../../types';

interface Props {
  onFocusNode?: (id: string) => void;
}

// 根据前置关系构建最长路径（用于主时间线）
function buildMainLine(
  graph: NonNullable<ReturnType<typeof useKnowledge>['graph']>,
  stages: PathStage[],
  mastered: Set<string>,
) {
  // 主时间线：stages 每个阶段内按 recommendation 顺序取前若干个，构成一个建议路径
  const chain: { id: string; stage: number; mastered: boolean }[] = [];
  stages.forEach((s, sIdx) => {
    const ids = s.nodeIds.slice(0, sIdx === 0 ? 4 : 3); // 阶段1取稍多
    ids.forEach((id) => {
      chain.push({ id, stage: s.stage, mastered: mastered.has(id) });
    });
  });
  return chain;
}

export default function PathVisualization({ onFocusNode }: Props) {
  const { graph, pathStages, masteredIds, recommendations } = useKnowledge();
  const chain = useMemo(() => {
    if (!graph) return [];
    return buildMainLine(graph, pathStages, masteredIds);
  }, [graph, pathStages, masteredIds]);

  if (!graph) return null;

  const masteredCount = masteredIds.size;

  return (
    <div className="sketch-card p-5 h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-full bg-sketch-purple/20 flex items-center justify-center">
              <Route size={15} className="text-sketch-purple" />
            </div>
            <h3 className="font-bold text-ink handwritten text-lg">可视化学习路径</h3>
          </div>
          <p className="text-[12px] text-ink-light leading-snug">
            将推荐结果按学习难度与依赖关系划分为 3 阶段，逐步推进；点击节点可查看详情。
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {pathStages.map((s) => (
            <span
              key={s.stage}
              className={
                'sketch-tag text-[11px] items-center gap-1 ' +
                (s.stage === 1
                  ? 'bg-sketch-green/15 text-sketch-greenDeep border-sketch-green/40'
                  : s.stage === 2
                    ? 'bg-sketch-orange/15 text-sketch-orangeDeep border-sketch-orange/40'
                    : 'bg-sketch-purple/15 text-sketch-purple border-sketch-purple/40')
              }
            >
              阶段{s.stage} · {s.nodeIds.length}个
            </span>
          ))}
        </div>
      </div>

      {chain.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="w-16 h-16 mx-auto mb-3 rounded-sketch bg-sketch-yellow/20 flex items-center justify-center">
              <Sparkles size={30} className="text-sketch-orangeDeep" />
            </div>
            <div className="font-bold text-ink handwritten">推荐路径即将生成</div>
            <p className="text-sm text-ink-light mt-1">在左侧勾选已掌握知识点，系统会自动计算你的最佳学习顺序～</p>
          </div>
        </div>
      ) : (
        <>
          {/* 横向时间线：阶段分组 + 节点链条 */}
          <div className="relative flex-1 min-h-0 overflow-auto scrollbar-sketch">
            <div className="min-w-[780px] p-3 pb-6 relative">
              {/* 背景轨道 */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                <defs>
                  <marker id="arr_head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#d18040" />
                  </marker>
                </defs>
              </svg>

              <div className="flex items-stretch gap-4 relative">
                {pathStages.map((stage, stageIdx) => {
                  const stageNodes = chain.filter((c) => c.stage === stage.stage);
                  const stageMeta =
                    stage.stage === 1
                      ? { bg: 'from-sketch-green/20 via-sketch-green/5', header: 'bg-sketch-green text-white', border: 'border-sketch-green/40' }
                      : stage.stage === 2
                        ? { bg: 'from-sketch-orange/20 via-sketch-orange/5', header: 'bg-sketch-orange text-white', border: 'border-sketch-orange/40' }
                        : { bg: 'from-sketch-purple/20 via-sketch-purple/5', header: 'bg-sketch-purple text-white', border: 'border-sketch-purple/40' };

                  return (
                    <div key={stage.stage} className="flex-1 min-w-[220px]">
                      {/* 阶段标题 */}
                      <div
                        className={
                          'flex items-center gap-2 px-3 py-2 rounded-sketch-sm border-2 shadow-sketch-sm ' +
                          stageMeta.border + ' bg-gradient-to-br ' + stageMeta.bg
                        }
                      >
                        <div
                          className={
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold handwritten ' +
                            stageMeta.header
                          }
                        >
                          {stage.stage}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-ink leading-tight">{stage.title}</div>
                          <div className="text-[10px] text-ink-light leading-tight">
                            包含 {stage.nodeIds.length} 个知识点
                          </div>
                        </div>
                        {stageIdx === pathStages.length - 1 ? (
                          <Flag size={14} className="text-sketch-orangeDeep" />
                        ) : (
                          <div className="text-sketch-orangeDeep animate-pulse">
                            ➜
                          </div>
                        )}
                      </div>

                      {/* 阶段内节点 - 竖向连线 */}
                      <div className="mt-4 relative">
                        <div className="absolute left-5 top-1 bottom-1 w-0.5 bg-gradient-to-b from-sketch-yellow via-sketch-orange to-sketch-red opacity-50" />
                        <div className="space-y-3">
                          {stageNodes.map((c) => {
                            const n = graph.nodes.find((x) => x.id === c.id);
                            if (!n) return null;
                            const cat = CATEGORY_META[n.category];
                            const rank = recommendations.findIndex((r) => r.nodeId === c.id) + 1;
                            return (
                              <button
                                key={c.id}
                                onClick={() => onFocusNode?.(c.id)}
                                className="relative w-full flex items-center gap-3 text-left group"
                              >
                                {/* 左侧圆点 */}
                                <div
                                  className={
                                    'relative z-10 w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 border-white shadow-sketch-sm transition-all group-hover:scale-110 ' +
                                    (c.mastered
                                      ? 'bg-gradient-to-br from-sketch-green to-sketch-greenDeep'
                                      : '')
                                  }
                                  style={
                                    !c.mastered
                                      ? { background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` }
                                      : undefined
                                  }
                                >
                                  {c.mastered ? (
                                    <CheckCircle2 size={18} className="text-white" />
                                  ) : (
                                    <Circle size={16} className="text-white" strokeWidth={2.5} />
                                  )}
                                </div>

                                {/* 卡片 */}
                                <div
                                  className={
                                    'flex-1 rounded-sketch-sm border-2 p-2.5 bg-paper-50 shadow-sketch-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-sketch group-hover:border-sketch-blue/40 ' +
                                    stageMeta.border
                                  }
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[13px] text-ink leading-tight">
                                      {n.name}
                                    </span>
                                    {rank > 0 && (
                                      <span className="text-[10px] sketch-tag bg-sketch-orange/15 text-sketch-orangeDeep border-sketch-orange/30 !py-0">
                                        优先级 #{rank}
                                      </span>
                                    )}
                                    <span
                                      className="ml-auto text-[10px] sketch-tag !py-0 items-center gap-1"
                                      style={{ background: cat.bgColor, color: cat.color, borderColor: cat.color + '55' }}
                                    >
                                      {cat.label}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-ink-light leading-snug mt-1 line-clamp-1">
                                    {n.description}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 底部里程碑 */}
              <div className="mt-6 flex items-center justify-center gap-4 pt-4 border-t-2 border-dashed border-ink/15">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-light">
                  <span className="w-3 h-3 rounded-full bg-gradient-to-br from-sketch-green to-sketch-greenDeep border-2 border-white shadow-sm" />
                  已掌握 ({masteredCount})
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-light">
                  <span className="w-3 h-3 rounded-full border-2 border-sketch-orangeDeep bg-sketch-orange/20 shadow-sm" />
                  待学习
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-light">
                  <span className="w-4 h-0.5 bg-gradient-to-r from-sketch-yellow to-sketch-orange" />
                  学习递进方向 →
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
