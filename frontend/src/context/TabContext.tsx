import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  Home,
  Upload,
  Share2,
  MessageCircle,
  Route,
  BookOpen,
  ClipboardCheck,
  Sparkles,
  Network,
  type LucideIcon,
} from 'lucide-react';

// 标签页种类
export type TabKind =
  | 'home'
  | 'upload'
  | 'graph'
  | 'qa'
  | 'path'
  | 'resources'
  | 'aigc'
  | 'learning'
  | 'quiz'
  | 'visitor';

export interface TabMeta {
  kind: TabKind;
  title: string;
  icon: LucideIcon;
  closable: boolean;
  color: string; // tailwind 渐变
}

// 所有功能的元信息（标题/图标/颜色）
export const TAB_META: Record<TabKind, TabMeta> = {
  home:      { kind: 'home',      title: '工作台',     icon: Home,         closable: false, color: 'from-sketch-blue to-sketch-purple' },
  upload:    { kind: 'upload',    title: '文档上传',   icon: Upload,       closable: true,  color: 'from-sketch-blue to-sketch-blueDeep' },
  graph:     { kind: 'graph',     title: '知识图谱',   icon: Share2,        closable: true,  color: 'from-sketch-purple to-sketch-pink' },
  qa:        { kind: 'qa',        title: '智能问答',   icon: MessageCircle,closable: true,  color: 'from-sketch-green to-sketch-blue' },
  path:      { kind: 'path',      title: '学习路径',   icon: Route,        closable: true,  color: 'from-sketch-orange to-sketch-red' },
  resources: { kind: 'resources', title: '相关学习资源', icon: BookOpen,    closable: true,  color: 'from-sketch-green to-sketch-yellow' },
  aigc:      { kind: 'aigc',      title: 'AIGC 生成图谱', icon: Sparkles,   closable: true,  color: 'from-sketch-pink to-sketch-orange' },
  learning:  { kind: 'learning',  title: '详细学习',      icon: BookOpen,    closable: true,  color: 'from-sketch-blue to-sketch-green' },
  quiz:      { kind: 'quiz',      title: '知识小测试',    icon: ClipboardCheck, closable: true, color: 'from-sketch-green to-sketch-blue' },
  visitor:   { kind: 'visitor',   title: '访客中心',      icon: Network,     closable: true,  color: 'from-sketch-orange to-sketch-red' },
};

export interface TabItem extends TabMeta {
  id: string; // = kind
}

interface TabContextValue {
  tabs: TabItem[];
  activeId: string;
  openTab: (kind: TabKind, title?: string) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

const TabContext = createContext<TabContextValue | null>(null);

const HOME_TAB: TabItem = { ...TAB_META.home, id: 'home' };
const APP_TAB_STATE = '__aigcTab';
const APP_TAB_INDEX = '__aigcTabIndex';

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabItem[]>([HOME_TAB]);
  const [activeId, setActiveId] = useState<string>('home');
  const [history, setHistory] = useState<string[]>(['home']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 将标签页导航写入浏览器历史，浏览器自身的前进/后退也能留在应用内。
  useEffect(() => {
    const currentState = window.history.state as Record<string, unknown> | null;
    if (!currentState?.[APP_TAB_STATE]) {
      window.history.replaceState(
        { ...(currentState ?? {}), [APP_TAB_STATE]: 'home', [APP_TAB_INDEX]: 0 },
        '',
        window.location.href,
      );
    }

    const onPopState = (event: PopStateEvent) => {
      const state = event.state as Record<string, unknown> | null;
      const tab = state?.[APP_TAB_STATE];
      if (typeof tab !== 'string' || !TAB_META[tab as TabKind]) return;
      const index = typeof state?.[APP_TAB_INDEX] === 'number' ? state[APP_TAB_INDEX] as number : 0;
      setActiveId(tab);
      setHistoryIndex(index);
      setHistory((current) => {
        if (current[index] === tab) return current;
        const next = [...current];
        next[index] = tab;
        return next;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((id: string) => {
    setActiveId(id);
    setHistory((current) => {
      const base = current.slice(0, historyIndex + 1);
      if (base[base.length - 1] === id) return current;
      const next = [...base, id];
      setHistoryIndex(next.length - 1);
      window.history.pushState(
        { ...(window.history.state ?? {}), [APP_TAB_STATE]: id, [APP_TAB_INDEX]: next.length - 1 },
        '',
        window.location.href,
      );
      return next;
    });
  }, [historyIndex]);

  const openTab = useCallback((kind: TabKind, title?: string) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === kind);
      if (existing) return prev; // 已存在不重复
      const meta = TAB_META[kind];
      return [...prev, { ...meta, id: kind, title: title ?? meta.title }];
    });
    navigate(kind);
  }, [navigate]);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      if (id === 'home') return prev; // 工作台不可关闭
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const next = prev.filter((t) => t.id !== id);
      // 关的是当前激活页 → 激活相邻
      setActiveId((cur) => {
        if (cur !== id) return cur;
        const fallback = next[idx] ?? next[idx - 1] ?? next[next.length - 1] ?? HOME_TAB;
        navigate(fallback.id);
        return fallback.id;
      });
      setHistory((current) => {
        const filtered = current.filter((entry) => entry !== id);
        const nextIndex = Math.max(0, Math.min(historyIndex, filtered.length - 1));
        setHistoryIndex(nextIndex);
        return filtered.length ? filtered : ['home'];
      });
      return next.length ? next : [HOME_TAB];
    });
  }, [historyIndex, navigate]);

  const setActive = useCallback((id: string) => navigate(id), [navigate]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    window.history.back();
  }, [historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    window.history.forward();
  }, [history.length, historyIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key === 'ArrowLeft' && historyIndex > 0) {
        event.preventDefault();
        goBack();
      }
      if (event.key === 'ArrowRight' && historyIndex < history.length - 1) {
        event.preventDefault();
        goForward();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goBack, goForward, history.length, historyIndex]);

  const value = useMemo(
    () => ({ tabs, activeId, openTab, closeTab, setActive, goBack, goForward, canGoBack: historyIndex > 0, canGoForward: historyIndex < history.length - 1 }),
    [tabs, activeId, openTab, closeTab, setActive, goBack, goForward, historyIndex, history.length],
  );

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabs() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabs must be used within TabProvider');
  return ctx;
}

// 给 Home/功能卡复用
export const HOME_CARDS: { kind: TabKind; title: string; desc: string; icon: LucideIcon; color: string }[] = [
  { kind: 'upload',    title: '文档上传',   desc: 'PDF / Word / PPT 解析',         icon: Upload,        color: 'from-sketch-blue to-sketch-blueDeep' },
  { kind: 'aigc',      title: 'AIGC 生成图谱', desc: '接入大模型 · 主题生成',     icon: Sparkles,       color: 'from-sketch-pink to-sketch-orange' },
  { kind: 'graph',     title: '知识图谱',   desc: '可视化 · 拖拽 · 探索',         icon: Share2,         color: 'from-sketch-purple to-sketch-pink' },
  { kind: 'qa',        title: '智能问答',   desc: 'RAG · 课程助教',               icon: MessageCircle,  color: 'from-sketch-green to-sketch-blue' },
  { kind: 'path',      title: '学习路径',   desc: '前置依赖 · 推荐',             icon: Route,          color: 'from-sketch-orange to-sketch-red' },
  { kind: 'resources', title: '相关学习资源', desc: 'AI 资源建议 · 导航',         icon: BookOpen,       color: 'from-sketch-green to-sketch-yellow' },
];

export { Network };
