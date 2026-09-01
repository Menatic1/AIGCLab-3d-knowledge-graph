import { NavLink } from 'react-router-dom';
import { Upload, Share2, MessageCircle, Route, Sparkles } from 'lucide-react';
import { useKnowledge } from '../../context/KnowledgeContext';

interface MenuItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  desc: string;
}

const MENU: MenuItem[] = [
  { to: '/upload', label: '文档上传', icon: Upload, desc: '解析 · 抽取' },
  { to: '/graph', label: '图谱查看', icon: Share2, desc: '可视化 · 探索' },
  { to: '/qa', label: '智能问答', icon: MessageCircle, desc: 'RAG · 助教' },
  { to: '/path', label: '学习路径', icon: Route, desc: '推荐 · 导航' },
];

export default function Sidebar() {
  const { graph, masteredIds } = useKnowledge();
  const masteredCount = masteredIds.size;
  const totalNodes = graph?.nodes.length ?? 0;
  const pct = totalNodes === 0 ? 0 : Math.round((masteredCount / totalNodes) * 100);

  return (
    <aside className="relative z-10 w-60 shrink-0 bg-paper-50/70 backdrop-blur-sm border-r-2 border-ink/15 flex flex-col">
      <nav className="flex-1 p-4 space-y-2">
        {MENU.map((item, idx) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 px-3.5 py-3 rounded-sketch-sm border-2 transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-sketch',
                isActive
                  ? 'bg-gradient-to-br from-sketch-blue/90 to-sketch-purple/90 text-white border-sketch-blueDeep shadow-sketch-sm rotate-[-0.5deg]'
                  : 'bg-paper-100/70 text-ink border-ink/15 hover:border-sketch-blue/40 hover:bg-paper-50',
              ].join(' ')
            }
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <item.icon
              size={22}
              strokeWidth={2.2}
              className="shrink-0 group-hover:scale-110 transition-transform"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] leading-tight">{item.label}</div>
              <div
                className={
                  'text-[11px] mt-0.5 leading-tight ' +
                  (false ? '' : '')
                }
                style={{ opacity: 0.8 }}
              >
                <span className="opacity-75">{item.desc}</span>
              </div>
            </div>
          </NavLink>
        ))}
      </nav>

      {/* 学习进度面板 */}
      <div className="p-4 border-t-2 border-ink/10">
        <div className="sketch-card p-3 relative overflow-hidden">
          <div className="absolute top-1 right-2 opacity-20">
            <Sparkles size={28} className="text-sketch-orange" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-sketch-orange/20 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-sketch-orange" />
            </div>
            <span className="text-sm font-bold text-ink">我的学习进度</span>
          </div>
          <div className="text-[11px] text-ink-light mb-1.5">
            已掌握 <span className="font-bold text-sketch-greenDeep">{masteredCount}</span> /{' '}
            {totalNodes || '--'} 个知识点
          </div>
          <div className="relative h-3 bg-paper-200 rounded-full border border-ink/15 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-sketch-green via-sketch-yellow to-sketch-orange transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgba(255,255,255,0.3)_6px_12px)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right text-[11px] font-bold text-sketch-orangeDeep mt-1 handwritten">
            {pct}%
          </div>
        </div>
      </div>
    </aside>
  );
}
