import { useMemo, useState } from 'react';
import {
  Search, BookOpen, Link2, ArrowRight, Loader2, Sparkles, ExternalLink,
  Video, FileText, Pencil, Wrench, GraduationCap, BookMarked,
} from 'lucide-react';
import { useKnowledge } from '../context/KnowledgeContext';
import { CATEGORY_META } from '../mock/sampleKnowledgeGraph';
import { API_BASE } from '../lib/graphMap';
import { authedFetch } from '../context/AuthContext';
import type { KnowledgeNode } from '../types';

interface ResItem {
  type: string;
  title: string;
  reason: string;
  url: string;
}
interface SuggestResult {
  items: ResItem[];
  summary: string;
  used_llm: boolean;
}

const TYPE_ICON: Record<string, any> = {
  教材章节: BookMarked,
  视频课程: Video,
  图文教程: FileText,
  练习实践: Pencil,
  拓展阅读: GraduationCap,
  '工具/平台': Wrench,
  工具: Wrench,
};

export default function LearningResourcesPage() {
  const { graph, hasGraph } = useKnowledge();
  const [kw, setKw] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggest, setSuggest] = useState<SuggestResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const nodes = graph?.nodes ?? [];
  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return nodes;
    return nodes.filter((n) => n.name.toLowerCase().includes(k) || (n.description || '').toLowerCase().includes(k));
  }, [kw, nodes]);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  // 关联节点计算
  const { pres, nexts, related } = useMemo(() => {
    if (!graph || !selected) return { pres: [] as KnowledgeNode[], nexts: [] as KnowledgeNode[], related: [] as KnowledgeNode[] };
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const pres: KnowledgeNode[] = [];
    const nexts: KnowledgeNode[] = [];
    const related: KnowledgeNode[] = [];
    const relSet = new Set<string>();
    graph.relations.forEach((r) => {
      if (r.target === selected.id && r.type === 'prerequisite') {
        const n = byId.get(r.source); if (n) pres.push(n);
      } else if (r.source === selected.id && r.type === 'prerequisite') {
        const n = byId.get(r.target); if (n) nexts.push(n);
      } else if (r.source === selected.id || r.target === selected.id) {
        const otherId = r.source === selected.id ? r.target : r.source;
        const n = byId.get(otherId);
        if (n && !relSet.has(otherId)) { relSet.add(otherId); related.push(n); }
      }
    });
    return { pres, nexts, related };
  }, [graph, selected]);

  async function genSuggest(node: KnowledgeNode) {
    setLoading(true);
    setErr(null);
    setSuggest(null);
    try {
      const resp = await authedFetch(`${API_BASE}/api/aigc/resources/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_name: node.name,
          category: CATEGORY_META[node.category]?.label ?? node.category,
          description: node.description,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || `请求失败 (${resp.status})`);
      setSuggest(data);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function pickNode(id: string) {
    setSelectedId(id);
    setSuggest(null);
    setErr(null);
  }

  if (!hasGraph || !graph) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="sketch-card p-8 max-w-md text-center">
          <BookOpen size={40} className="text-sketch-greenDeep mx-auto mb-3" />
          <h2 className="text-xl font-bold text-ink handwritten mb-2">暂无图谱</h2>
          <p className="text-sm text-ink-light">请先在「AIGC 生成图谱」或「文档上传」生成知识图谱后查看学习资源。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[520px]">
      {/* 左侧节点列表 */}
      <div className="w-72 shrink-0 sketch-card flex flex-col overflow-hidden">
        <div className="p-3 border-b-2 border-ink/10">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-sketch-sm bg-paper-100 border border-ink/10">
            <Search size={14} className="text-ink-light shrink-0" />
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索知识点…"
              className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-ink-light"
            />
          </div>
          <div className="text-[11px] text-ink-light mt-1.5 px-1">{filtered.length} 个知识点</div>
        </div>
        <div className="flex-1 overflow-auto scrollbar-sketch py-1">
          {filtered.map((n) => {
            const cat = CATEGORY_META[n.category];
            const active = n.id === selectedId;
            return (
              <button
                key={n.id}
                onClick={() => pickNode(n.id)}
                className={
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ' +
                  (active ? 'bg-sketch-green/15 border-l-4 border-sketch-greenDeep' : 'hover:bg-paper-100 border-l-4 border-transparent')
                }
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat?.color ?? '#999' }} />
                <span className={'text-[13px] truncate ' + (active ? 'font-bold text-ink' : 'text-ink-light')}>{n.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className="flex-1 min-w-0 sketch-card overflow-auto scrollbar-sketch">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-ink-light text-sm">
            <div className="text-center">
              <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
              从左侧选择一个知识点查看学习资源
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* 节点头 */}
            <div className="sketch-card p-4" style={{ background: `${CATEGORY_META[selected.category]?.color}15` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="sketch-tag text-[11px] border-ink/20" style={{ background: '#fff8' }}>
                  {CATEGORY_META[selected.category]?.label ?? selected.category}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={'text-[12px] ' + (i < selected.importance ? 'text-sketch-orange' : 'text-ink/20')}>★</span>
                  ))}
                </div>
              </div>
              <h3 className="text-xl font-bold text-ink handwritten">{selected.name}</h3>
              <p className="text-[13px] text-ink-light mt-1 leading-relaxed">{selected.description}</p>
            </div>

            {/* 前置 / 后续 / 相关 */}
            {(pres.length > 0 || nexts.length > 0 || related.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RelBox title="前置知识" color="orange" nodes={pres} onPick={pickNode} />
                <RelBox title="后续知识" color="green" nodes={nexts} onPick={pickNode} />
                <RelBox title="相关节点" color="blue" nodes={related} onPick={pickNode} />
              </div>
            )}

            {/* 节点自带资源 */}
            {selected.resources && selected.resources.length > 0 && (
              <Section icon={<ExternalLink size={14} className="text-sketch-purple" />} title="知识点附带资源">
                <ul className="space-y-1.5">
                  {selected.resources.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px] px-3 py-2 bg-paper-100 rounded-sketch-sm border border-ink/10">
                      <span className="w-1 h-4 bg-sketch-purple/60 rounded-sm" />
                      <span className="flex-1 text-ink">{r.title}</span>
                      {r.url && r.url !== '#' && <a href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={12} className="text-sketch-purple" /></a>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* AI 学习建议 */}
            <Section icon={<Sparkles size={14} className="text-sketch-pink" />} title="AI 学习资源建议">
              {!suggest && !loading && (
                <button onClick={() => genSuggest(selected)} className="sketch-btn-warm text-xs">
                  <Sparkles size={14} /> 生成 AI 学习建议
                </button>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-ink-light">
                  <Loader2 size={16} className="animate-spin" /> 大模型生成中…
                </div>
              )}
              {err && (
                <div className="text-[13px] text-sketch-red bg-sketch-red/5 border border-sketch-red/30 rounded-sketch-sm p-2.5">
                  {err}
                </div>
              )}
              {suggest && (
                <div className="space-y-2">
                  {suggest.summary && <div className="text-[12px] text-ink-light bg-paper-100 rounded-sketch-sm p-2 border border-ink/10">{suggest.summary}</div>}
                  <ul className="space-y-1.5">
                    {suggest.items.map((it, i) => {
                      const Icon = TYPE_ICON[it.type] ?? BookOpen;
                      return (
                        <li key={i} className="flex items-start gap-2.5 px-3 py-2 bg-paper-100 rounded-sketch-sm border border-ink/10 hover:border-sketch-blue/40 transition-colors">
                          <Icon size={15} className="text-sketch-blueDeep mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="sketch-tag text-[10px] bg-sketch-blue/10 text-sketch-blueDeep border-sketch-blue/30">{it.type}</span>
                              <span className="text-[13px] font-medium text-ink">{it.title}</span>
                              {it.url && (
                                <a href={it.url} target="_blank" rel="noreferrer" className="text-sketch-blue hover:underline text-[11px]">打开 ↗</a>
                              )}
                            </div>
                            {it.reason && <div className="text-[12px] text-ink-light mt-0.5">{it.reason}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button onClick={() => genSuggest(selected)} className="sketch-btn-secondary text-xs mt-1">
                    <Sparkles size={12} /> 重新生成
                  </button>
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function RelBox({ title, color, nodes, onPick }: { title: string; color: 'orange' | 'green' | 'blue'; nodes: KnowledgeNode[]; onPick: (id: string) => void }) {
  if (nodes.length === 0) return null;
  const palette = {
    orange: 'bg-sketch-orange/10 text-sketch-orangeDeep border-sketch-orange/30',
    green: 'bg-sketch-green/10 text-sketch-greenDeep border-sketch-green/30',
    blue: 'bg-sketch-blue/10 text-sketch-blueDeep border-sketch-blue/30',
  }[color];
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink mb-1.5">
        <Link2 size={12} className="text-ink-light" /> {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {nodes.map((n) => (
          <button key={n.id} onClick={() => onPick(n.id)} className={'sketch-tag text-[11px] hover:-translate-y-0.5 transition-transform ' + palette}>
            {n.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="flex items-center gap-1.5 font-bold text-ink mb-2 text-sm">{icon} {title}</h4>
      {children}
    </div>
  );
}

// 保留 ArrowRight 引用以避免 tree-shake 误删（未来可扩展）
void ArrowRight;
