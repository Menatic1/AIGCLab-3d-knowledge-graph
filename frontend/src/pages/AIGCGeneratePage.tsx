import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Share2, BookOpen, Cpu } from 'lucide-react';
import { useTabs } from '../context/TabContext';
import { useKnowledge } from '../context/KnowledgeContext';
import { useCourse } from '../context/CourseContext';
import { mapBackendGraph, API_BASE } from '../lib/graphMap';
import { authedFetch } from '../context/AuthContext';

// 留空 → 后端使用 .env 里的 LLM_MODEL（火山方舟推理接入点 ep-xxx 或 doubao-seed-2-1-pro-260628）
const DEFAULT_MODEL = '';

interface GenResult {
  topic: string;
  nodes_count: number;
  relations_count: number;
  used_llm: boolean;
  summary: string;
}

export default function AIGCGeneratePage() {
  const { openTab } = useTabs();
  const { hasGraph, reloadGraph } = useKnowledge();
  const { currentCourseId } = useCourse();
  const [topic, setTopic] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    const t = topic.trim();
    if (!t) {
      setError('请输入课程主题');
      return;
    }
    if (currentCourseId === null) {
      setError('请先在顶部课程选择器中选择或创建一门课程，生成的图谱将归入该课程。');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    // Doubao-seed 有思维链推理，生成图谱通常 2-6 分钟，设 420s 超时兜底
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 420_000);
    try {
      const resp = await authedFetch(`${API_BASE}/api/aigc/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, model: model.trim() || undefined, course_id: currentCourseId ?? undefined }),
        signal: controller.signal,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.detail || `请求失败 (${resp.status})`);
      }
      // 后端已将图谱持久化到数据库，重新拉取确保显示的是已保存的完整图谱。
      await reloadGraph();
      setResult({
        topic: data.topic,
        nodes_count: data.nodes_count ?? (data.nodes?.length ?? 0),
        relations_count: data.relations_count ?? (data.relations?.length ?? 0),
        used_llm: !!data.used_llm,
        summary: data.summary || '',
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError('请求超时（超过 7 分钟）。Doubao-seed 思维链推理可能需要更长时间，请稍后重试或在「高级设置」换更快的模型。');
      } else {
        setError(e?.message || String(e));
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      {/* 标题 */}
      <div className="sketch-card p-5 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-sketch-pink/15 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-sketch-sm bg-gradient-to-br from-sketch-pink to-sketch-orange shadow-sketch flex items-center justify-center border-2 border-white/60 rotate-[-3deg]">
            <Sparkles size={24} className="text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink handwritten">AIGC 主题生成图谱</h2>
            <p className="text-xs text-ink-light mt-0.5">输入课程主题，调用火山方舟大模型直接生成知识图谱</p>
          </div>
        </div>
      </div>

      {/* 输入区 */}
      <div className="sketch-card p-5 flex flex-col gap-4">
        <div>
          <label className="text-xs font-bold text-ink-light mb-1.5 block">课程主题 *</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
            placeholder="如：计算机网络 / 高等数学 / 数据结构与算法"
            className="w-full sketch-input"
            disabled={loading}
          />
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-ink-light hover:text-ink flex items-center gap-1"
          >
            <Cpu size={12} /> 高级设置（模型）{showAdvanced ? ' ▲' : ' ▼'}
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <label className="text-xs font-bold text-ink-light mb-1.5 block">模型 ID（火山方舟 Ark）</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="留空使用后端默认（ep-xxx 或 doubao-seed-2-1-pro-260628）"
                className="w-full sketch-input font-mono text-xs"
                disabled={loading}
              />
              <p className="text-[11px] text-ink-light mt-1 opacity-75">
                留空则使用后端 .env 配置的模型（当前为火山方舟推理接入点）。若你的 Ark 账号开通了别的模型或使用接入点 ID（ep-xxx），在此覆盖。
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="sketch-btn-primary w-full justify-center"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> 大模型思维链推理中（约 2-6 分钟）…
            </>
          ) : (
            <>
              <Sparkles size={16} /> 生成知识图谱
            </>
          )}
        </button>
        <p className="text-[11px] text-ink-light text-center opacity-75">
          生成过程约需 2-6 分钟（Doubao-seed 思维链推理），请耐心等待。生成结果会自动写入知识图谱。
        </p>
      </div>

      {/* 错误 */}
      {error && (
        <div className="sketch-card p-4 border-sketch-red/40 bg-sketch-red/5 flex items-start gap-2">
          <AlertTriangle size={18} className="text-sketch-red shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-ink">
            <div className="font-bold mb-1">生成失败</div>
            <div className="text-ink-light text-[13px] break-words">{error}</div>
            <div className="text-[11px] text-ink-light mt-2 opacity-75">
              常见原因：模型 ID 不匹配、API Key 无效/未开通该模型、网络超时。可在「高级设置」改模型后重试。
            </div>
          </div>
        </div>
      )}

      {/* 结果 */}
      {result && (
        <div className="sketch-card p-5 flex flex-col gap-4 border-sketch-green/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-sketch-greenDeep" />
            <span className="font-bold text-ink">生成完成</span>
            {!result.used_llm && (
              <span className="sketch-tag bg-sketch-orange/15 text-sketch-orangeDeep border-sketch-orange/30 text-[11px]">
                未走 LLM（回退）
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="sketch-card p-3 flex items-center gap-2">
              <Share2 size={16} className="text-sketch-purple" />
              <div className="leading-tight">
                <div className="text-[10px] text-ink-light uppercase">知识点</div>
                <div className="text-lg font-bold handwritten text-sketch-purple">{result.nodes_count}</div>
              </div>
            </div>
            <div className="sketch-card p-3 flex items-center gap-2">
              <BookOpen size={16} className="text-sketch-blueDeep" />
              <div className="leading-tight">
                <div className="text-[10px] text-ink-light uppercase">关系数</div>
                <div className="text-lg font-bold handwritten text-sketch-blueDeep">{result.relations_count}</div>
              </div>
            </div>
          </div>
          {result.summary && (
            <div className="text-xs text-ink-light bg-paper-100 rounded-sketch-sm p-2.5 border border-ink/10">
              {result.summary}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => openTab('graph')} className="sketch-btn-primary flex-1 justify-center">
              <Share2 size={16} /> 查看知识图谱
            </button>
            <button onClick={() => openTab('resources')} className="sketch-btn-secondary flex-1 justify-center">
              <BookOpen size={16} /> 学习资源
            </button>
          </div>
        </div>
      )}

      {/* 已有图谱提示 */}
      {hasGraph && !loading && !result && (
        <div className="text-center text-xs text-ink-light opacity-75">
          当前已加载图谱，新生成将覆盖显示。
        </div>
      )}
    </div>
  );
}
