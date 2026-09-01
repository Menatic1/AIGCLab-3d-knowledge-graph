import { Sparkles, ArrowRight, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { useKnowledge } from '../../context/KnowledgeContext';
import { CATEGORY_META } from '../../mock/sampleKnowledgeGraph';
import type { PathRecommendation } from '../../types';

interface Props {
  onFocusNode?: (id: string) => void;
}

export default function PathRecommendation({ onFocusNode }: Props) {
  const { graph, recommendations, masteredIds, markAsMastered, regenerateRecommendations } = useKnowledge();
  if (!graph) return null;

  const masteredCount = masteredIds.size;
  const totalCount = graph.nodes.length;
  const pct = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);

  // 取前 10 条展示
  const topList = recommendations.slice(0, 10);

  return (
    <div className="sketch-card p-5 h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-full bg-sketch-orange/20 flex items-center justify-center">
              <Sparkles size={15} className="text-sketch-orangeDeep" />
            </div>
            <h3 className="font-bold text-ink handwritten text-lg">下一步学习推荐</h3>
          </div>
          <p className="text-[12px] text-ink-light leading-snug max-w-md">
            基于「前置关系」图遍历算法：
            <br />
            已掌握节点 → 寻找前置已满足的候选 → 按前置满足率 × 重要性排序。
          </p>
        </div>
        <button
          onClick={regenerateRecommendations}
          className="sketch-btn-warm text-xs !py-1.5"
        >
          <Sparkles size={13} /> 重新计算
        </button>
      </div>

      {/* 进度总览 */}
      <div className="sketch-card !bg-paper-100/60 border-sketch-blue/30 p-3.5 mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-ink-light flex items-center gap-1">
            <BookOpen size={13} /> 当前章节掌握进度
          </span>
          <span className="handwritten font-bold text-sketch-orangeDeep text-lg">
            {masteredCount} / {totalCount} · {pct}%
          </span>
        </div>
        <div className="relative h-4 bg-paper-50 border border-ink/15 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sketch-green via-sketch-yellow to-sketch-orange transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,transparent_0_8px,rgba(255,255,255,0.3)_8px_16px)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 推荐列表 */}
      {topList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-10">
          <div>
            <div className="w-16 h-16 mx-auto mb-3 rounded-sketch bg-sketch-green/20 flex items-center justify-center border-2 border-dashed border-sketch-green/50">
              <CheckCircle size={32} className="text-sketch-greenDeep" />
            </div>
            <div className="font-bold text-ink handwritten text-lg mb-1">🎉 全部掌握！</div>
            <p className="text-sm text-ink-light">
              本章所有知识点你都已掌握，可以去学习下一章啦～
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto scrollbar-sketch pr-1 space-y-2">
          <div className="text-[11px] text-ink-light flex items-center gap-1.5 px-1 mb-1">
            <span>📋</span> 共为你推荐 <b className="text-sketch-orangeDeep">{recommendations.length}</b> 个后续可学知识点，按优先级排序如下
          </div>
          {topList.map((r, i) => (
            <RecRow
              key={r.nodeId}
              idx={i}
              rec={r}
              graph={graph}
              onFocus={onFocusNode}
              onMaster={() => markAsMastered(r.nodeId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecRow({
  idx,
  rec,
  graph,
  onFocus,
  onMaster,
}: {
  idx: number;
  rec: PathRecommendation;
  graph: NonNullable<ReturnType<typeof useKnowledge>['graph']>;
  onFocus?: (id: string) => void;
  onMaster: () => void;
}) {
  const node = graph.nodes.find((n) => n.id === rec.nodeId);
  if (!node) return null;
  const cat = CATEGORY_META[node.category];
  const totalPres = rec.satisfiedPrerequisites.length + rec.missingPrerequisites.length;
  const ready = totalPres === 0 || rec.missingPrerequisites.length === 0;

  return (
    <div className="group relative bg-paper-50 rounded-sketch-sm border-2 border-ink/10 p-3 hover:border-sketch-blue/40 hover:bg-white hover:-translate-y-0.5 hover:shadow-sketch-sm transition-all">
      <div className="flex items-start gap-3">
        {/* 排名徽章 */}
        <div
          className={
            'shrink-0 w-9 h-9 rounded-sketch-sm flex items-center justify-center font-bold handwritten text-lg border-2 border-white shadow-sm ' +
            (idx === 0
              ? 'bg-gradient-to-br from-sketch-red to-sketch-orange text-white'
              : idx < 3
                ? 'bg-gradient-to-br from-sketch-orange to-sketch-yellow text-white'
                : 'bg-paper-200 text-ink border-ink/20')
          }
        >
          {rec.learningOrder}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              onClick={() => onFocus?.(rec.nodeId)}
              className="font-bold text-[14px] text-ink hover:text-sketch-blueDeep underline decoration-dotted decoration-sketch-blue/50 underline-offset-2"
            >
              {node.name}
            </button>
            <span
              className="sketch-tag text-[10px] !px-1.5 !py-0 items-center gap-1"
              style={{ background: cat.bgColor, color: cat.color, borderColor: cat.color + '55' }}
            >
              {cat.label}
            </span>
            {ready ? (
              <span className="sketch-tag bg-sketch-green/15 text-sketch-greenDeep border-sketch-green/30 text-[10px] items-center gap-1">
                <CheckCircle size={10} /> 前置就绪
              </span>
            ) : (
              <span className="sketch-tag bg-sketch-orange/15 text-sketch-orangeDeep border-sketch-orange/30 text-[10px] items-center gap-1">
                <AlertCircle size={10} /> 部分前置未学
              </span>
            )}
            <span className="ml-auto text-[11px] text-ink-soft">
              前置 {rec.satisfiedPrerequisites.length}/{totalPres || '—'}
            </span>
          </div>
          <p className="text-[11.5px] text-ink-light leading-snug line-clamp-2 mb-1.5">
            {node.description}
          </p>
          {/* 前置满足条 */}
          {totalPres > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {rec.satisfiedPrerequisites.map((pid) => {
                const p = graph.nodes.find((x) => x.id === pid);
                return p ? (
                  <span
                    key={pid}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-sketch-green/15 text-sketch-greenDeep border border-sketch-green/30"
                  >
                    ✓ {p.name}
                  </span>
                ) : null;
              })}
              {rec.missingPrerequisites.map((pid) => {
                const p = graph.nodes.find((x) => x.id === pid);
                return p ? (
                  <span
                    key={pid}
                    onClick={() => onFocus?.(pid)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-sketch-orange/15 text-sketch-orangeDeep border border-sketch-orange/30 cursor-pointer hover:underline"
                  >
                    ✗ {p.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col gap-1.5">
          <button
            onClick={onMaster}
            className="sketch-btn-success text-[11px] !py-1 !px-2.5"
            title="标记为已掌握"
          >
            <CheckCircle size={12} /> 学会了
          </button>
          <button
            onClick={() => onFocus?.(rec.nodeId)}
            className="sketch-btn-secondary text-[11px] !py-1 !px-2.5"
            title="查看详情"
          >
            <ArrowRight size={12} /> 去学
          </button>
        </div>
      </div>
    </div>
  );
}
