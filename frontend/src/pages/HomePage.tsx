import { useTabs, HOME_CARDS } from '../context/TabContext';
import { useKnowledge } from '../context/KnowledgeContext';
import { Layers, Share2, CheckCircle2, Network, Sparkles } from 'lucide-react';

export default function HomePage() {
  const { openTab } = useTabs();
  const { graph, hasGraph, masteredIds } = useKnowledge();

  const total = graph?.nodes.length ?? 0;
  const rels = graph?.relations.length ?? 0;
  const mastered = masteredIds.size;
  const pct = total === 0 ? 0 : Math.round((mastered / total) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* 欢迎区 */}
      <div className="sketch-card relative overflow-hidden p-6 md:p-8">
        <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-sketch-purple/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-4 w-32 h-32 rounded-full bg-sketch-orange/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-sketch bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink shadow-sketch flex items-center justify-center border-2 border-white/60 rotate-[-4deg] shrink-0">
            <Network size={28} className="text-white" strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-ink handwritten tracking-wide">
              AIGC 课程知识图谱 · 工作台
            </h2>
            <p className="text-sm text-ink-light mt-1">
              点击下方功能卡片打开新标签页，顶部标签栏可随时关闭 · 类浏览器式导航
            </p>
          </div>
        </div>
      </div>

      {/* 图谱状态概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="知识点" value={total} icon={<Layers size={16} />} color="blue" />
        <StatCard label="关系数" value={rels} icon={<Share2 size={16} />} color="purple" />
        <StatCard label="已掌握" value={`${mastered}/${total || '--'}`} icon={<CheckCircle2 size={16} />} color="green" />
        <StatCard label="掌握率" value={`${pct}%`} icon={<Sparkles size={16} />} color="orange" />
      </div>

      {/* 功能卡片网格 */}
      <div>
        <h3 className="text-sm font-bold text-ink-light mb-3 handwritten tracking-wide">功能入口</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HOME_CARDS.map((c, i) => (
            <button
              key={c.kind}
              onClick={() => openTab(c.kind)}
              className="group sketch-card p-5 text-left relative overflow-hidden hover:-translate-y-1 hover:shadow-sketch-lg transition-all duration-200"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-sketch-sm bg-gradient-to-br ${c.color} shadow-sketch-sm flex items-center justify-center border-2 border-white/50 shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                  <c.icon size={24} className="text-white" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-ink handwritten">{c.title}</h4>
                    <span className="text-[10px] text-ink-light opacity-0 group-hover:opacity-100 transition-opacity">↗ 打开</span>
                  </div>
                  <p className="text-xs text-ink-light mt-1">{c.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 无图谱提示 */}
      {!hasGraph && (
        <div className="sketch-card p-4 border-sketch-orange/40 bg-sketch-orange/5 flex items-center gap-3">
          <Sparkles size={20} className="text-sketch-orangeDeep shrink-0" />
          <div className="flex-1 text-sm text-ink-light">
            当前还没有知识图谱。建议先{' '}
            <button onClick={() => openTab('aigc')} className="font-bold text-sketch-orangeDeep underline underline-offset-2">用 AIGC 生成</button>
            {' '}或{' '}
            <button onClick={() => openTab('upload')} className="font-bold text-sketch-blueDeep underline underline-offset-2">上传文档解析</button>
            。
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: React.ReactNode; icon: React.ReactNode; color: 'blue' | 'purple' | 'green' | 'orange' }) {
  const palette: Record<string, string> = {
    blue: 'from-sketch-blue/20 to-sketch-blue/5 text-sketch-blueDeep border-sketch-blue/30',
    purple: 'from-sketch-purple/20 to-sketch-purple/5 text-sketch-purple border-sketch-purple/40',
    green: 'from-sketch-green/20 to-sketch-green/5 text-sketch-greenDeep border-sketch-green/30',
    orange: 'from-sketch-orange/20 to-sketch-orange/5 text-sketch-orangeDeep border-sketch-orange/30',
  };
  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-3 rounded-sketch-sm border-2 shadow-sketch-sm bg-gradient-to-br ${palette[color]}`}>
      <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center shrink-0">{icon}</div>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
        <div className="text-lg font-bold handwritten">{value}</div>
      </div>
    </div>
  );
}
