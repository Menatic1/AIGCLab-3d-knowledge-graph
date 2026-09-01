import { useEffect, useState } from 'react';
import {
  Network, Plus, Sparkles, Upload, Trash2, Pencil, Check, X,
  Layers, Share2, Clock, FileText, BookOpen, AlertTriangle,
} from 'lucide-react';
import { useTabs } from '../context/TabContext';
import { useKnowledge, type GraphMeta } from '../context/KnowledgeContext';

const SOURCE_META: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  aigc:     { label: 'AIGC 生成',  color: 'from-sketch-pink to-sketch-orange',     icon: Sparkles },
  document: { label: '文档抽取',   color: 'from-sketch-blue to-sketch-blueDeep',  icon: FileText },
  sample:   { label: '示例图谱',   color: 'from-sketch-purple to-sketch-pink',     icon: BookOpen },
  default:  { label: '默认',       color: 'from-ink/40 to-ink/20',                  icon: Network },
};

export default function GraphListPage() {
  const { openTab } = useTabs();
  const { graphs, refreshGraphList, loadGraphById, deleteGraph, renameGraph, loadSampleGraph } = useKnowledge();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    refreshGraphList().finally(() => setLoading(false));
  }, [refreshGraphList]);

  const handleOpen = async (g: GraphMeta) => {
    setBusy(g.id);
    await loadGraphById(g.id);
    setBusy(null);
    openTab('graph');
  };

  const handleDelete = async (id: string) => {
    setBusy(id);
    try {
      await deleteGraph(id);
    } catch (e: any) {
      alert('删除失败：' + (e?.message || e));
    }
    setBusy(null);
    setConfirmDel(null);
  };

  const handleRename = async (id: string) => {
    setBusy(id);
    try {
      await renameGraph(id, editTitle.trim());
    } catch (e: any) {
      alert('改名失败：' + (e?.message || e));
    }
    setBusy(null);
    setEditingId(null);
  };

  const handleLoadSample = async () => {
    setBusy('sample');
    await loadSampleGraph();
    setBusy(null);
    refreshGraphList();
    openTab('graph');
  };

  const fmtTime = (s: string) => {
    try {
      return new Date(s).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return s;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 标题 + 操作 */}
      <div className="sketch-card p-5 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-sketch-blue/15 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-sketch-sm bg-gradient-to-br from-sketch-blue to-sketch-blueDeep shadow-sketch flex items-center justify-center border-2 border-white/60 rotate-[-3deg]">
              <Network size={24} className="text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink handwritten">我的知识图谱</h2>
              <p className="text-xs text-ink-light mt-0.5">
                {graphs.length > 0 ? `共 ${graphs.length} 份 · 每份独立存储，互不冲突` : '尚无图谱，点击右侧创建'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openTab('upload')}
              className="sketch-btn-secondary text-xs flex items-center gap-1.5"
            >
              <Upload size={14} /> 上传文档
            </button>
            <button
              onClick={() => openTab('aigc')}
              className="sketch-btn-warm text-xs flex items-center gap-1.5"
            >
              <Sparkles size={14} /> AIGC 生成
            </button>
            <button
              onClick={handleLoadSample}
              disabled={busy === 'sample'}
              className="sketch-btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> 加载示例
            </button>
          </div>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="sketch-card p-10 text-center text-sm text-ink-light">加载中…</div>
      ) : graphs.length === 0 ? (
        <div className="sketch-card p-10 text-center">
          <div className="mx-auto w-20 h-20 mb-4 rounded-sketch bg-gradient-to-br from-sketch-blue/20 to-sketch-purple/20 flex items-center justify-center border-2 border-ink/10 rotate-[-4deg]">
            <Network size={36} className="text-ink-light" />
          </div>
          <h3 className="text-lg font-bold text-ink handwritten mb-1">还没有任何图谱</h3>
          <p className="text-sm text-ink-light mb-5">每上传一份文档或用 AIGC 生成一个主题，都会独立保存为一份图谱。</p>
          <div className="flex justify-center gap-2 flex-wrap">
            <button onClick={() => openTab('upload')} className="sketch-btn-secondary text-xs flex items-center gap-1.5">
              <Upload size={14} /> 上传文档
            </button>
            <button onClick={() => openTab('aigc')} className="sketch-btn-warm text-xs flex items-center gap-1.5">
              <Sparkles size={14} /> AIGC 生成
            </button>
            <button onClick={handleLoadSample} className="sketch-btn-primary text-xs flex items-center gap-1.5">
              <Plus size={14} /> 加载示例图谱
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {graphs.map((g, i) => {
            const src = SOURCE_META[g.source] || SOURCE_META.default;
            const Icon = src.icon;
            const isEditing = editingId === g.id;
            const isConfirming = confirmDel === g.id;
            const isBusy = busy === g.id;
            return (
              <div
                key={g.id}
                className="sketch-card p-4 relative overflow-hidden hover:-translate-y-1 hover:shadow-sketch-lg transition-all duration-200 flex flex-col"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* 顶部：图标 + 来源标签 */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-sketch-sm bg-gradient-to-br ${src.color} shadow-sketch-sm flex items-center justify-center border-2 border-white/50 shrink-0`}>
                    <Icon size={18} className="text-white" strokeWidth={2.2} />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-paper-100 border border-ink/15 text-ink-light">
                    {src.label}
                  </span>
                </div>

                {/* 标题 */}
                {isEditing ? (
                  <div className="flex items-center gap-1 mb-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(g.id)}
                      autoFocus
                      className="flex-1 text-[14px] bg-paper-50 border-2 border-sketch-blue/40 rounded-sketch-sm px-2 py-1 focus:outline-none focus:border-sketch-blue"
                    />
                    <button onClick={() => handleRename(g.id)} disabled={isBusy} className="text-sketch-greenDeep hover:bg-sketch-green/10 p-1 rounded">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-ink-light hover:bg-ink/5 p-1 rounded">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <h3 className="text-[15px] font-bold text-ink handwritten mb-1 line-clamp-2">{g.title}</h3>
                )}

                {/* 描述 */}
                {g.description && (
                  <p className="text-[11px] text-ink-light line-clamp-2 mb-3">{g.description}</p>
                )}

                {/* 统计 */}
                <div className="flex items-center gap-3 mb-3 text-[11px] text-ink-light">
                  <span className="flex items-center gap-1">
                    <Layers size={12} /> {g.nodes_count} 节点
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 size={12} /> {g.relations_count} 关系
                  </span>
                </div>

                {/* 时间 */}
                <div className="flex items-center gap-1 text-[10px] text-ink-light/70 mb-3">
                  <Clock size={11} />
                  {fmtTime(g.updated_at || g.created_at)}
                </div>

                {/* 操作区 */}
                <div className="mt-auto flex items-center gap-2 pt-2 border-t border-ink/10">
                  {isConfirming ? (
                    <>
                      <AlertTriangle size={14} className="text-sketch-red shrink-0" />
                      <span className="text-[11px] text-ink-light flex-1">确认删除？</span>
                      <button
                        onClick={() => handleDelete(g.id)}
                        disabled={isBusy}
                        className="text-[11px] px-2 py-1 rounded-sketch-sm bg-sketch-red text-white border border-sketch-redDeep hover:opacity-80"
                      >
                        删除
                      </button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        className="text-[11px] px-2 py-1 rounded-sketch-sm bg-paper-100 border border-ink/15"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpen(g)}
                        disabled={isBusy || isEditing}
                        className="flex-1 text-[12px] py-1.5 rounded-sketch-sm bg-gradient-to-r from-sketch-blue to-sketch-purple text-white border-2 border-ink/10 shadow-sketch-sm hover:shadow-sketch flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Network size={13} /> {isBusy ? '加载中…' : '打开图谱'}
                      </button>
                      <button
                        onClick={() => { setEditingId(g.id); setEditTitle(g.title); }}
                        disabled={isBusy}
                        className="p-1.5 rounded-sketch-sm bg-paper-100 border border-ink/15 hover:bg-paper-200 text-ink-light"
                        title="改名"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmDel(g.id)}
                        disabled={isBusy}
                        className="p-1.5 rounded-sketch-sm bg-paper-100 border border-sketch-red/20 hover:bg-sketch-red/10 text-sketch-red"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
