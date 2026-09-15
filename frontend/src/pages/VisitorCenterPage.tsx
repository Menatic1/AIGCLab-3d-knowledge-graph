import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { BarChart3, BookOpen, CheckCircle2, ChevronRight, ClipboardList, FileUp, LogOut, Network, Settings2, Sparkles, TrendingUp, UserRound, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useKnowledge } from '../context/KnowledgeContext';
import { useTabs, type TabKind } from '../context/TabContext';
import { CATEGORY_META } from '../mock/sampleKnowledgeGraph';

const TEACHER_ACTIONS: Array<{ kind: TabKind; title: string; description: string; icon: typeof Network; color: string }> = [
  { kind: 'upload', title: '上传课程文档', description: '解析 PDF、Word 或 PPT', icon: FileUp, color: 'from-sketch-blue to-sketch-blueDeep' },
  { kind: 'graph', title: '维护知识图谱', description: '编辑节点、关系和结构', icon: Settings2, color: 'from-sketch-purple to-sketch-pink' },
  { kind: 'path', title: '查看学习路径', description: '了解学生推荐学习顺序', icon: TrendingUp, color: 'from-sketch-orange to-sketch-red' },
  { kind: 'resources', title: '管理学习资源', description: '查看课程相关资源', icon: BookOpen, color: 'from-sketch-green to-sketch-yellow' },
];

const DEMO_STUDENTS = [
  { name: '林同学', progress: 86, mastered: 22, active: '今天 09:42' },
  { name: '周同学', progress: 72, mastered: 19, active: '今天 10:18' },
  { name: '陈同学', progress: 58, mastered: 15, active: '昨天 21:06' },
  { name: '王同学', progress: 41, mastered: 11, active: '昨天 18:30' },
  { name: '赵同学', progress: 27, mastered: 7, active: '3 天前' },
];

export default function VisitorCenterPage() {
  const { user } = useAuth();
  return user?.role === 'teacher' ? <TeacherCenter /> : <StudentCenter />;
}

function TeacherCenter() {
  const { user, logout } = useAuth();
  const { graph, documents } = useKnowledge();
  const { openTab } = useTabs();
  const averageProgress = Math.round(DEMO_STUDENTS.reduce((sum, student) => sum + student.progress, 0) / DEMO_STUDENTS.length);
  const parsedDocuments = documents.filter((document) => document.status === 'parsed').length;

  return (
    <div className="flex flex-col gap-5 min-h-full pb-6">
      <section className="sketch-card relative overflow-hidden p-6 md:p-8 bg-gradient-to-br from-sketch-orange/15 via-paper-50 to-sketch-purple/10">
        <div className="absolute -right-10 -top-16 w-52 h-52 rounded-full bg-sketch-orange/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0"><div className="w-16 h-16 rounded-sketch-lg bg-gradient-to-br from-sketch-orange to-sketch-red border-2 border-white/70 shadow-sketch flex items-center justify-center rotate-[-4deg] shrink-0"><Users size={31} className="text-white" /></div><div className="min-w-0"><p className="text-xs text-ink-light mb-1">教师中心</p><h2 className="text-2xl md:text-3xl font-bold text-ink handwritten tracking-wide">{user?.username || '教师账号'}</h2><p className="text-sm text-ink-light mt-1">课程教学数据与知识图谱管理</p></div></div>
          <button onClick={logout} className="sketch-btn-secondary text-xs !py-2.5"><LogOut size={14} />退出登录</button>
        </div>
      </section>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="班级人数" value={32} icon={<Users size={17} />} color="blue" /><Metric label="平均完成度" value={`${averageProgress}%`} icon={<BarChart3 size={17} />} color="orange" /><Metric label="本周活跃" value={24} icon={<TrendingUp size={17} />} color="green" /><Metric label="已建知识点" value={graph?.nodes.length ?? 0} icon={<Network size={17} />} color="purple" /></section>
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="sketch-card p-5 md:p-6"><div className="flex items-start justify-between gap-3 mb-5"><div><p className="text-xs text-ink-light">学生学习进度</p><h3 className="text-xl font-bold text-ink handwritten mt-1">{graph?.courseName ?? '当前课程'}</h3><p className="text-xs text-ink-light mt-1">数据为演示数据，可接入班级系统实时同步</p></div><ClipboardList size={21} className="text-sketch-blueDeep" /></div><div className="space-y-3">{DEMO_STUDENTS.map((student) => <div key={student.name} className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-sketch-blue/15 border-2 border-sketch-blue/25 flex items-center justify-center text-xs font-bold text-sketch-blueDeep">{student.name[0]}</div><div className="flex-1 min-w-0"><div className="flex items-center justify-between text-xs mb-1"><span className="font-bold text-ink">{student.name}</span><span className="text-ink-light">{student.mastered} 个知识点 · {student.active}</span></div><div className="h-2.5 rounded-full bg-paper-200 overflow-hidden border border-ink/10"><div className="h-full rounded-full bg-gradient-to-r from-sketch-blue to-sketch-green" style={{ width: `${student.progress}%` }} /></div></div><span className="w-10 text-right text-sm font-bold text-sketch-greenDeep handwritten">{student.progress}%</span></div>)}</div><button onClick={() => openTab('path')} className="mt-5 inline-flex items-center gap-1 text-xs text-sketch-orangeDeep font-bold hover:underline">查看完整学习路径 <ChevronRight size={13} /></button></div>
        <div className="sketch-card p-5 md:p-6"><div className="flex items-start justify-between mb-4"><div><p className="text-xs text-ink-light">课程概况</p><h3 className="text-xl font-bold text-ink handwritten mt-1">{graph?.chapterName ?? '暂无图谱'}</h3></div><Sparkles size={20} className="text-sketch-orangeDeep" /></div><div className="space-y-3 text-sm"><InfoRow label="知识点" value={`${graph?.nodes.length ?? 0} 个`} /><InfoRow label="关系" value={`${graph?.relations.length ?? 0} 条`} /><InfoRow label="已解析文档" value={`${parsedDocuments} 份`} /><InfoRow label="重点类别" value={graph ? getTopCategory(graph.nodes.map((node) => node.category)) : '等待上传'} /></div><button onClick={() => openTab('graph')} className="sketch-btn-primary w-full justify-center mt-5"><Settings2 size={15} />进入图谱维护</button></div>
      </section>
      <section><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-ink-light handwritten tracking-wide">教学工具</h3><span className="text-[11px] text-ink-light">教师专属</span></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{TEACHER_ACTIONS.map((action) => { const Icon = action.icon; return <button key={action.kind} onClick={() => openTab(action.kind)} className="sketch-card p-4 flex items-center gap-3 text-left hover:-translate-y-0.5 hover:shadow-sketch-lg transition-all"><div className={`w-11 h-11 rounded-sketch-sm bg-gradient-to-br ${action.color} shadow-sketch-sm border-2 border-white/60 flex items-center justify-center shrink-0`}><Icon size={21} className="text-white" /></div><div className="flex-1 min-w-0"><div className="text-sm font-bold text-ink">{action.title}</div><div className="text-xs text-ink-light mt-1">{action.description}</div></div><ChevronRight size={16} className="text-ink-light shrink-0" /></button>; })}</div></section>
    </div>
  );
}

function StudentCenter() {
  const { user, logout } = useAuth();
  const { graph, masteredIds } = useKnowledge();
  const { openTab } = useTabs();
  const total = graph?.nodes.length ?? 0;
  const progress = total ? Math.round((masteredIds.size / total) * 100) : 0;
  const masteredNodes = useMemo(() => graph?.nodes.filter((node) => masteredIds.has(node.id)) ?? [], [graph, masteredIds]);
  return <div className="flex flex-col gap-5 min-h-full pb-6"><section className="sketch-card relative overflow-hidden p-6 md:p-8"><div className="relative flex flex-wrap items-center justify-between gap-6"><div className="flex items-center gap-4 min-w-0"><div className="w-16 h-16 rounded-sketch-lg bg-gradient-to-br from-sketch-blue to-sketch-purple border-2 border-white/70 shadow-sketch flex items-center justify-center rotate-[-4deg]"><UserRound size={31} className="text-white" /></div><div className="min-w-0"><p className="text-xs text-ink-light mb-1">学生中心</p><h2 className="text-2xl md:text-3xl font-bold text-ink handwritten tracking-wide">{user?.username || '学生账号'}</h2><p className="text-sm text-ink-light mt-1">学习进度保存在本次访问中</p></div></div><div className="flex items-center gap-3"><div className="px-4 py-3 rounded-sketch-sm bg-paper-50/80 border-2 border-ink/10 shadow-sketch-sm"><div className="text-[10px] text-ink-light">掌握率</div><div className="text-2xl font-bold text-ink handwritten">{progress}%</div></div><button onClick={logout} className="sketch-btn-secondary text-xs !py-2.5"><LogOut size={14} />退出</button></div></div></section><section className="grid grid-cols-1 md:grid-cols-3 gap-3"><Metric label="知识点" value={total} icon={<BookOpen size={17} />} color="blue" /><Metric label="已掌握" value={masteredIds.size} icon={<CheckCircle2 size={17} />} color="green" /><Metric label="关系数" value={graph?.relations.length ?? 0} icon={<Network size={17} />} color="purple" /></section><section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5"><div className="sketch-card p-5 md:p-6"><p className="text-xs text-ink-light">当前课程</p><h3 className="text-xl font-bold text-ink handwritten mt-1">{graph?.courseName ?? '暂无课程图谱'}</h3><p className="text-sm text-ink-light mt-1">{graph?.chapterName ?? '请先加载课程内容'}</p><div className="h-3 rounded-full bg-paper-200 overflow-hidden border border-ink/10 mt-5"><div className="h-full rounded-full bg-gradient-to-r from-sketch-blue via-sketch-green to-sketch-orange" style={{ width: `${progress}%` }} /></div><div className="flex items-center justify-between mt-2 text-xs text-ink-light"><span>{masteredIds.size} / {total || '--'} 个知识点已掌握</span><button onClick={() => openTab('path')} className="text-sketch-orangeDeep font-bold hover:underline">学习路径</button></div></div><div className="sketch-card p-5 md:p-6"><div className="flex items-center justify-between mb-4"><h3 className="text-base font-bold text-ink handwritten">已掌握知识点</h3><button onClick={() => openTab('graph')} className="text-xs text-sketch-blueDeep font-bold hover:underline">查看图谱</button></div>{masteredNodes.length ? <div className="flex flex-wrap gap-2">{masteredNodes.map((node) => { const meta = CATEGORY_META[node.category] ?? CATEGORY_META.concept; return <span key={node.id} className="sketch-tag border-2" style={{ color: meta.color, borderColor: `${meta.color}55`, background: meta.bgColor }}>{node.name}</span>; })}</div> : <div className="min-h-24 flex flex-col items-center justify-center text-center text-sm text-ink-light border-2 border-dashed border-ink/10 rounded-sketch-sm"><CheckCircle2 size={20} className="text-sketch-green/60 mb-2" />还没有标记已掌握的知识点</div>}</div></section></div>;
}

function getTopCategory(categories: string[]) { const counts = categories.reduce<Record<string, number>>((result, category) => { result[category] = (result[category] ?? 0) + 1; return result; }, {}); const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]; return top ? CATEGORY_META[top]?.label ?? top : '暂无'; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-ink/10 pb-2"><span className="text-ink-light">{label}</span><span className="font-bold text-ink">{value}</span></div>; }
function Metric({ label, value, icon, color }: { label: string; value: number | string; icon: ReactNode; color: 'blue' | 'green' | 'purple' | 'orange' }) { const colors = { blue: 'text-sketch-blueDeep border-sketch-blue/25 bg-sketch-blue/8', green: 'text-sketch-greenDeep border-sketch-green/25 bg-sketch-green/8', purple: 'text-sketch-purple border-sketch-purple/25 bg-sketch-purple/8', orange: 'text-sketch-orangeDeep border-sketch-orange/25 bg-sketch-orange/8' }; return <div className={`flex items-center gap-3 px-4 py-4 rounded-sketch-sm border-2 shadow-sketch-sm ${colors[color]}`}><div className="w-9 h-9 rounded-full bg-white/75 flex items-center justify-center">{icon}</div><div><div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div><div className="text-xl font-bold handwritten">{value}</div></div></div>; }
