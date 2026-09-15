import { useTabs, HOME_CARDS } from '../context/TabContext';
import { useKnowledge } from '../context/KnowledgeContext';
import { Layers, Share2, CheckCircle2, Network, Sparkles, Compass, Ruler } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CampusModelStage from '../components/home/CampusModelStage';

const moduleColors = ['#3f7ba0', '#8d70b3', '#d18040', '#5a9b5a', '#b66d8f'];
const statColors: Record<string, string> = {
  blue: '#3f7ba0',
  purple: '#8d70b3',
  green: '#5a9b5a',
  orange: '#d18040',
};

export default function HomePage() {
  const { openTab } = useTabs();
  const { graph, hasGraph, masteredIds } = useKnowledge();
  const { user } = useAuth();
  const total = graph?.nodes.length ?? 0;
  const rels = graph?.relations.length ?? 0;
  const mastered = masteredIds.size;
  const pct = total === 0 ? 0 : Math.round((mastered / total) * 100);
  const cards = HOME_CARDS.filter((card) => card.kind !== 'qa' && (user?.role === 'teacher' || card.kind !== 'upload'));
  const stats = [
    { label: '知识点', value: total, icon: <Layers size={18} />, tone: 'blue', code: 'A-01' },
    { label: '关系网络', value: rels, icon: <Share2 size={18} />, tone: 'purple', code: 'B-02' },
    { label: '已掌握', value: `${mastered}/${total || '--'}`, icon: <CheckCircle2 size={18} />, tone: 'green', code: 'C-03' },
    { label: '掌握率', value: `${pct}%`, icon: <Sparkles size={18} />, tone: 'orange', code: 'D-04' },
  ] as const;

  return (
    <div className="blueprint-page">
      <section className="blueprint-board">
        <div className="retro-sun" aria-hidden="true" />
        <div className="retro-ring retro-ring-a" aria-hidden="true" />
        <div className="retro-ring retro-ring-b" aria-hidden="true" />
        <div className="retro-signal" aria-hidden="true"><span /><span /><span /></div>
        <div className="blueprint-grid" />
        <div className="blueprint-road blueprint-road-a" />
        <div className="blueprint-road blueprint-road-b" />
        <div className="blueprint-road blueprint-road-c" />
        <div className="blueprint-corner blueprint-corner-tl" />
        <div className="blueprint-corner blueprint-corner-br" />

        <div className="relative z-10 p-5 md:p-7 lg:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5 mb-7">
            <div className="flex items-center gap-4 min-w-0">
              <div className="plan-logo"><Network size={27} strokeWidth={2.2} /><span>AI</span></div>
              <div className="min-w-0">
                <div className="retro-eyebrow"><Compass size={13} /> KNOWLEDGE DEPARTMENT · {user?.role === 'teacher' ? 'TEACHER PLAN' : 'STUDENT PLAN'}</div>
                <h2 className="retro-title text-2xl md:text-3xl font-bold text-ink handwritten tracking-wide mt-1">AIGC 课程知识图谱 · 工作台</h2>
                <p className="text-sm text-ink-light mt-1">把课程内容铺开成一张可探索的学习建筑图</p>
              </div>
            </div>
            <div className="plan-stamp"><Ruler size={14} /> <span>PLAN 01</span></div>
          </div>

          <div className="plan-divider"><span /> <b>课程数据总览 <em>DATA BLOCK</em></b> <span /></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
            {stats.map((stat) => <StatPanel key={stat.label} {...stat} />)}
          </div>

          <div className="plan-divider"><span /> <b>功能建筑模块 <em>ACCESS ZONES</em></b> <span /></div>
          <CampusModelStage cards={cards} onOpen={openTab} />
          <div className="plan-legend"><span className="legend-line" /> 主轴路径 <span className="legend-dot" /> 当前课程：{graph?.courseName ?? '待载入课程图谱'} <span className="legend-scale">1 : 100</span></div>
        </div>
      </section>

      {!hasGraph && <div className="sketch-card p-4 border-sketch-orange/40 bg-sketch-orange/5 flex items-center gap-3"><Sparkles size={20} className="text-sketch-orangeDeep shrink-0" /><div className="flex-1 text-sm text-ink-light">当前还没有知识图谱。建议先 <button onClick={() => openTab('aigc')} className="font-bold text-sketch-orangeDeep underline underline-offset-2">用 AIGC 生成</button>{user?.role === 'teacher' && <> 或 <button onClick={() => openTab('upload')} className="font-bold text-sketch-blueDeep underline underline-offset-2">上传文档解析</button></>}。</div></div>}
    </div>
  );
}

function StatPanel({ label, value, icon, tone, code }: { label: string; value: React.ReactNode; icon: React.ReactNode; tone: string; code: string }) {
  const accent = statColors[tone] ?? statColors.blue;
  return <div className={`plan-stat stat-${tone}`} style={{ color: accent }}><div className="stat-face"><div className="stat-code">{code}</div><div className="stat-icon" style={{ backgroundColor: accent, borderColor: accent }}>{icon}</div><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div></div><div className="stat-side" /></div>;
}
