import { useTabs, HOME_CARDS } from '../context/TabContext';
import { useKnowledge } from '../context/KnowledgeContext';
import { Layers, Share2, CheckCircle2, Sparkles, Compass, Ruler, FileText, Network, AlertTriangle, Loader2, CheckCircle2 as CheckCircle, Circle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../context/CourseContext';
import { getCourseOverview, type CourseOverview } from '../api/courses';
import { useEffect, useState } from 'react';
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
  const { currentCourseId, currentCourse } = useCourse();
  const total = graph?.nodes.length ?? 0;
  const rels = graph?.relations.length ?? 0;
  const mastered = masteredIds.size;
  const pct = total === 0 ? 0 : Math.round((mastered / total) * 100);
  const cards = HOME_CARDS.filter((card) => card.kind !== 'qa' && (user?.role === 'teacher' || card.kind !== 'upload'));

  // 教师端课程建设概览
  const isTeacher = user?.role === 'teacher';
  const [overview, setOverview] = useState<CourseOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => {
    if (!isTeacher || currentCourseId === null) {
      setOverview(null);
      return;
    }
    let active = true;
    setOverviewLoading(true);
    getCourseOverview(currentCourseId)
      .then((data) => { if (active) setOverview(data); })
      .catch(() => { if (active) setOverview(null); })
      .finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [isTeacher, currentCourseId]);

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
              <div className="plan-logo"><img src="/logo.jpg" alt="智绘千里" className="w-full h-full object-cover" /><span>AI</span></div>
              <div className="min-w-0">
                <div className="retro-eyebrow"><Compass size={13} /> KNOWLEDGE DEPARTMENT · {user?.role === 'teacher' ? 'TEACHER PLAN' : 'STUDENT PLAN'}</div>
                <h2 className="retro-title text-2xl md:text-3xl font-bold text-ink handwritten tracking-wide mt-1">智绘千里 · AIGC 课程知识图谱工作台</h2>
                <p className="text-sm text-ink-light mt-1">把课程内容铺开成一张可探索的学习建筑图</p>
              </div>
            </div>
            <div className="plan-stamp"><Ruler size={14} /> <span>PLAN 01</span></div>
          </div>

          <div className="plan-divider"><span /> <b>课程数据总览 <em>DATA BLOCK</em></b> <span /></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
            {stats.map((stat) => <StatPanel key={stat.label} {...stat} />)}
          </div>

          {/* 教师端：课程建设与图谱生成进度概览 */}
          {isTeacher && (
            <CourseOverviewPanel
              overview={overview}
              loading={overviewLoading}
              courseName={currentCourse?.name}
              hasCourse={currentCourseId !== null}
              onRefresh={() => {
                if (currentCourseId !== null) {
                  setOverviewLoading(true);
                  getCourseOverview(currentCourseId)
                    .then(setOverview)
                    .catch(() => setOverview(null))
                    .finally(() => setOverviewLoading(false));
                }
              }}
            />
          )}

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

// ==================== 教师端课程建设概览面板 ====================
const statusMeta: Record<CourseOverview['graph_status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  empty: { label: '未生成', color: '#8a8070', bg: 'rgba(138,128,112,0.12)', icon: <Circle size={14} /> },
  building: { label: '生成中', color: '#d18040', bg: 'rgba(209,128,64,0.12)', icon: <Loader2 size={14} className="animate-spin" /> },
  ready: { label: '已就绪', color: '#5a9b5a', bg: 'rgba(90,155,90,0.12)', icon: <CheckCircle size={14} /> },
};

function CourseOverviewPanel({ overview, loading, courseName, hasCourse, onRefresh }: {
  overview: CourseOverview | null;
  loading: boolean;
  courseName?: string;
  hasCourse: boolean;
  onRefresh: () => void;
}) {
  if (!hasCourse) {
    return (
      <div className="sketch-card p-5 mb-8 bg-paper-50/70 border-dashed">
        <div className="flex items-center gap-3 text-ink-light">
          <FileText size={20} />
          <div>
            <p className="text-sm font-bold text-ink">请先选择课程</p>
            <p className="text-xs mt-0.5">在顶部课程选择器中选择一门课程，查看该课程的建设与图谱生成进度</p>
          </div>
        </div>
      </div>
    );
  }

  const meta = overview ? statusMeta[overview.graph_status] : statusMeta.empty;
  const progressPct = overview ? Math.round(overview.extraction_progress * 100) : 0;

  return (
    <div className="sketch-card p-5 mb-8 bg-paper-50/80">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sketch-sm bg-sketch-blue/15 border-2 border-sketch-blue/30 flex items-center justify-center">
            <FileText size={16} className="text-sketch-blueDeep" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink handwritten">课程建设概览</h3>
            <p className="text-[11px] text-ink-light">{courseName ?? '当前课程'}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-8 h-8 rounded-full bg-paper-100 border-2 border-ink/15 flex items-center justify-center text-ink-light hover:text-sketch-blueDeep hover:border-sketch-blue/40 transition-colors disabled:opacity-50"
          title="刷新"
          aria-label="刷新概览"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !overview && (
        <div className="flex items-center justify-center py-8 text-ink-light text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> 正在加载概览数据...
        </div>
      )}

      {overview && (
        <>
          {/* 第一行：核心指标卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <OverviewMetric
              icon={<FileText size={16} />}
              label="课程资料"
              value={overview.document_count}
              sub={`${overview.documents_status.done} 已解析 / ${overview.documents_status.error} 失败`}
              tone="blue"
            />
            <OverviewMetric
              icon={<Layers size={16} />}
              label="知识点"
              value={overview.nodes_count}
              sub={`${overview.relations_count} 条关系`}
              tone="purple"
            />
            <OverviewMetric
              icon={<Network size={16} />}
              label="关系网络"
              value={overview.relations_count}
              sub={`节点平均 ${overview.nodes_count ? (overview.relations_count / overview.nodes_count).toFixed(1) : '0'} 关系`}
              tone="green"
            />
            <OverviewMetric
              icon={<AlertTriangle size={16} />}
              label="待校对节点"
              value={overview.pending_review_count}
              sub="描述不完整"
              tone="orange"
            />
          </div>

          {/* 第二行：进度与状态 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 抽取进度 */}
            <div className="rounded-sketch-sm border-2 border-ink/10 bg-white/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Loader2 size={13} className="text-sketch-orangeDeep" /> 知识点抽取进度
                </span>
                <span className="text-sm font-bold text-sketch-orangeDeep">{progressPct}%</span>
              </div>
              <div className="h-2.5 bg-paper-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sketch-orange to-sketch-yellow rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-ink-light">
                <span>文档解析 {overview.documents_status.done}/{overview.document_count}</span>
                <span>{overview.nodes_count} 节点已抽取</span>
              </div>
            </div>

            {/* 图谱生成状态 */}
            <div className="rounded-sketch-sm border-2 border-ink/10 bg-white/60 p-4">
              <div className="text-xs font-bold text-ink mb-2">图谱生成状态</div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ color: meta.color, backgroundColor: meta.bg }}
                >
                  {meta.icon} {meta.label}
                </span>
              </div>
              <div className="mt-2.5 flex gap-3 text-[10px] text-ink-light">
                <span className="flex items-center gap-1"><Circle size={8} className="text-ink-soft" /> 待解析 {overview.documents_status.pending}</span>
                <span className="flex items-center gap-1"><CheckCircle size={8} className="text-sketch-greenDeep" /> 成功 {overview.documents_status.done}</span>
                <span className="flex items-center gap-1"><AlertTriangle size={8} className="text-sketch-red" /> 失败 {overview.documents_status.error}</span>
              </div>
            </div>

            {/* 知识点分类分布 */}
            <div className="rounded-sketch-sm border-2 border-ink/10 bg-white/60 p-4">
              <div className="text-xs font-bold text-ink mb-2">知识点分类分布</div>
              {overview.categories.length === 0 ? (
                <p className="text-[11px] text-ink-light">暂无分类数据</p>
              ) : (
                <div className="space-y-1.5">
                  {overview.categories.slice(0, 4).map((c) => {
                    const pct = overview.nodes_count ? Math.round((c.count / overview.nodes_count) * 100) : 0;
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-[10px] text-ink-light mb-0.5">
                          <span>{c.category}</span>
                          <span>{c.count}</span>
                        </div>
                        <div className="h-1.5 bg-paper-100 rounded-full overflow-hidden">
                          <div className="h-full bg-sketch-purple rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OverviewMetric({ icon, label, value, sub, tone }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  tone: 'blue' | 'purple' | 'green' | 'orange';
}) {
  const colorMap: Record<string, string> = {
    blue: '#3f7ba0',
    purple: '#8d70b3',
    green: '#5a9b5a',
    orange: '#d18040',
  };
  const color = colorMap[tone];
  return (
    <div className="rounded-sketch-sm border-2 border-ink/10 bg-white/60 p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-sketch-sm flex items-center justify-center" style={{ backgroundColor: `${color}22`, color }}>
          {icon}
        </span>
        <span className="text-[11px] font-bold text-ink">{label}</span>
      </div>
      <div className="text-2xl font-bold text-ink handwritten leading-none">{value}</div>
      <div className="text-[10px] text-ink-light mt-1 truncate">{sub}</div>
    </div>
  );
}
