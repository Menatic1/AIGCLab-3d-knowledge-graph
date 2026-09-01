import { Network, BookOpen, Upload, Brain, Map } from 'lucide-react';

export default function Header() {
  return (
    <header className="relative z-10 bg-paper-50/80 backdrop-blur-sm border-b-2 border-ink/15 shadow-[0_2px_0_rgba(59,51,43,0.06)]">
      <div className="h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-sketch-sm bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink shadow-sketch flex items-center justify-center border-2 border-ink/20 rotate-[-3deg] hover:rotate-0 transition-transform">
              <Network size={24} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-sketch-yellow border-2 border-white shadow-sketch-sm flex items-center justify-center text-[10px] handwritten">
              AI
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-ink handwritten tracking-wide leading-tight">
              AIGC 课程知识图谱智能导航系统
            </h1>
            <p className="text-xs text-ink-light hidden md:block mt-0.5">
              Knowledge Graph · Intelligent Learning Navigator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-1 text-xs text-ink-light">
            <span className="w-2 h-2 rounded-full bg-sketch-green animate-pulse" />
            <span>系统就绪</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sketch-sm border-2 border-ink/15 bg-paper-100 shadow-sketch-sm hover:border-sketch-blue/40 transition-colors cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sketch-orange to-sketch-red flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-sm">
              学
            </div>
            <span className="text-sm font-medium text-ink hidden sm:block">学习者</span>
          </div>
        </div>
      </div>
    </header>
  );
}
