import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** 板书指令类型（与后端 LLM 生成的 schema 对应） */
export interface BoardCommand {
  type: 'write' | 'latex' | 'arrow' | 'box' | 'highlight';
  text?: string;
  tex?: string;
  // write/latex: 中心点相对坐标 0~1
  x?: number;
  y?: number;
  // arrow: 端点
  x1?: number; y1?: number; x2?: number; y2?: number;
  // box: 左上角 + 宽高（相对）
  w?: number; h?: number;
  // highlight: 高亮第 N 条指令
  target?: number;
}

interface Props {
  commands: BoardCommand[];
  highlightTarget?: number; // 当前要高亮的指令序号
  width?: number;
  height?: number;
}

interface RenderedLatex {
  id: number;
  html: string;
  left: number;
  top: number;
}

const HAND_FONT = '"Comic Sans MS", "Marker Felt", "华康少女体", "楷体", cursive';

/**
 * Canvas 手写动画板书引擎。
 * - write：手写体文字逐字淡入（模拟板书）
 * - latex：KaTeX 渲染为 HTML 叠加在 Canvas 上方
 * - arrow：沿路径渐进绘制
 * - box：逐边绘制
 * - highlight：给目标指令加发光描边
 */
export default function BlackboardCanvas({ commands, highlightTarget, height = 460 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [latexOverlays, setLatexOverlays] = useState<RenderedLatex[]>([]);
  const [containerWidth, setContainerWidth] = useState(800);
  const animFrameRef = useRef<number | null>(null);
  const drawnCountRef = useRef(0); // 已完成动画的指令数

  // 容器宽度自适应
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = containerWidth;
  const H = height;
  const dpr = window.devicePixelRatio || 1;

  // 绘制单条指令（带动画）
  const drawCommand = (ctx: CanvasRenderingContext2D, cmd: BoardCommand, index: number, progress: number, highlight: boolean) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lw = highlight ? 4.5 : 2.6;
    ctx.lineWidth = lw;
    ctx.strokeStyle = highlight ? '#d18040' : '#3b332b';
    ctx.fillStyle = highlight ? '#d18040' : '#3b332b';
    ctx.font = `${highlight ? 26 : 22}px ${HAND_FONT}`;

    if (cmd.type === 'write') {
      const cx = (cmd.x ?? 0.5) * W;
      const cy = (cmd.y ?? 0.5) * H;
      const text = cmd.text || '';
      // 逐字绘制：progress 0~1 决定显示多少字
      const visible = Math.ceil(text.length * progress);
      const shown = text.slice(0, visible);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 手写感：轻微抖动 + 透明度渐变
      ctx.globalAlpha = 0.6 + 0.4 * progress;
      ctx.fillText(shown, cx, cy);
      // 文字下方画一道板书下划线（手写感）
      if (progress > 0.6 && visible > 0) {
        const tw = ctx.measureText(shown).width;
        ctx.beginPath();
        ctx.strokeStyle = highlight ? 'rgba(209,128,64,0.5)' : 'rgba(59,51,43,0.25)';
        ctx.lineWidth = 1.5;
        ctx.moveTo(cx - tw / 2 - 4, cy + 16);
        ctx.lineTo(cx + tw / 2 + 4, cy + 16);
        ctx.stroke();
      }
    } else if (cmd.type === 'arrow') {
      const x1 = (cmd.x1 ?? 0) * W, y1 = (cmd.y1 ?? 0) * H;
      const x2 = (cmd.x2 ?? 1) * W, y2 = (cmd.y2 ?? 1) * H;
      // 渐进绘制
      const ex = x1 + (x2 - x1) * progress;
      const ey = y1 + (y2 - y1) * progress;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // 箭头头部（接近终点时画）
      if (progress > 0.85) {
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const head = 12;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
        ctx.stroke();
      }
    } else if (cmd.type === 'box') {
      const x = (cmd.x ?? 0.1) * W, y = (cmd.y ?? 0.1) * H;
      const w = (cmd.w ?? 0.3) * W, h = (cmd.h ?? 0.2) * H;
      // 逐边绘制：4 段，progress 映射到 4 段
      const seg = progress * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      // 上边
      if (seg >= 1) ctx.lineTo(x + w, y); else { ctx.lineTo(x + w * seg, y); ctx.stroke(); ctx.restore(); return; }
      // 右边
      if (seg >= 2) ctx.lineTo(x + w, y + h); else { ctx.lineTo(x + w, y + h * (seg - 1)); ctx.stroke(); ctx.restore(); return; }
      // 下边
      if (seg >= 3) ctx.lineTo(x, y + h); else { ctx.lineTo(x + w * (1 - (seg - 2)), y + h); ctx.stroke(); ctx.restore(); return; }
      // 左边
      const lp = Math.min(1, seg - 3);
      ctx.lineTo(x, y + h - h * lp);
      ctx.stroke();
    }
    ctx.restore();
  };

  // 主绘制循环：commands 变化时，从 drawnCountRef 开始为新指令播放动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 背景纸张色
    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, W, H);
    // 浅网格（黑板感）
    ctx.strokeStyle = 'rgba(59,51,43,0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // 重绘所有已完成指令 + 新指令动画
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    let newLatex: RenderedLatex[] = [];

    const total = commands.length;
    const startIdx = Math.min(drawnCountRef.current, total); // 从这里开始要动画
    // 先快照绘制 0..startIdx-1（已完成）
    for (let i = 0; i < startIdx && i < total; i++) {
      const cmd = commands[i];
      if (cmd.type === 'latex') {
        // latex 已在 overlay，跳过 canvas
      } else {
        drawCommand(ctx, cmd, i, 1, highlightTarget === i);
      }
    }

    // 收集已有 latex overlay（保留 startIdx 之前的）
    newLatex = commands.slice(0, startIdx)
      .map((cmd, i) => ({ cmd, i }))
      .filter(({ cmd }) => cmd.type === 'latex' && cmd.tex)
      .map(({ cmd, i }) => ({
        id: i,
        html: katex.renderToString(cmd.tex!, { throwOnError: false, displayMode: false }),
        left: (cmd.x ?? 0.5) * W,
        top: (cmd.y ?? 0.5) * H,
      }));

    // 没有新指令 → 直接提交 latex overlay
    if (startIdx >= total) {
      setLatexOverlays(newLatex);
      return;
    }

    // 为新指令逐条播放动画
    let currentNew = startIdx;
    let frameStart = performance.now();
    const ANIM_MS = 380; // 每条指令动画时长

    const tick = (now: number) => {
      const elapsed = now - frameStart;
      const progress = Math.min(1, elapsed / ANIM_MS);

      // 重绘已完成区
      ctx.fillStyle = '#faf6ee';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(59,51,43,0.05)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      for (let i = 0; i < currentNew; i++) {
        const cmd = commands[i];
        if (cmd.type === 'latex') continue;
        drawCommand(ctx, cmd, i, 1, highlightTarget === i);
      }
      // 当前动画指令
      const cmd = commands[currentNew];
      if (cmd) {
        if (cmd.type === 'latex') {
          // latex 不在 canvas 动画，直接加入 overlay
          newLatex.push({
            id: currentNew,
            html: katex.renderToString(cmd.tex!, { throwOnError: false, displayMode: false }),
            left: (cmd.x ?? 0.5) * W,
            top: (cmd.y ?? 0.5) * H,
          });
        } else {
          drawCommand(ctx, cmd, currentNew, progress, highlightTarget === currentNew);
        }
      }
      setLatexOverlays([...newLatex]);

      if (progress >= 1) {
        // 这条完成
        currentNew++;
        drawnCountRef.current = currentNew;
        frameStart = now;
        if (currentNew >= total) {
          // 全部完成
          return;
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [commands, highlightTarget, W, H, dpr]);

  // commands 被重置（换步）时清空已绘制计数
  useEffect(() => {
    if (commands.length === 0) {
      drawnCountRef.current = 0;
      setLatexOverlays([]);
    } else if (commands.length < drawnCountRef.current) {
      drawnCountRef.current = 0;
    }
  }, [commands.length]);

  return (
    <div ref={containerRef} className="relative w-full rounded-sketch-md border-2 border-ink/20 overflow-hidden shadow-sketch-sm bg-[#faf6ee]">
      <canvas ref={canvasRef} className="block" />
      {/* KaTeX 公式叠加层 */}
      <div className="absolute inset-0 pointer-events-none">
        {latexOverlays.map((l) => (
          <div
            key={l.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-ink"
            style={{
              left: l.left,
              top: l.top,
              fontSize: '22px',
              color: highlightTarget === l.id ? '#d18040' : '#3b332b',
              fontWeight: highlightTarget === l.id ? 700 : 500,
              textShadow: highlightTarget === l.id ? '0 0 8px rgba(209,128,64,0.4)' : 'none',
            }}
            dangerouslySetInnerHTML={{ __html: l.html }}
          />
        ))}
      </div>
      {/* 左上角"黑板"标识 */}
      <div className="absolute top-2 left-3 text-[10px] text-ink-light/60 handwritten">板书</div>
    </div>
  );
}
