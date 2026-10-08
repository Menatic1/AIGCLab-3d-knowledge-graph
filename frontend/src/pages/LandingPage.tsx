import { useState, useEffect, useRef } from 'react';
import {
  Network, Sparkles, BookOpen, MessageCircle, Route, Upload, GraduationCap,
  UserCog, Compass, Layers, Wand2, BarChart3, ArrowRight, ChevronDown,
} from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

/* ---------- 装饰：蓝图网格背景 ---------- */
function BlueprintBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#3f7ba0 1px, transparent 1px), linear-gradient(90deg, #3f7ba0 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* 流动的笔触装饰 */}
      <svg className="absolute top-20 -left-10 w-80 opacity-[0.08]" viewBox="0 0 300 200" fill="none">
        <path d="M10 100 C 60 20, 120 180, 180 80 S 280 120, 290 60" stroke="#3f7ba0" strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="10" cy="100" r="8" fill="#d18040" />
        <circle cx="290" cy="60" r="8" fill="#3f7ba0" />
      </svg>
      <svg className="absolute bottom-20 -right-10 w-96 opacity-[0.06]" viewBox="0 0 400 300" fill="none">
        <path d="M20 250 Q 100 50, 200 150 T 380 100" stroke="#8a5a8a" strokeWidth="5" strokeLinecap="round" fill="none" />
        <g fill="#5a8a5a">
          <circle cx="20" cy="250" r="6" /><circle cx="120" cy="120" r="5" /><circle cx="250" cy="130" r="5" /><circle cx="380" cy="100" r="6" />
        </g>
      </svg>
    </div>
  );
}

/* ---------- 滚动渐入动画 ---------- */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      {children}
    </div>
  );
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-paper-50 text-ink font-sans relative overflow-x-hidden">
      <BlueprintBg />

      {/* ============ 顶部导航 ============ */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-sketch-sm bg-white shadow-sketch logo-mark flex items-center justify-center border-2 border-ink/15 rotate-[-3deg] overflow-hidden">
            <img src="/logo.jpg" alt="智绘千里" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-lg font-bold handwritten tracking-wide leading-none">智绘千里</div>
            <div className="text-[10px] text-ink-light mt-0.5">AIGC 知识图谱智能导航系统</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-ink-light">
          <a href="#features" className="hover:text-ink transition-colors">功能模块</a>
          <a href="#intro" className="hover:text-ink transition-colors">系统简介</a>
          <a href="#highlights" className="hover:text-ink transition-colors">产品亮点</a>
        </nav>
        <button
          onClick={onEnter}
          className="sketch-btn-primary !py-2 !px-5 text-sm"
        >
          进入系统 <ArrowRight size={14} />
        </button>
      </header>

      {/* ============ Hero 区 ============ */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-sketch-blue/30 bg-sketch-blue/5 text-xs text-sketch-blueDeep mb-8 shadow-sketch-sm">
            <Sparkles size={13} />
            AIGC 驱动 · 知识图谱 · 智能学习导航
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="text-5xl md:text-7xl font-bold handwritten tracking-tight leading-[1.1] mb-6">
            以画笔绘就知识网络
            <br />
            <span className="bg-gradient-to-r from-sketch-blue via-sketch-purple to-sketch-pink bg-clip-text text-transparent">
              以智能导航千里学程
            </span>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="text-lg text-ink-light max-w-2xl mx-auto leading-relaxed mb-10">
            智绘千里把课程内容转化为可探索的知识图谱。教师构建知识，学生按图索骥，AI 助教全程相伴。
            从文档到图谱，从探索到掌握，一条完整的智能学习链路。
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onEnter} className="sketch-btn-primary !py-3.5 !px-8 text-base group">
              立即开始使用
              <ArrowRight size={16} className="inline-block group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#features" className="sketch-btn-secondary !py-3.5 !px-8 text-base">
              了解功能 <ChevronDown size={16} className="inline-block" />
            </a>
          </div>
        </Reveal>

        {/* 统计数据 */}
        <Reveal delay={400}>
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { num: '17+', label: '功能模块' },
              { num: '2', label: '角色端' },
              { num: '3D', label: '图谱可视化' },
              { num: 'AI', label: '智能助教' },
            ].map((s) => (
              <div key={s.label} className="sketch-card !p-5 bg-white/70">
                <div className="text-3xl font-bold handwritten text-sketch-blueDeep">{s.num}</div>
                <div className="text-xs text-ink-light mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ 功能区域划分 ============ */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-block px-3 py-1 rounded-full bg-sketch-orange/10 text-sketch-orangeDeep text-xs font-bold mb-3">功能架构</div>
            <h2 className="text-3xl md:text-4xl font-bold handwritten mb-3">双端协同 · 各司其职</h2>
            <p className="text-ink-light max-w-xl mx-auto">教师负责知识构建与图谱维护，学生聚焦探索学习与能力检验</p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 教师端 */}
          <Reveal>
            <div className="sketch-card !p-8 bg-gradient-to-br from-sketch-orange/5 to-paper-50 border-sketch-orange/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sketch-orange/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-sketch-sm bg-sketch-orange/15 flex items-center justify-center border-2 border-sketch-orange/30">
                    <UserCog size={24} className="text-sketch-orangeDeep" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold handwritten text-sketch-orangeDeep">教师端</h3>
                    <p className="text-xs text-ink-light">构建知识 · 维护图谱 · 管理课程</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: Upload, title: '文档解析建图', desc: '上传 PDF/Word/PPT，AI 自动提取知识点生成图谱' },
                    { icon: Wand2, title: 'AIGC 生成图谱', desc: '输入课程主题，大模型一键生成知识网络结构' },
                    { icon: Network, title: '图谱编辑', desc: '增删改节点与关系，所有操作持久化到数据库' },
                    { icon: Layers, title: '课程管理', desc: '创建课程、管理成员，每套课程独立图谱' },
                  ].map((f) => (
                    <div key={f.title} className="flex gap-3 p-3 rounded-sketch-sm bg-white/60 border border-ink/5 hover:border-sketch-orange/30 transition-colors">
                      <div className="w-9 h-9 rounded-sketch-sm bg-sketch-orange/10 flex items-center justify-center shrink-0">
                        <f.icon size={17} className="text-sketch-orangeDeep" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-ink">{f.title}</div>
                        <div className="text-xs text-ink-light mt-0.5">{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* 学生端 */}
          <Reveal delay={120}>
            <div className="sketch-card !p-8 bg-gradient-to-br from-sketch-purple/5 to-paper-50 border-sketch-purple/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sketch-purple/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-sketch-sm bg-sketch-purple/15 flex items-center justify-center border-2 border-sketch-purple/30">
                    <GraduationCap size={24} className="text-sketch-purple" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold handwritten text-sketch-purple">学生端</h3>
                    <p className="text-xs text-ink-light">探索图谱 · 深度学习 · 检验掌握</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: Network, title: '知识图谱探索', desc: '3D 力导向图可视化，按图索骥发现知识点' },
                    { icon: BookOpen, title: '详细学习', desc: '节点详情 + 多模态资源（图片/公式/代码/视频）' },
                    { icon: MessageCircle, title: '智能问答', desc: '基于课程内容的 RAG 问答，不懂就问' },
                    { icon: BarChart3, title: '知识小测试', desc: '答题检验 + 学习报告 + 个性化推荐' },
                  ].map((f) => (
                    <div key={f.title} className="flex gap-3 p-3 rounded-sketch-sm bg-white/60 border border-ink/5 hover:border-sketch-purple/30 transition-colors">
                      <div className="w-9 h-9 rounded-sketch-sm bg-sketch-purple/10 flex items-center justify-center shrink-0">
                        <f.icon size={17} className="text-sketch-purple" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-ink">{f.title}</div>
                        <div className="text-xs text-ink-light mt-0.5">{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ 系统简介 ============ */}
      <section id="intro" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="sketch-card !p-10 bg-gradient-to-br from-paper-50 via-sketch-blue/5 to-sketch-green/5 border-sketch-blue/20">
          <div className="grid md:grid-cols-[1fr_1.3fr] gap-10 items-center">
            <Reveal>
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-sketch-blue/10 text-sketch-blueDeep text-xs font-bold mb-3">系统简介</div>
                <h2 className="text-3xl font-bold handwritten mb-5">把课程变成一张<br/>可导航的知识地图</h2>
                <p className="text-ink-light leading-relaxed mb-4">
                  智绘千里是一套面向课程教学的 AIGC 知识图谱智能导航系统。核心思路是将课程内容从线性文档转化为结构化的知识网络，
                  让学习从"按页翻书"变为"按图探索"。
                </p>
                <p className="text-ink-light leading-relaxed">
                  教师通过文档上传或 AIGC 生成快速构建知识图谱，并可精细化编辑；学生以图谱为导航，
                  配合智能问答、学习路径、小测试等功能，形成"探索—学习—检验—推荐"的完整闭环。
                </p>
              </div>
            </Reveal>
            <Reveal delay={150}>
              {/* 系统流程示意 */}
              <div className="space-y-3">
                {[
                  { step: '01', title: '知识构建', desc: '文档上传 / AIGC 生成 / 手动编辑 → 知识图谱', box: 'bg-sketch-orange/10 border-sketch-orange/30', num: 'text-sketch-orangeDeep' },
                  { step: '02', title: '知识呈现', desc: '3D 力导向图可视化 · 分类筛选 · 关键词搜索', box: 'bg-sketch-blue/10 border-sketch-blue/30', num: 'text-sketch-blueDeep' },
                  { step: '03', title: '智能学习', desc: '详细学习 · 智能问答 · 学习路径 · 小测试', box: 'bg-sketch-purple/10 border-sketch-purple/30', num: 'text-sketch-purple' },
                  { step: '04', title: '反馈推荐', desc: '学习报告分析薄弱点 → 个性化资源推荐', box: 'bg-sketch-green/10 border-sketch-green/30', num: 'text-sketch-greenDeep' },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-4 p-4 rounded-sketch-sm bg-white/70 border-2 border-ink/5 shadow-sketch-sm">
                    <div className={`w-12 h-12 rounded-full ${s.box} border-2 flex items-center justify-center shrink-0`}>
                      <span className={`text-lg font-bold handwritten ${s.num}`}>{s.step}</span>
                    </div>
                    <div>
                      <div className="font-bold text-ink">{s.title}</div>
                      <div className="text-xs text-ink-light mt-0.5">{s.desc}</div>
                    </div>
                    <ArrowRight size={16} className="text-ink-light/40 ml-auto hidden md:block" />
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ 产品亮点 ============ */}
      <section id="highlights" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-block px-3 py-1 rounded-full bg-sketch-green/10 text-sketch-greenDeep text-xs font-bold mb-3">产品亮点</div>
            <h2 className="text-3xl md:text-4xl font-bold handwritten mb-3">为什么选择智绘千里</h2>
            <p className="text-ink-light max-w-xl mx-auto">四个核心能力，让知识图谱真正服务于教学</p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Wand2, box: 'bg-sketch-pink/10 border-sketch-pink/30', iconColor: 'text-sketch-pink',
              title: 'AIGC 一键生成',
              desc: '输入主题即可由大模型生成完整知识图谱，教师零门槛构图',
            },
            {
              icon: Network, box: 'bg-sketch-blue/10 border-sketch-blue/30', iconColor: 'text-sketch-blueDeep',
              title: '3D 图谱可视化',
              desc: '力导向布局直观呈现知识点关联，拖拽、筛选、搜索一应俱全',
            },
            {
              icon: Compass, box: 'bg-sketch-orange/10 border-sketch-orange/30', iconColor: 'text-sketch-orangeDeep',
              title: '智能学习路径',
              desc: '基于前置依赖自动推荐学习顺序，进度可视化跟踪',
            },
            {
              icon: Route, box: 'bg-sketch-green/10 border-sketch-green/30', iconColor: 'text-sketch-greenDeep',
              title: '完整学习闭环',
              desc: '探索 → 学习 → 问答 → 测试 → 报告 → 推荐，一条链路打通',
            },
          ].map((h, i) => (
            <Reveal key={h.title} delay={i * 100}>
              <div className="sketch-card !p-6 bg-white/70 hover:shadow-sketch transition-shadow group h-full">
                <div className={`w-12 h-12 rounded-sketch-sm ${h.box} border-2 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <h.icon size={22} className={h.iconColor} />
                </div>
                <h3 className="text-lg font-bold text-ink mb-2">{h.title}</h3>
                <p className="text-sm text-ink-light leading-relaxed">{h.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <Reveal>
          <div className="sketch-card !p-12 bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink text-center text-white border-ink/10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold handwritten mb-4">开启你的知识探索之旅</h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8">
                注册账号，选择教师或学生身份，立即体验知识图谱驱动的智能学习
              </p>
              <button
                onClick={onEnter}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-sketch-sm bg-white text-sketch-blueDeep font-bold shadow-sketch hover:shadow-sketch-lg hover:-translate-y-0.5 transition-all"
              >
                进入系统 <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ 底部 ============ */}
      <footer className="relative z-10 border-t-2 border-ink/10 bg-paper-100/50">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sketch-sm bg-white shadow-sketch-sm flex items-center justify-center border border-ink/10 overflow-hidden">
              <img src="/logo.jpg" alt="智绘千里" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-sm font-bold handwritten">智绘千里</div>
              <div className="text-[10px] text-ink-light">AIGC 知识图谱智能导航系统</div>
            </div>
          </div>
          <div className="text-xs text-ink-light">
            © 2026 智绘千里 · 以画笔绘就知识网络，以智能导航千里学程
          </div>
        </div>
      </footer>
    </div>
  );
}
