import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  Home,
  Upload,
  Share2,
  MessageCircle,
  Route,
  BookOpen,
  Sparkles,
  Network,
  PenLine,
  Library,
  type LucideIcon,
} from 'lucide-react';

// 标签页种类
export type TabKind =
  | 'home'
  | 'upload'
  | 'graph'
  | 'graph-list'
  | 'qa'
  | 'path'
  | 'resources'
  | 'aigc'
  | 'tutor';

export interface TabMeta {
  kind: TabKind;
  title: string;
  icon: LucideIcon;
  closable: boolean;
  color: string; // tailwind 渐变
}

// 所有功能的元信息（标题/图标/颜色）
export const TAB_META: Record<TabKind, TabMeta> = {
  home:       { kind: 'home',       title: '工作台',     icon: Home,         closable: false, color: 'from-sketch-blue to-sketch-purple' },
  upload:     { kind: 'upload',     title: '文档上传',   icon: Upload,       closable: true,  color: 'from-sketch-blue to-sketch-blueDeep' },
  graph:      { kind: 'graph',      title: '知识图谱',   icon: Share2,        closable: true,  color: 'from-sketch-purple to-sketch-pink' },
  'graph-list': { kind: 'graph-list', title: '我的图谱', icon: Library,     closable: true,  color: 'from-sketch-blue to-sketch-blueDeep' },
  qa:         { kind: 'qa',         title: '智能问答',   icon: MessageCircle,closable: true,  color: 'from-sketch-green to-sketch-blue' },
  path:       { kind: 'path',       title: '学习路径',   icon: Route,        closable: true,  color: 'from-sketch-orange to-sketch-red' },
  resources:  { kind: 'resources',  title: '相关学习资源', icon: BookOpen,    closable: true,  color: 'from-sketch-green to-sketch-yellow' },
  aigc:       { kind: 'aigc',       title: 'AIGC 生成图谱', icon: Sparkles,   closable: true,  color: 'from-sketch-pink to-sketch-orange' },
  tutor:      { kind: 'tutor',      title: 'AI 讲题老师',  icon: PenLine,    closable: true,  color: 'from-sketch-blue to-sketch-green' },
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
}

const TabContext = createContext<TabContextValue | null>(null);

const HOME_TAB: TabItem = { ...TAB_META.home, id: 'home' };

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabItem[]>([HOME_TAB]);
  const [activeId, setActiveId] = useState<string>('home');

  const openTab = useCallback((kind: TabKind, title?: string) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === kind);
      if (existing) return prev; // 已存在不重复
      const meta = TAB_META[kind];
      return [...prev, { ...meta, id: kind, title: title ?? meta.title }];
    });
    setActiveId(kind);
  }, []);

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
        return fallback.id;
      });
      return next.length ? next : [HOME_TAB];
    });
  }, []);

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const value = useMemo(
    () => ({ tabs, activeId, openTab, closeTab, setActive }),
    [tabs, activeId, openTab, closeTab, setActive],
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
  { kind: 'graph-list', title: '我的图谱',   desc: '独立存储 · 课程切换 · 管理',  icon: Library,        color: 'from-sketch-blue to-sketch-blueDeep' },
  { kind: 'upload',    title: '文档上传',   desc: 'PDF / Word / PPT 解析',         icon: Upload,        color: 'from-sketch-blue to-sketch-blueDeep' },
  { kind: 'aigc',      title: 'AIGC 生成图谱', desc: '接入大模型 · 主题生成',     icon: Sparkles,       color: 'from-sketch-pink to-sketch-orange' },
  { kind: 'graph',     title: '知识图谱',   desc: '可视化 · 拖拽 · 探索',         icon: Share2,         color: 'from-sketch-purple to-sketch-pink' },
  { kind: 'qa',        title: '智能问答',   desc: 'RAG · 课程助教',               icon: MessageCircle,  color: 'from-sketch-green to-sketch-blue' },
  { kind: 'path',      title: '学习路径',   desc: '前置依赖 · 推荐',             icon: Route,          color: 'from-sketch-orange to-sketch-red' },
  { kind: 'resources', title: '相关学习资源', desc: 'AI 资源建议 · 导航',         icon: BookOpen,       color: 'from-sketch-green to-sketch-yellow' },
  { kind: 'tutor',     title: 'AI 讲题老师',  desc: '拍照讲题 · 板书 · 练习',     icon: PenLine,        color: 'from-sketch-blue to-sketch-green' },
];

export { Network };
