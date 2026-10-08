import { useEffect, useState } from 'react';
import { useTabs, type TabKind } from '../../context/TabContext';
import { useKnowledge } from '../../context/KnowledgeContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, ArrowRight, X, Sparkles, UserRound } from 'lucide-react';
import HomePage from '../../pages/HomePage';
import UploadPage from '../../pages/UploadPage';
import GraphPage from '../../pages/GraphPage';
import QAPage from '../../pages/QAPage';
import LearningPathPage from '../../pages/LearningPathPage';
import AIGCGeneratePage from '../../pages/AIGCGeneratePage';
import LearningResourcesPage from '../../pages/LearningResourcesPage';
import LearningPage from '../../pages/LearningPage';
import QuizPage from '../../pages/QuizPage';
import VisitorCenterPage from '../../pages/VisitorCenterPage';
import LoginPage from '../../pages/LoginPage';
import LandingPage from '../../pages/LandingPage';
import CourseSelector from './CourseSelector';
import FloatingAssistant from '../qa/FloatingAssistant';

function renderPage(kind: TabKind) {
  switch (kind) {
    case 'home': return <HomePage />;
    case 'upload': return <UploadPage />;
    case 'graph': return <GraphPage />;
    case 'qa': return <QAPage />;
    case 'path': return <LearningPathPage />;
    case 'aigc': return <AIGCGeneratePage />;
    case 'resources': return <LearningResourcesPage />;
    case 'learning': return <LearningPage />;
    case 'quiz': return <QuizPage />;
    case 'visitor': return <VisitorCenterPage />;
    default: return <HomePage />;
  }
}

export default function AppShell() {
  const { tabs, activeId, setActive, closeTab, openTab, goBack, goForward, canGoBack, canGoForward } = useTabs();
  const { graph, masteredIds } = useKnowledge();
  const { user, isAuthenticated, isReady } = useAuth();
  const [showLanding, setShowLanding] = useState(true);
  const activeTab = tabs.find((t) => t.id === activeId);
  const teacherView = user?.role === 'teacher';

  useEffect(() => {
    if (teacherView && activeTab?.kind === 'qa') setActive('home');
  }, [activeTab?.kind, setActive, teacherView]);

  if (!isReady) return <div className="min-h-screen bg-paper-50" />;
  if (!isAuthenticated) {
    return showLanding
      ? <LandingPage onEnter={() => setShowLanding(false)} />
      : <LoginPage onBack={() => setShowLanding(true)} />;
  }
  const total = graph?.nodes.length ?? 0;
  const pct = total === 0 ? 0 : Math.round((masteredIds.size / total) * 100);
  const activeKind = (teacherView && activeTab?.kind === 'qa' ? 'home' : activeTab?.kind ?? 'home') as TabKind;
  const visibleTabs = teacherView ? tabs.filter((tab) => tab.kind !== 'qa') : tabs;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-paper-50">
      {/* 顶部：Logo + 标签栏 + 状态 */}
      <header className="relative z-20 bg-paper-50/90 backdrop-blur-sm border-b-2 border-ink/15 shadow-[0_2px_0_rgba(59,51,43,0.06)]">
        <div className="flex items-stretch h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 border-r-2 border-ink/10 shrink-0">
            <div className="relative">
              <div className="w-9 h-9 rounded-sketch-sm bg-white shadow-sketch logo-mark flex items-center justify-center border-2 border-ink/15 rotate-[-3deg] overflow-hidden">
                <img src="/logo.jpg" alt="智绘千里" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-sketch-yellow border-2 border-white shadow-sketch-sm flex items-center justify-center text-[8px] handwritten">
                AI
              </div>
            </div>
            <div className="hidden md:block">
              <h1 className="text-sm font-bold text-ink handwritten tracking-wide leading-none">
                智绘千里
              </h1>
              <p className="text-[10px] text-ink-light leading-none mt-0.5">AIGC 知识图谱 · 智能导航</p>
            </div>
          </div>

          {/* 应用内前进/后退 */}
          <div className="flex items-center gap-1 px-2 border-r-2 border-ink/10 shrink-0">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className="w-7 h-7 rounded-full flex items-center justify-center text-ink-light hover:bg-paper-100 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink-light transition-colors"
              title="返回上一步（Alt+左箭头）"
              aria-label="返回上一步"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              className="w-7 h-7 rounded-full flex items-center justify-center text-ink-light hover:bg-paper-100 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink-light transition-colors"
              title="前进到下一步（Alt+右箭头）"
              aria-label="前进到下一步"
            >
              <ArrowRight size={15} />
            </button>
          </div>

          {/* 课程切换 */}
          <div className="flex items-center px-2 border-r-2 border-ink/10 shrink-0">
            <CourseSelector />
          </div>

          {/* 标签栏（浏览器式） */}
          <div className="flex-1 flex items-stretch min-w-0 overflow-x-auto scrollbar-thin">
            {visibleTabs.map((tab) => {
              const active = tab.id === activeId;
              const Icon = tab.icon;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={
                    'group flex items-center gap-2 px-3.5 cursor-pointer border-r-2 border-ink/10 shrink-0 transition-colors ' +
                    (active
                      ? 'bg-paper-100 text-ink shadow-[inset_0_-2px_0_var(--tw-sketch-blue,#3f7ba0)]'
                      : 'bg-transparent text-ink-light hover:bg-paper-100/60 hover:text-ink')
                  }
                  style={active ? { boxShadow: 'inset 0 -3px 0 #d18040' } : undefined}
                >
                  <Icon
                    size={15}
                    strokeWidth={2.2}
                    className={'shrink-0 ' + (active ? `bg-gradient-to-br ${tab.color} bg-clip-text` : '')}
                  />
                  <span className={'text-[13px] whitespace-nowrap ' + (active ? 'font-bold' : 'font-medium')}>{tab.title}</span>
                  {tab.closable && (
                    <button
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                      className="ml-0.5 w-5 h-5 rounded-full flex items-center justify-center text-ink-light/60 hover:bg-ink/10 hover:text-ink transition-colors"
                      aria-label={`关闭 ${tab.title}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            {/* 新建工作台按钮（快速回首页） */}
            {activeId !== 'home' && (
              <div
                onClick={() => setActive('home')}
                className="flex items-center px-3 cursor-pointer text-ink-light hover:text-ink hover:bg-paper-100/60 shrink-0"
                title="回到工作台"
              >
                <Sparkles size={14} />
              </div>
            )}
          </div>

          {/* 右侧状态 */}
          <div className="flex items-center gap-3 px-4 border-l-2 border-ink/10 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-ink-light">
              <span className="w-2 h-2 rounded-full bg-sketch-green animate-pulse" />
              <span>系统就绪</span>
            </div>
            <button
              onClick={() => openTab('visitor')}
              className="flex items-center gap-2 px-2.5 py-1 rounded-sketch-sm border-2 border-ink/15 bg-paper-100 shadow-sketch-sm hover:bg-paper-50 hover:border-sketch-orange/40 transition-colors text-left"
              title="打开访客中心"
              aria-label="打开访客中心"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sketch-orange to-sketch-red flex items-center justify-center text-white font-bold text-[11px] border-2 border-white">
                {user?.username?.[0]?.toUpperCase() || '客'}
              </div>
              <div className="hidden md:block leading-none">
                <div className="text-[11px] font-medium text-ink">{user?.username || '访客浏览'}</div>
                <div className="text-[9px] text-ink-light mt-0.5">{user?.role === 'teacher' ? '教师' : '学生'} · {pct}% 已掌握</div>
              </div>
              <UserRound size={14} className="text-ink-light hidden sm:block" />
            </button>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="relative flex-1 min-h-0 overflow-auto scrollbar-sketch p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto animate-pencil-in h-full">
          {renderPage(activeKind)}
        </div>
      </main>
      {!teacherView && <FloatingAssistant />}
    </div>
  );
}
