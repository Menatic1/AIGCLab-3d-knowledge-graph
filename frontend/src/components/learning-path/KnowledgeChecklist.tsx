import { useMemo, useState } from 'react';
import { Search, CheckSquare, Square, Filter, Star, BookOpenCheck } from 'lucide-react';
import { useKnowledge } from '../../context/KnowledgeContext';
import { CATEGORY_META } from '../../mock/sampleKnowledgeGraph';

interface Props {
  autoFocus?: (id: string) => void;
}

export default function KnowledgeChecklist({ autoFocus }: Props) {
  const { graph, masteredIds, toggleMastered } = useKnowledge();
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [onlyMastered, setOnlyMastered] = useState<null | boolean>(null); // null=全部 true=已掌握 false=未掌握

  const nodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes
      .filter((n) => {
        if (categoryFilter && n.category !== categoryFilter) return false;
        if (onlyMastered === true && !masteredIds.has(n.id)) return false;
        if (onlyMastered === false && masteredIds.has(n.id)) return false;
        if (keyword.trim()) {
          const k = keyword.trim().toLowerCase();
          return (
            n.name.toLowerCase().includes(k) ||
            n.description.toLowerCase().includes(k) ||
            n.definition.toLowerCase().includes(k)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // 按重要性降序
        if (b.importance !== a.importance) return b.importance - a.importance;
        // 未掌握的优先展示
        const am = masteredIds.has(a.id) ? 1 : 0;
        const bm = masteredIds.has(b.id) ? 1 : 0;
        return am - bm;
      });
  }, [graph, keyword, categoryFilter, onlyMastered, masteredIds]);

  if (!graph) return null;

  return (
    <div className="flex flex-col h-full min-h-0 sketch-card overflow-hidden">
      {/* 头部 */}
      <div className="px-4 py-3 border-b-2 border-ink/10 bg-gradient-to-r from-sketch-green/10 via-paper-100 to-sketch-yellow/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-sketch-green/30 flex items-center justify-center">
            <BookOpenCheck size={15} className="text-sketch-greenDeep" />
          </div>
          <h3 className="font-bold text-ink handwritten">知识点掌握清单</h3>
          <span className="text-[11px] sketch-tag bg-paper-200 border-ink/20 text-ink-light ml-auto">
            显示 {nodes.length}/{graph.nodes.length}
          </span>
        </div>

        <div className="space-y-2">
          {/* 搜索 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索知识点名称/描述..."
              className="sketch-input pl-9 !py-2 text-sm"
            />
          </div>
          {/* 筛选器 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter size={12} className="text-ink-light shrink-0" />
            <button
              onClick={() => setCategoryFilter(null)}
              className={
                'sketch-tag text-[11px] !px-2 !py-0.5 ' +
                (categoryFilter === null
                  ? 'bg-ink text-paper-50 border-ink'
                  : 'bg-paper-100 border-ink/15 text-ink hover:bg-paper-200')
              }
            >
              全部分类
            </button>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setCategoryFilter(categoryFilter === k ? null : k)}
                className={
                  'sketch-tag text-[11px] !px-2 !py-0.5 items-center gap-1 border-ink/15'
                }
                style={{
                  background: categoryFilter === k ? v.color : v.bgColor,
                  color: categoryFilter === k ? '#fff' : v.color,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: categoryFilter === k ? '#fff' : v.color }}
                />
                {v.label}
              </button>
            ))}
            <div className="w-px h-4 bg-ink/15 mx-1" />
            <button
              onClick={() => setOnlyMastered(onlyMastered === false ? null : false)}
              className={
                'sketch-tag text-[11px] !px-2 !py-0.5 items-center gap-1 ' +
                (onlyMastered === false
                  ? 'bg-sketch-orange text-white border-sketch-orangeDeep'
                  : 'bg-paper-100 border-ink/15 text-ink hover:bg-paper-200')
              }
            >
              <Square size={10} /> 未掌握
            </button>
            <button
              onClick={() => setOnlyMastered(onlyMastered === true ? null : true)}
              className={
                'sketch-tag text-[11px] !px-2 !py-0.5 items-center gap-1 ' +
                (onlyMastered === true
                  ? 'bg-sketch-green text-white border-sketch-greenDeep'
                  : 'bg-paper-100 border-ink/15 text-ink hover:bg-paper-200')
              }
            >
              <CheckSquare size={10} /> 已掌握
            </button>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-sketch p-3 space-y-2">
        {nodes.length === 0 && (
          <div className="py-12 text-center text-ink-light text-sm">
            📭 没有匹配的知识点，试试其他筛选条件
          </div>
        )}
        {nodes.map((n) => {
          const checked = masteredIds.has(n.id);
          const cat = CATEGORY_META[n.category];
          return (
            <button
              key={n.id}
              onClick={() => toggleMastered(n.id)}
              className={
                'w-full text-left group relative flex items-start gap-2.5 p-3 rounded-sketch-sm border-2 transition-all ' +
                (checked
                  ? 'bg-sketch-green/10 border-sketch-green/40 hover:bg-sketch-green/15'
                  : 'bg-paper-50 border-ink/10 hover:border-sketch-blue/40 hover:bg-white hover:-translate-y-0.5 hover:shadow-sketch-sm')
              }
            >
              <div
                className={
                  'mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ' +
                  (checked
                    ? 'bg-sketch-green border-sketch-greenDeep text-white'
                    : 'bg-white border-ink/30 group-hover:border-sketch-blueDeep text-transparent')
                }
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      'font-semibold text-[13.5px] leading-tight ' +
                      (checked ? 'line-through text-sketch-greenDeep decoration-sketch-greenDeep/60 decoration-2' : 'text-ink')
                    }
                  >
                    {n.name}
                  </span>
                  <span
                    className="sketch-tag text-[10px] !px-1.5 !py-0 items-center gap-1"
                    style={{ background: cat.bgColor, color: cat.color, borderColor: cat.color + '55' }}
                  >
                    {cat.label}
                  </span>
                  <span className="ml-auto flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={9}
                        fill={i < n.importance ? '#d18040' : 'none'}
                        className={i < n.importance ? 'text-sketch-orangeDeep' : 'text-ink-soft'}
                      />
                    ))}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-light leading-snug line-clamp-2">
                  {n.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
