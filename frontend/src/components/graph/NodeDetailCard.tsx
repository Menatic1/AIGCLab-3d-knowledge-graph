import { useState, useEffect } from 'react';
import { X, BookOpen, Link2, CheckCircle2, CircleDot, ExternalLink, Star, Tag, Play, Loader2, Search } from 'lucide-react';
import type { KnowledgeNode } from '../../types';
import { CATEGORY_META } from '../../mock/sampleKnowledgeGraph';
import { useKnowledge } from '../../context/KnowledgeContext';
import { authedFetch } from '../../context/AuthContext';
import { API_BASE } from '../../lib/graphMap';

interface BiliVideo {
  bvid: string;
  title: string;
  author: string;
  play: number;
  danmaku: number;
  favorites: number;
  pic: string;
  duration: string;
  url: string;
}

interface Props {
  node: KnowledgeNode | null;
  onClose: () => void;
  onJump?: (nodeId: string) => void;
  relatedNodes?: KnowledgeNode[];
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}

export default function NodeDetailCard({ node, onClose, onJump, relatedNodes = [] }: Props) {
  const { masteredIds, toggleMastered, graph } = useKnowledge();

  // B站视频搜索
  const [videos, setVideos] = useState<BiliVideo[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState('');

  useEffect(() => {
    if (!node) return;
    let cancelled = false;
    setVideoLoading(true);
    setVideos([]);
    setFallbackUrl('');
    authedFetch(`${API_BASE}/api/aigc/bilibili-videos?keyword=${encodeURIComponent(node.name)}&limit=6`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setVideos(data.videos || []);
        setFallbackUrl(data.fallback_url || '');
      })
      .catch(() => {})
      .finally(() => !cancelled && setVideoLoading(false));
    return () => { cancelled = true; };
  }, [node?.id]);

  if (!node) return null;
  const mastered = masteredIds.has(node.id);
  const cat = CATEGORY_META[node.category];

  // 收集前置关系节点
  const pres = graph
    ? graph.relations
        .filter((r) => r.target === node.id && r.type === 'prerequisite')
        .map((r) => graph.nodes.find((n) => n.id === r.source)!)
        .filter(Boolean)
    : [];
  const nexts = graph
    ? graph.relations
        .filter((r) => r.source === node.id && r.type === 'prerequisite')
        .map((r) => graph.nodes.find((n) => n.id === r.target)!)
        .filter(Boolean)
    : [];

  return (
    <div className="absolute top-0 right-0 bottom-0 z-20 w-[380px] max-w-[90vw] bg-paper-50 border-l-2 border-ink/15 shadow-[-4px_0_0_rgba(59,51,43,0.06)] animate-pencil-in flex flex-col">
      {/* 头部颜色带 */}
      <div
        className="relative px-5 py-4 text-white border-b-2 border-ink/15"
        style={{
          background: `linear-gradient(135deg, ${cat.color}ee, ${cat.color}cc 60%, ${cat.color}99)`,
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 border border-white/40 flex items-center justify-center backdrop-blur-sm transition-colors"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="sketch-tag text-xs border-white/40 text-white/90"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            <Tag size={10} className="mr-1" />
            {cat.label}
          </span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                fill={i < node.importance ? '#fff' : 'none'}
                className={i < node.importance ? 'text-white' : 'text-white/40'}
              />
            ))}
          </div>
        </div>
        <h3 className="text-xl font-bold handwritten tracking-wide leading-snug pr-8">
          {node.name}
        </h3>
        <p className="text-sm text-white/85 mt-1 leading-snug">{node.description}</p>
      </div>

      <div className="flex-1 overflow-auto scrollbar-sketch p-5 space-y-5">
        {/* 定义卡片 */}
        <div className="sketch-card p-4 relative">
          <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-full bg-sketch-yellow border-2 border-ink/15 shadow-sm text-[11px] font-bold text-ink handwritten">
            📌 定义
          </div>
          <div className="flex items-start gap-2 mt-1">
            <BookOpen size={16} className="text-sketch-blueDeep mt-0.5 shrink-0" />
            <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap">
              {node.definition}
            </p>
          </div>
        </div>

        {/* 示例 */}
        {node.examples?.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 font-bold text-ink mb-2 text-sm">
              <CircleDot size={14} className="text-sketch-orangeDeep" />
              典型示例
            </h4>
            <ul className="space-y-1.5 ml-1">
              {node.examples.map((ex, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[13px] text-ink-light bg-paper-100 rounded-sketch-sm px-3 py-2 border border-ink/10"
                >
                  <span className="font-bold text-sketch-orangeDeep handwritten shrink-0">
                    #{i + 1}
                  </span>
                  <span className="text-ink">{ex}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 前置知识 */}
        {pres.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 font-bold text-ink mb-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-sketch-orange" />
              前置知识（学习前建议先掌握）
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {pres.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onJump?.(p.id)}
                  className="sketch-tag bg-sketch-orange/10 text-sketch-orangeDeep border-sketch-orange/30 hover:bg-sketch-orange/20 transition-colors"
                >
                  <Link2 size={10} className="mr-1" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 后续知识 */}
        {nexts.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 font-bold text-ink mb-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-sketch-greenDeep" />
              后续知识（学完可继续学习）
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {nexts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onJump?.(p.id)}
                  className="sketch-tag bg-sketch-green/10 text-sketch-greenDeep border-sketch-green/30 hover:bg-sketch-green/20 transition-colors"
                >
                  <Link2 size={10} className="mr-1" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* B站视频讲解 */}
        <div>
          <h4 className="flex items-center gap-1.5 font-bold text-ink mb-2 text-sm">
            <Play size={14} className="text-sketch-red fill-sketch-red/20" />
            B站视频讲解
          </h4>
          {videoLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-ink-light py-2">
              <Loader2 size={14} className="animate-spin text-sketch-red" />
              正在搜索 B 站相关视频…
            </div>
          ) : videos.length > 0 ? (
            <div className="space-y-2">
              {videos.map((v) => (
                <a
                  key={v.bvid}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-2.5 p-2 bg-paper-100 rounded-sketch-sm border border-ink/10 hover:border-sketch-red/40 hover:bg-paper-50 transition-colors group"
                >
                  <div className="relative w-24 h-14 shrink-0 rounded-sm overflow-hidden bg-paper-200">
                    {v.pic ? (
                      <img src={v.pic} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={16} className="text-ink/30" />
                      </div>
                    )}
                    {v.duration && (
                      <span className="absolute bottom-0.5 right-0.5 text-[9px] text-white bg-black/70 rounded-sm px-1">
                        {v.duration}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-ink leading-tight line-clamp-2 group-hover:text-sketch-red transition-colors">
                      {v.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-ink-light">
                      <span className="truncate max-w-[60px]">{v.author}</span>
                      <span>·</span>
                      <span>{formatCount(v.play)}播放</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : fallbackUrl ? (
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 bg-sketch-red/8 rounded-sketch-sm border border-sketch-red/20 text-[13px] text-sketch-red hover:bg-sketch-red/15 transition-colors"
            >
              <Search size={14} />
              在 B 站搜索「{node.name}」相关视频
            </a>
          ) : null}
        </div>

        {/* 相关资源 */}
        {node.resources?.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 font-bold text-ink mb-2 text-sm">
              <ExternalLink size={14} className="text-sketch-purple" />
              相关学习资源
            </h4>
            <ul className="space-y-1.5">
              {node.resources.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-[13px] px-3 py-2 bg-paper-100 rounded-sketch-sm border border-ink/10 hover:border-sketch-purple/40 hover:bg-paper-50 cursor-pointer transition-colors"
                >
                  <span className="w-1 h-5 bg-sketch-purple/60 rounded-sm" />
                  <span className="flex-1 text-ink">{r.title}</span>
                  <ExternalLink size={12} className="text-sketch-purple shrink-0" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="border-t-2 border-ink/10 p-4 bg-paper-100/70 backdrop-blur-sm">
        <button
          onClick={() => toggleMastered(node.id)}
          className={
            'w-full sketch-btn ' +
            (mastered
              ? 'bg-paper-200 text-ink border-ink/30 hover:bg-paper-50'
              : 'bg-sketch-green text-white border-sketch-greenDeep hover:bg-sketch-greenDeep')
          }
        >
          {mastered ? (
            <>
              <CheckCircle2 size={16} /> 已掌握 · 点击取消
            </>
          ) : (
            <>
              <CheckCircle2 size={16} /> 标记为已掌握
            </>
          )}
        </button>
      </div>
    </div>
  );
}
