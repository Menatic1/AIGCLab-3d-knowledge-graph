const path = require('path');
const fs = require('fs');
const PptxGenJS = require('pptxgenjs');

const ROOT = 'd:/项目文件夹/aigc课程';
const SHOT = ROOT + '/赛题10_智绘千里_AIGC知识图谱智能导学系统/S3/演示素材/截图';
const MEDIA = ROOT + '/scripts/ppt/media/word/media';
const MANUAL = ROOT + '/assets/说明书截图';
const OUT = process.env.PPT_OUT || (ROOT + '/赛题10_智绘千里_AIGC知识图谱智能导学系统/S3/智绘千里_产品说明.pptx');

const W = 13.333, H = 7.5, M = 0.62, CW = W - M * 2;
const F = '微软雅黑', FL = 'Arial';

const C = {
  ink: '1F2A37', ink2: '55606E', muted: '8B94A1',
  hair: 'E4E0D6', hair2: 'EDE9E0',
  green: '156352', greenDeep: '0E4A3D', greenSoft: 'E9F1ED', greenLine: 'C6DAD2',
  amber: 'FFC000', amberDeep: 'D9A400', amberSoft: 'FFF4D8',
  blue: '2E6BA8', blueSoft: 'E9F1F8',
  purple: '6B5BA8', purpleSoft: 'EFECF8',
  red: 'B85C50',
  slate: '2D3847', slateDeep: '232D3A',
  bg: 'F7F5F0', surface: 'FFFFFF',
};

let tok;
const R = (s, o) => s.addShape('rect', o);
const RR = (s, o) => s.addShape('roundRect', { rectRadius: 0.07, ...o });
const LN = (s, o) => s.addShape('line', o);
const T = (s, t, o) => s.addText(t, o);
const IMG = (s, f, o) => s.addImage({ path: f, ...o });
const STOCK = ROOT + '/scripts/ppt/_stock';
const sh = (f) => path.join(SHOT, f);
const md = (f) => path.join(MEDIA, f);
const st = (f) => path.join(STOCK, f);

function bg(s, c) { s.background = { color: c || C.bg }; }
function frame(s, n) {
  R(s, { x: M, y: H - 0.50, w: CW, h: 0.01, fill: { color: C.hair } });
  T(s, '智绘千里 · AIGC 知识图谱智能导学系统', { x: M, y: H - 0.44, w: 8.4, h: 0.26, fontFace: F, fontSize: 8.5, color: C.muted, valign: 'middle', margin: 0 });
  tok(s, String(n).padStart(2, '0'), { x: W - M - 0.8, y: H - 0.45, w: 0.8, h: 0.28, fontFace: FL, fontSize: 10.5, bold: true, color: C.green, align: 'right' });
}
function head(s, cn, en, num) {
  R(s, { x: M, y: 0.46, w: 0.125, h: 0.44, fill: { color: C.green } });
  R(s, { x: M + 0.175, y: 0.46, w: 0.045, h: 0.44, fill: { color: C.amber } });
  T(s, cn, { x: M + 0.36, y: 0.40, w: 8.0, h: 0.56, fontFace: F, fontSize: 24, bold: true, color: C.ink, valign: 'middle', margin: 0 });
  T(s, en, { x: M + 0.37, y: 0.99, w: 8.0, h: 0.24, fontFace: FL, fontSize: 10, color: C.muted, charSpacing: 2.4, valign: 'middle', margin: 0 });
  tok(s, num, { x: W - M - 1.5, y: 0.30, w: 1.5, h: 0.78, fontFace: FL, fontSize: 42, bold: true, color: C.hair2, align: 'right', valign: 'middle' });
}
function claim(s, text, y) {
  const yy = y == null ? 1.36 : y;
  T(s, text, { x: M, y: yy, w: CW, h: 0.40, fontFace: F, fontSize: 15.5, bold: true, color: C.greenDeep, valign: 'middle', margin: 0 });
  R(s, { x: M, y: yy + 0.44, w: 0.62, h: 0.045, fill: { color: C.amber } });
}
function card(s, x, y, w, h, o) {
  o = o || {};
  RR(s, { x, y, w, h, fill: { color: o.fill || C.surface }, line: { color: o.line || C.hair, width: 0.75 }, rectRadius: o.radius == null ? 0.07 : o.radius });
}
function badge(s, n, x, y, size, fill, color, fs) {
  const z = size || 0.40;
  RR(s, { x, y, w: z, h: z, fill: { color: fill || C.green }, rectRadius: 0.09 });
  tok(s, n, { x, y, w: z, h: z, fontFace: FL, fontSize: fs || 13, bold: true, color: color || 'FFFFFF', align: 'center', valign: 'middle' });
}
function chip(s, text, x, y, w, o) {
  o = o || {};
  RR(s, { x, y, w, h: o.h || 0.32, fill: { color: o.fill || C.greenSoft }, line: { color: o.line || C.greenLine, width: 0.75 }, rectRadius: 0.16 });
  tok(s, text, { x, y, w, h: o.h || 0.32, fontFace: F, fontSize: o.fs || 9.5, bold: true, color: o.color || C.green, align: 'center', valign: 'middle' });
}

// ---------- 产品功能页：左侧深色导航 + 右侧内容 ----------
const FN = [
  '首页与访客中心', '登录注册与角色分流', '教师工作台与文档上传', 'AIGC 生成与图谱编辑',
  '知识图谱探索', '智能问答（RAG）', '学习路径与学习闭环',
];
const FN_EN = ['Home & Visitor Center', 'Sign-in & Role Routing', 'Teacher Desk & Upload', 'AIGC & Graph Editing', 'Graph Exploration', 'RAG Q&A', 'Path & Learning Loop'];

function sidebar(s, active) {
  R(s, { x: 0, y: 0, w: 2.72, h: H, fill: { color: C.greenDeep } });
  R(s, { x: 0, y: 0, w: 2.72, h: 1.42, fill: { color: C.slateDeep } });
  T(s, '产品功能', { x: 0.30, y: 0.36, w: 2.2, h: 0.52, fontFace: F, fontSize: 27, bold: true, color: 'FFFFFF', valign: 'middle', margin: 0 });
  T(s, 'PRODUCT FUNCTION', { x: 0.32, y: 0.90, w: 2.2, h: 0.26, fontFace: FL, fontSize: 9.5, color: '9FB3AC', charSpacing: 2.2, valign: 'middle', margin: 0 });
  R(s, { x: 0.30, y: 1.20, w: 0.42, h: 0.04, fill: { color: C.amber } });
  FN.forEach((name, i) => {
    const y = 1.86 + i * 0.635;
    const on = i === active;
    if (on) {
      RR(s, { x: 0.24, y, w: 2.22, h: 0.50, fill: { color: C.amber }, rectRadius: 0.08 });
    } else {
      R(s, { x: 0.24, y: y + 0.11, w: 0.045, h: 0.28, fill: { color: '4E7A70' } });
    }
    tok(s, String(i + 1).padStart(2, '0'), { x: 0.40, y, w: 0.38, h: 0.50, fontFace: FL, fontSize: 12, bold: true, color: on ? C.greenDeep : '7FA096', valign: 'middle' });
    T(s, name, { x: 0.78, y, w: 1.72, h: 0.50, fontFace: F, fontSize: 11.5, bold: on, color: on ? C.greenDeep : 'D5E2DE', valign: 'middle', margin: 0 });
  });
  T(s, '智绘千里', { x: 0.30, y: 6.62, w: 2.2, h: 0.30, fontFace: F, fontSize: 11, bold: true, color: '7FA096', valign: 'middle', margin: 0 });
  T(s, 'AIGC 知识图谱智能导学系统', { x: 0.30, y: 6.90, w: 2.2, h: 0.26, fontFace: F, fontSize: 8.5, color: '5C7D74', valign: 'middle', margin: 0 });
}

const X0 = 3.06, XW = W - M - X0; // 内容区宽度 9.653

function fnTitle(s, cn, en) {
  RR(s, { x: X0, y: 0.60, w: XW, h: 0.56, fill: { color: C.greenSoft }, rectRadius: 0.06 });
  R(s, { x: X0, y: 0.60, w: 0.085, h: 0.56, fill: { color: C.green } });
  T(s, cn, { x: X0 + 0.24, y: 0.60, w: 6.4, h: 0.56, fontFace: F, fontSize: 16.5, bold: true, color: C.ink, valign: 'middle', margin: 0 });
  T(s, en, { x: X0 + XW - 4.0, y: 0.60, w: 3.76, h: 0.56, fontFace: FL, fontSize: 9.5, color: C.muted, charSpacing: 1.6, align: 'right', valign: 'middle', margin: 0 });
}

function fnFoot(s, n) {
  R(s, { x: X0, y: H - 0.46, w: XW, h: 0.01, fill: { color: C.hair } });
  T(s, '智绘千里 · AIGC 知识图谱智能导学系统', { x: X0, y: H - 0.40, w: 7.6, h: 0.26, fontFace: F, fontSize: 8.5, color: C.muted, valign: 'middle', margin: 0 });
  tok(s, String(n).padStart(2, '0'), { x: W - M - 0.8, y: H - 0.41, w: 0.8, h: 0.28, fontFace: FL, fontSize: 10.5, bold: true, color: C.green, align: 'right' });
}

// 说明卡：标题 + 要点
function noteCard(s, x, y, w, h, title, items, accent) {
  const ac = accent || C.green;
  card(s, x, y, w, h);
  R(s, { x, y: y + 0.30, w: 0.055, h: h - 0.60, fill: { color: ac } });
  T(s, title, { x: x + 0.28, y: y + 0.24, w: w - 0.56, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: C.ink, valign: 'middle', margin: 0 });
  T(s, items.map((t) => ({ text: t, options: { bullet: { code: '25AA' }, breakLine: true, paraSpaceAfter: 7 } })),
    { x: x + 0.28, y: y + 0.64, w: w - 0.54, h: h - 0.86, fontFace: F, fontSize: 10.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.05 });
}

function shot(s, file, x, y, w, o) {
  o = o || {};
  const h = w / 1.7778;
  card(s, x - 0.055, y - 0.055, w + 0.11, h + 0.11, { fill: C.surface, line: C.hair, radius: 0.05 });
  IMG(s, sh(file), { x, y, w, h });
  if (o.cap) {
    T(s, o.cap, { x, y: y + h + 0.11, w, h: 0.26, fontFace: F, fontSize: 9.5, color: C.muted, align: 'center', valign: 'middle', margin: 0 });
  }
}

// 真实照片：等比裁切填充 + 白色相框 + 可选图注
function photo(s, file, x, y, w, h, o) {
  o = o || {};
  card(s, x - 0.055, y - 0.055, w + 0.11, h + 0.11, { fill: C.surface, line: o.line || C.hair, radius: 0.05 });
  s.addImage({ path: st(file), x, y, w, h, sizing: { type: 'cover', w, h } });
  if (o.cap) {
    T(s, o.cap, { x: x - 0.10, y: y + h + 0.06, w: w + 0.20, h: 0.24, fontFace: F, fontSize: 9, color: C.muted, align: 'center', valign: 'middle', margin: 0 });
  }
}

function credit(s) {
  T(s, '图片素材来源：Unsplash', { x: W - M - 3.30, y: H - 0.44, w: 2.40, h: 0.26, fontFace: F, fontSize: 8.5, color: C.muted, align: 'right', valign: 'middle', margin: 0 });
}

function descBand(s, x, y, w, text, h) {
  const hh = h || 0.98;
  card(s, x, y, w, hh, { fill: C.surface });
  R(s, { x, y: y + 0.16, w: 0.05, h: hh - 0.32, fill: { color: C.green } });
  T(s, text, { x: x + 0.26, y: y + 0.14, w: w - 0.5, h: hh - 0.28, fontFace: F, fontSize: 11, color: C.ink2, valign: 'middle', margin: 0, lineSpacingMultiple: 1.12 });
}

function chipsRow(s, items, x, y, w, o) {
  o = o || {};
  const gap = 0.14;
  const cw = (w - gap * (items.length - 1)) / items.length;
  items.forEach((t, i) => chip(s, t, x + i * (cw + gap), y, cw, { h: o.h || 0.34, fs: o.fs || 10, fill: o.fill, line: o.line, color: o.color }));
}

async function main() {
  ({ addSingleLineToken: tok } = await import('./pptx-text-guards.mjs'));
  const p = new PptxGenJS();
  p.defineLayout({ name: 'D16x9', width: W, height: H });
  p.layout = 'D16x9';
  p.author = '智绘千里项目团队';
  p.title = '智绘千里 · AIGC 知识图谱智能导学系统 · 产品说明';

  // ============ P1 项目概述与背景 ============
  {
    const s = p.addSlide(); bg(s, C.bg);
    R(s, { x: 0, y: 0, w: 0.28, h: H, fill: { color: C.greenDeep } });
    R(s, { x: 0.28, y: 0, w: 0.06, h: H, fill: { color: C.amber } });
    for (let i = 0; i < 9; i++) LN(s, { x: 7.55, y: 0.0 + i * 0.84, w: 5.79, h: 0, line: { color: 'E8E3D8', width: 0.5 } });
    for (let i = 0; i < 7; i++) LN(s, { x: 7.55 + i * 0.83, y: 0, w: 0, h: H, line: { color: 'E8E3D8', width: 0.5 } });
    chip(s, 'AIGC 驱动 · 知识图谱 · 智能学习导航', M + 0.10, 0.72, 3.30, { h: 0.36, fs: 10.5 });
    T(s, '智绘千里', { x: M + 0.06, y: 1.24, w: 6.6, h: 1.10, fontFace: F, fontSize: 54, bold: true, color: C.greenDeep, valign: 'middle', margin: 0, charSpacing: 3 });
    T(s, 'AIGC 知识图谱智能导学系统', { x: M + 0.10, y: 2.34, w: 6.6, h: 0.48, fontFace: F, fontSize: 20, bold: true, color: C.ink, valign: 'middle', margin: 0, charSpacing: 1.2 });
    R(s, { x: M + 0.10, y: 2.90, w: 0.66, h: 0.05, fill: { color: C.amber } });
    T(s, '以画笔绘就知识网络，以智能导航千里学程。\n教师构建知识，学生按图索骥，AI 助教全程相伴——\n从文档到图谱，从探索到掌握，一条完整的智能学习链路。',
      { x: M + 0.10, y: 3.10, w: 6.10, h: 1.20, fontFace: F, fontSize: 12.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.30 });
    const stats = [['17+', '功能模块'], ['2', '角色端'], ['3D', '图谱可视化'], ['AI', '智能助教']];
    const sw = 1.40, sgap = 0.16;
    stats.forEach((sq, i) => {
      const x = M + 0.10 + i * (sw + sgap);
      card(s, x, 4.46, sw, 1.06, { fill: C.surface });
      T(s, sq[0], { x, y: 4.58, w: sw, h: 0.48, fontFace: FL, fontSize: 21, bold: true, color: C.green, align: 'center', valign: 'middle', margin: 0 });
      T(s, sq[1], { x, y: 5.06, w: sw, h: 0.32, fontFace: F, fontSize: 9.5, color: C.ink2, align: 'center', valign: 'middle', margin: 0 });
    });
    const tri = [['15.jpg', '课堂学习'], ['02.jpg', '师生研讨'], ['31.jpg', '团队协作']];
    const tw = 1.98, tgap = 0.08;
    tri.forEach((t, i) => {
      photo(s, t[0], M + 0.10 + i * (tw + tgap), 5.66, tw, 1.00, { cap: t[1] });
    });
    card(s, 7.75, 1.18, 5.35, 3.28, { fill: C.surface, radius: 0.05 });
    IMG(s, sh('01_首页.png'), { x: 7.90, y: 1.33, w: 5.05, h: 2.84 });
    T(s, '系统首页 · 蓝图 + 手绘视觉风格', { x: 7.90, y: 4.20, w: 5.05, h: 0.26, fontFace: F, fontSize: 9.5, color: C.muted, align: 'center', valign: 'middle', margin: 0 });
    card(s, 7.75, 4.68, 5.35, 1.94, { fill: C.greenSoft, line: C.greenLine });
    T(s, '面向高校课程教学场景', { x: 7.99, y: 4.86, w: 4.9, h: 0.32, fontFace: F, fontSize: 12.5, bold: true, color: C.greenDeep, valign: 'middle', margin: 0 });
    T(s, '课程知识体系日益庞大、知识点分散在多章节与多类材料之中。知识图谱作为结构化知识组织方式价值明确，却在教学落地中面临建图成本高、导航缺失、答疑受限、进度难量化等现实阻力。智绘千里以 AIGC 重构建图与学习全流程。',
      { x: 7.99, y: 5.22, w: 4.90, h: 1.26, fontFace: F, fontSize: 10.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.16 });
    R(s, { x: M, y: H - 0.50, w: CW, h: 0.01, fill: { color: C.hair } });
    T(s, '智绘千里 · AIGC 知识图谱智能导学系统', { x: M, y: H - 0.44, w: 8.4, h: 0.26, fontFace: F, fontSize: 8.5, color: C.muted, valign: 'middle', margin: 0 });
    credit(s);
    tok(s, '01', { x: W - M - 0.8, y: H - 0.45, w: 0.8, h: 0.28, fontFace: FL, fontSize: 10.5, bold: true, color: C.green, align: 'right' });
  }

  // ============ P2 痛点分析 ============
  {
    const s = p.addSlide(); bg(s); head(s, '痛点分析', 'PAIN POINTS', '02');
    claim(s, '知识图谱的价值已被广泛认可，真正落地却卡在四个环节');
    const items = [
      ['01', '教师建图效率低', '手工绘制一张几十节点的课程图谱需数小时甚至数天，且教学内容迭代后维护成本居高不下，图谱难以真正落地。', '建图慢 · 维护贵'],
      ['02', '学生缺乏结构化导航', '按教材章节线性学习，"只见树木不见森林"，难以建立完整的课程知识体系，学习效率与理解深度受限。', '无全局 · 难进阶'],
      ['03', '课后答疑受时空限制', '传统师生答疑受限于时间与空间，通用大模型的回答缺乏课程针对性，无法与具体课程的知识结构深度结合。', '不及时 · 不贴合'],
      ['04', '学习进度难追踪量化', '学生对自身学习状况缺乏量化认知，教师也难以全面掌握每个学生的进度与薄弱环节，指导缺乏依据。', '无量化 · 难诊断'],
    ];
    const cw = 7.00, ch = 1.00;
    items.forEach((it, i) => {
      const x = M, y = 2.06 + i * 1.08;
      card(s, x, y, cw, ch, { fill: C.surface });
      badge(s, it[0], x + 0.26, y + 0.16, 0.42, C.green, 'FFFFFF', 14);
      T(s, it[1], { x: x + 0.86, y: y + 0.14, w: 3.50, h: 0.40, fontFace: F, fontSize: 15, bold: true, color: C.ink, valign: 'middle', margin: 0 });
      chip(s, it[3], x + 4.54, y + 0.20, 2.20, { h: 0.30, fs: 9, fill: C.amberSoft, line: 'F0D79A', color: C.amberDeep });
      T(s, it[2], { x: x + 0.32, y: y + 0.62, w: cw - 0.64, h: 0.34, fontFace: F, fontSize: 10.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.14 });
    });
    photo(s, '35.jpg', 7.92, 2.06, 4.793, 4.00, { cap: '真实场景：碎片化学习与信息过载' });
    R(s, { x: M, y: 6.42, w: CW, h: 0.48, fill: { color: C.greenSoft } });
    R(s, { x: M, y: 6.42, w: 0.09, h: 0.48, fill: { color: C.green } });
    T(s, '四个痛点指向同一件事：缺少一条"从课程材料到结构化知识、再到个性化学习"的自动化链路。',
      { x: M + 0.32, y: 6.42, w: CW - 0.6, h: 0.48, fontFace: F, fontSize: 12, bold: true, color: C.greenDeep, valign: 'middle', margin: 0 });
    credit(s);
    frame(s, 2);
  }

  // ============ P3 产品亮点 ============
  {
    const s = p.addSlide(); bg(s); head(s, '产品亮点', 'HIGHLIGHTS', '03');
    claim(s, '六大亮点，覆盖"建图 — 用图 — 问答 — 检验"全链路');
    const items = [
      ['LLM 知识抽取与自动建图', 'jieba 中文分词 + 大模型结构化抽取，从课程文档自动生成知识点与关系，支持 AIGC 一键生成图谱草稿。', '建图效率 ×14.4'],
      ['AntV G6 手绘风格图谱', '基于 G6 引擎与 rough 手绘插件渲染图谱，力导向参数精细调优，层次清晰、分布均匀。', '100+ 节点流畅'],
      ['RAG 检索增强智能问答', '先检索课程知识库再注入上下文生成回答，回答标注引用知识点，答案可溯源、可定位。', '答案可溯源'],
      ['先修拓扑的学习路径推荐', '以"先修"关系构建 DAG 并拓扑排序，结合掌握度、重点程度与测验表现实时重排推荐。', '个性化动态重排'],
      ['Three.js 3D 校园导览', '将系统功能映射为校园建筑（教学楼=图谱、图书馆=资源、实验楼=AIGC），沉浸式功能导览。', '差异化体验'],
      ['双角色权限严格隔离', '接口级 + 界面级双重控制，教师端与学生端功能、数据与主题相互隔离。', '6/6 权限测试通过'],
    ];
    const cw = 7.00, ch = 0.74;
    items.forEach((it, i) => {
      const x = M, y = 2.06 + i * 0.79;
      card(s, x, y, cw, ch, { fill: C.surface });
      RR(s, { x: x + 0.24, y: y + 0.11, w: 0.52, h: 0.52, fill: { color: i % 2 ? C.blueSoft : C.greenSoft }, rectRadius: 0.09 });
      tok(s, String(i + 1), { x: x + 0.24, y: y + 0.11, w: 0.52, h: 0.52, fontFace: FL, fontSize: 16, bold: true, color: i % 2 ? C.blue : C.green, align: 'center', valign: 'middle' });
      T(s, it[0], { x: x + 0.90, y: y + 0.06, w: 4.10, h: 0.28, fontFace: F, fontSize: 13, bold: true, color: C.ink, valign: 'middle', margin: 0 });
      chip(s, it[2], x + 5.14, y + 0.08, 1.66, { h: 0.28, fs: 8.5, fill: C.greenSoft, line: C.greenLine, color: C.green });
      T(s, it[1], { x: x + 0.90, y: y + 0.36, w: 6.00, h: 0.34, fontFace: F, fontSize: 9.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.12 });
    });
    photo(s, '18.jpg', 7.92, 2.06, 4.793, 4.40, { cap: '数据驱动的产品能力与可视化分析' });
    credit(s);
    frame(s, 3);
  }

  // ============ P4 解决方案 ============
  {
    const s = p.addSlide(); bg(s); head(s, '解决方案', 'SOLUTION', '04');
    claim(s, '以图谱为中枢：一端建图、一端用图，AI 全程相伴');
    card(s, M, 2.02, 5.10, 4.66, { fill: C.surface, radius: 0.05 });
    IMG(s, ROOT + '/功能路径图.png', { x: M + 0.22, y: 2.20, w: 4.66, h: 4.30 });
    T(s, '产品功能路径图 · 学生端 / 教师端', { x: M, y: 6.44, w: 5.10, h: 0.26, fontFace: F, fontSize: 9.5, color: C.muted, align: 'center', valign: 'middle', margin: 0 });
    const zones = [
      ['注册前', '游客可浏览系统首页与访客中心，通过 3D 校园模型直观了解平台功能与课程概览，并引导注册使用。', C.slate, '21.jpg'],
      ['教师端', '文档上传与解析 → AIGC 一键生成图谱草稿 → 图谱编辑器校对维护 → 多课程与课程资料管理，把建图从小时级压缩到分钟级。', C.green, '14.jpg'],
      ['学生端', '可视化图谱探索 → RAG 智能问答 → 先修路径推荐 → 详细学习与多模态资源 → 知识小测验 → 学习报告追踪。', C.blue, '13.jpg'],
    ];
    zones.forEach((z, i) => {
      const y = 2.02 + i * 1.60;
      card(s, 6.06, y, CW - (6.06 - M), 1.42, { fill: C.surface });
      R(s, { x: 6.06, y, w: 0.09, h: 1.42, fill: { color: z[2] } });
      photo(s, z[3], 6.28, y + 0.21, 1.00, 1.00);
      chip(s, z[0], 7.44, y + 0.20, 1.10, { h: 0.32, fs: 10.5, fill: C.surface, line: z[2], color: z[2] });
      T(s, z[1], { x: 7.44, y: y + 0.60, w: 4.99, h: 0.70, fontFace: F, fontSize: 10.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.14 });
    });
    credit(s);
    frame(s, 4);
  }

  // ============ P5 技术架构 ============
  {
    const s = p.addSlide(); bg(s); head(s, '技术架构', 'ARCHITECTURE', '05');
    claim(s, '前后端分离 + AI 能力集成，接口级与界面级权限双重隔离');
    const LX = M, LW = 8.66;
    const layers = [
      ['前端层', 'React 18 + Vite 5 + TypeScript', ['AntV G6 图谱可视化', 'Three.js 3D 校园', 'React Context 状态', '手绘风格主题']],
      ['通信层', 'HTTP / JSON · JWT 令牌鉴权', ['RESTful 接口', 'JWT 身份与角色判定', '请求统一封装', '错误统一处理']],
      ['后端层', 'FastAPI · 路由 → 业务 → 数据', ['SQLAlchemy ORM', 'SQLite 15+ 数据表', 'Pydantic 参数校验', '异步高性能']],
      ['AI 能力层', '大语言模型 API · 提示词工程', ['文档知识抽取', 'AIGC 图谱生成', 'RAG 智能问答', 'jieba 中文分词']],
    ];
    layers.forEach((l, i) => {
      const y = 2.00 + i * 1.14;
      card(s, LX, y, LW, 1.00, { fill: i % 2 ? C.surface : C.greenSoft, line: i % 2 ? C.hair : C.greenLine });
      R(s, { x: LX, y, w: 0.09, h: 1.00, fill: { color: i === 3 ? C.purple : C.green } });
      T(s, l[0], { x: LX + 0.28, y: y + 0.14, w: 1.20, h: 0.34, fontFace: F, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', margin: 0 });
      T(s, l[1], { x: LX + 0.28, y: y + 0.52, w: 2.90, h: 0.34, fontFace: F, fontSize: 9.5, color: C.muted, valign: 'middle', margin: 0 });
      const cx = LX + 3.34, cwid = (LW - 3.34 - 0.30 - 0.12 * 3) / 4;
      l[2].forEach((c, j) => {
        RR(s, { x: cx + j * (cwid + 0.12), y: y + 0.28, w: cwid, h: 0.44, fill: { color: C.surface }, line: { color: C.hair, width: 0.75 }, rectRadius: 0.07 });
        tok(s, c, { x: cx + j * (cwid + 0.12), y: y + 0.28, w: cwid, h: 0.44, fontFace: F, fontSize: 9, color: C.ink2, align: 'center', valign: 'middle' });
      });
    });
    const RX = 9.56, RW = CW - (9.56 - M);
    photo(s, '28.jpg', RX + 0.10, 2.10, RW - 0.20, 1.30);
    card(s, RX, 3.60, RW, 2.96, { fill: C.surface });
    T(s, '权限与安全', { x: RX + 0.24, y: 3.72, w: 2.70, h: 0.32, fontFace: F, fontSize: 14, bold: true, color: C.ink, valign: 'middle', margin: 0 });
    R(s, { x: RX + 0.24, y: 4.06, w: 0.50, h: 0.04, fill: { color: C.amber } });
    const sec = [
      ['JWT 令牌鉴权', '纯标准库实现，零额外依赖；登录签发令牌，请求自动校验身份。'],
      ['RBAC 角色隔离', 'require_teacher / require_student 依赖注入，越权返回 403。'],
      ['接口级 + 界面级', '前端过滤菜单与路由，后端逐接口声明角色，定义一致。'],
      ['双主题视觉区分', '教师端绿色系、学生端蓝紫色系，强化角色边界。'],
    ];
    sec.forEach((it, i) => {
      const y = 4.22 + i * 0.58;
      R(s, { x: RX + 0.24, y: y + 0.04, w: 0.05, h: 0.50, fill: { color: C.green } });
      T(s, it[0], { x: RX + 0.44, y, w: 2.66, h: 0.24, fontFace: F, fontSize: 11, bold: true, color: C.greenDeep, valign: 'middle', margin: 0 });
      T(s, it[1], { x: RX + 0.44, y: y + 0.24, w: 2.66, h: 0.30, fontFace: F, fontSize: 9, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.08 });
    });
    credit(s);
    frame(s, 5);
  }

  // ============ P6 - P12 产品功能 ============
  const fns = [];

  fns.push((s) => { // P6 首页与访客中心
    sidebar(s, 0); fnTitle(s, '首页与访客中心', FN_EN[0]);
    shot(s, '01_首页.png', X0, 1.34, 4.66);
    shot(s, '11_访客中心.png', X0 + 4.94, 1.34, 4.66);
    descBand(s, X0, 4.42, XW, '系统首页是平台对外的统一门户与功能导览页，承担"系统认知 — 功能概览 — 角色分流"三项作用；页面以蓝图式结构呈现系统整体框架，用手绘标注突出系统简介与产品亮点，并通过不同色彩体系区分教师端与学生端的功能归属。访客中心以 3D 校园模型展示平台整体学习生态，未登录访客可直观感受智能导航体验。', 1.06);
    chipsRow(s, ['蓝图 + 手绘视觉', '一屏功能概览', '教师 / 学生色彩区分', '3D 校园沉浸导览'], X0, 5.72, XW);
    fnFoot(s, 6);
  });

  fns.push((s) => { // P7 登录注册与角色分流
    sidebar(s, 1); fnTitle(s, '登录注册与角色分流', FN_EN[1]);
    shot(s, '02_登录页.png', X0, 1.34, 4.66);
    shot(s, '03_注册页.png', X0 + 4.94, 1.34, 4.66);
    descBand(s, X0, 4.42, XW, '用户进入系统后，支持以教师或学生身份登录。系统采用 JWT 令牌鉴权，登录成功后由服务端签发令牌，后续请求携带令牌进行身份校验与角色判定，并按角色自动进入对应工作台。注册时需填写用户名、密码并选择身份角色，系统校验用户名唯一性与角色必选后完成账号创建。', 1.06);
    chipsRow(s, ['JWT 令牌鉴权', '教师 / 学生双身份', '注册校验', '自动进入对应工作台'], X0, 5.72, XW);
    fnFoot(s, 7);
  });

  fns.push((s) => { // P8 教师工作台与文档上传
    sidebar(s, 2); fnTitle(s, '教师工作台与文档上传', FN_EN[2]);
    shot(s, '12_教师工作台.png', X0, 1.34, 4.66);
    shot(s, '13_文档上传页.png', X0 + 4.94, 1.34, 4.66);
    descBand(s, X0, 4.42, XW, '教师登录后进入教师端工作台，可查看课程建设与图谱生成进度概览，并通过功能卡片快速进入文档上传、AIGC 生成图谱、知识图谱编辑等模块，工作台支持多课程统筹管理。文档上传支持 PDF / Word / PPT 等格式，系统自动解析文档内容、清洗分段，作为后续知识抽取与图谱构建的数据来源，上传过程带进度提示。', 1.06);
    chipsRow(s, ['课程建设概览', '多课程管理', 'PDF / Word / PPT 解析', '进度提示'], X0, 5.72, XW);
    fnFoot(s, 8);
  });

  fns.push((s) => { // P9 AIGC 生成与图谱编辑
    sidebar(s, 3); fnTitle(s, 'AIGC 生成与图谱编辑', FN_EN[3]);
    shot(s, '14_AIGC生成页.png', X0, 1.34, 4.66);
    shot(s, '15_图谱编辑页.png', X0 + 4.94, 1.34, 4.66);
    descBand(s, X0, 4.42, XW, '教师可以输入课程主题，由大模型自动生成对应的知识点及其关系，快速构建课程知识图谱草稿，大幅降低人工建图成本。系统提供三种建图方式：加载示例图谱、AIGC 主题生成、文档上传解析。生成后可在图谱编辑页面对节点、关系与属性进行增删改维护，并审核知识抽取产生的低置信度结果，确保图谱内容准确规范。', 1.06);
    chipsRow(s, ['三种建图方式', '节点 / 关系增删改', '属性维护', '低置信度复核'], X0, 5.72, XW);
    fnFoot(s, 9);
  });

  fns.push((s) => { // P10 知识图谱探索
    sidebar(s, 4); fnTitle(s, '知识图谱探索', FN_EN[4]);
    shot(s, '05_知识图谱页.png', X0, 1.34, 6.02);
    card(s, X0 + 6.24, 1.34, XW - 6.24, 3.39, { fill: C.surface });
    T(s, '三类关系 · 一张可探索的知识网络', { x: X0 + 6.48, y: 1.52, w: 2.96, h: 0.34, fontFace: F, fontSize: 12, bold: true, color: C.ink, valign: 'middle', margin: 0 });
    R(s, { x: X0 + 6.48, y: 1.90, w: 0.46, h: 0.04, fill: { color: C.amber } });
    const rels = [['包含', '实线', '层级归属，构成知识树'], ['先修', '虚线', '学习依赖，决定顺序'], ['关联', '点线', '横向联系，拓展理解']];
    rels.forEach((r, i) => {
      const y = 2.08 + i * 0.86;
      chip(s, r[0], X0 + 6.48, y, 0.80, { h: 0.30, fs: 10 });
      T(s, r[1] + ' · ' + r[2], { x: X0 + 7.40, y, w: 2.06, h: 0.30, fontFace: F, fontSize: 9.5, color: C.ink2, valign: 'middle', margin: 0 });
    });
    T(s, '手绘渲染：AntV G6 + rough 插件，力导向参数调优，节点分布均匀、层次清晰。',
      { x: X0 + 6.48, y: 4.02, w: 2.98, h: 0.56, fontFace: F, fontSize: 9.5, color: C.muted, valign: 'top', margin: 0, lineSpacingMultiple: 1.12 });
    shot(s, '05b_节点详情.png', X0, 4.92, 3.06);
    descBand(s, X0 + 3.30, 4.92, XW - 3.30, '学生可拖拽平移、滚轮缩放、搜索定位与邻居发现；点击节点打开详情抽屉，展示知识点介绍、所属关系与学习状态，帮助学生在层级、依赖与关联三个维度上建立完整的课程认知。', 1.72);
    fnFoot(s, 10);
  });

  fns.push((s) => { // P11 智能问答 RAG
    sidebar(s, 5); fnTitle(s, '智能问答（RAG）', FN_EN[5]);
    shot(s, '06_智能问答页.png', X0, 1.34, 6.02);
    card(s, X0 + 6.24, 1.34, XW - 6.24, 3.39, { fill: C.surface });
    T(s, '检索增强生成 · 四步闭环', { x: X0 + 6.48, y: 1.52, w: 2.96, h: 0.34, fontFace: F, fontSize: 12, bold: true, color: C.ink, valign: 'middle', margin: 0 });
    R(s, { x: X0 + 6.48, y: 1.90, w: 0.46, h: 0.04, fill: { color: C.amber } });
    ['① 学生提问', '② 课程知识库检索召回', '③ 召回知识点注入上下文', '④ 生成回答并标注引用'].forEach((t, i) => {
      const y = 2.06 + i * 0.66;
      R(s, { x: X0 + 6.48, y: y + 0.06, w: 0.045, h: 0.42, fill: { color: C.green } });
      T(s, t, { x: X0 + 6.66, y, w: 2.80, h: 0.54, fontFace: F, fontSize: 10.5, color: C.ink2, valign: 'middle', margin: 0 });
    });
    T(s, '回答基于课程知识库，保证准确性与可溯源性，实现"问一个问题、懂一片知识"。',
      { x: X0 + 6.48, y: 4.06, w: 2.98, h: 0.52, fontFace: F, fontSize: 9.5, color: C.muted, valign: 'top', margin: 0, lineSpacingMultiple: 1.12 });
    descBand(s, X0, 4.92, XW, '系统解析回答中的引用标记并与图谱节点匹配，在前端高亮显示关联节点，学生点击即可跳转到知识点详情，把"提问"与"图谱"打通为一条可追溯的学习路径。', 1.72);
    fnFoot(s, 11);
  });

  fns.push((s) => { // P12 学习路径与学习闭环
    sidebar(s, 6); fnTitle(s, '学习路径与学习闭环', FN_EN[6]);
    shot(s, '07_学习路径页.png', X0, 1.34, 5.44);
    card(s, X0 + 5.66, 1.34, XW - 5.66, 3.06, { fill: C.surface });
    T(s, '先修拓扑排序 · 动态重排推荐', { x: X0 + 5.90, y: 1.52, w: 3.66, h: 0.34, fontFace: F, fontSize: 12, bold: true, color: C.ink, valign: 'middle', margin: 0 });
    R(s, { x: X0 + 5.90, y: 1.90, w: 0.46, h: 0.04, fill: { color: C.amber } });
    ['以"先修"关系构建 DAG，拓扑排序计算合理学习顺序', '结合掌握度、重点程度与测验表现实时重排推荐', '标记"已掌握"即时更新进度，推进下一步学习'].forEach((t, i) => {
      const y = 2.08 + i * 0.70;
      R(s, { x: X0 + 5.90, y: y + 0.07, w: 0.045, h: 0.44, fill: { color: C.green } });
      T(s, t, { x: X0 + 6.08, y, w: 3.48, h: 0.58, fontFace: F, fontSize: 10.5, color: C.ink2, valign: 'middle', margin: 0, lineSpacingMultiple: 1.08 });
    });
    const trio = [['08_详细学习页.png', '详细学习 · 多模态资料'], ['09_知识小测验.png', '知识小测验 · 即时反馈'], ['10_学习资源页.png', '相关资源 · AI 推荐']];
    const tw = (XW - 0.36) / 3;
    trio.forEach((t, i) => {
      const x = X0 + i * (tw + 0.18);
      shot(s, t[0], x, 4.72, tw);
      T(s, t[1], { x, y: 6.34, w: tw, h: 0.28, fontFace: F, fontSize: 9.5, color: C.ink2, align: 'center', valign: 'middle', margin: 0 });
    });
    fnFoot(s, 12);
  });

  fns.forEach((f, i) => { const s = p.addSlide(); bg(s); f(s); });

  // ============ P13 创新点 ============
  {
    const s = p.addSlide(); bg(s); head(s, '创新点', 'INNOVATION', '13');
    claim(s, '六项技术方法创新，并由量化指标验证');
    const rows = [
      ['中文知识抽取链路', 'jieba 精确模式 + 2-gram 兜底，配合大模型结构化抽取与提示词约束，保证专业术语与长名词完整。'],
      ['关系归一与方向修正', '将"属于 / 基于 / 服务于 / 承载"等多样表述统一为"包含 / 先修 / 关联"三类，并互换反向边，使层级树正确。'],
      ['手绘风格图谱渲染', 'AntV G6 + rough 插件实现手绘渲染，力导向参数（charge -480 / collide radius+38）调优，100+ 节点无大面积重叠。'],
      ['RAG 引用溯源联动', '回答标注引用知识点并与图谱节点双向联动，答案可定位、可追溯，避免大模型"看似合理却无出处"。'],
      ['先修 DAG 实时重排', '拓扑排序给出基线顺序，再综合掌握度、重点程度与测验正确率动态重排，实现个性化导航。'],
      ['接口级 + 界面级双隔离', '后端逐接口声明角色依赖，前端按角色过滤菜单与路由，前后端权限定义一致，6 项权限用例全部通过。'],
    ];
    const cw = (CW - 0.30) / 2, ch = 1.16;
    rows.forEach((r, i) => {
      const x = M + (i % 2) * (cw + 0.30);
      const y = 2.02 + Math.floor(i / 2) * (ch + 0.18);
      card(s, x, y, cw, ch, { fill: C.surface });
      badge(s, String(i + 1).padStart(2, '0'), x + 0.26, y + 0.16, 0.38, i % 2 ? C.blue : C.green, 'FFFFFF', 12);
      T(s, r[0], { x: x + 0.74, y: y + 0.16, w: cw - 1.0, h: 0.38, fontFace: F, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', margin: 0 });
      T(s, r[1], { x: x + 0.28, y: y + 0.64, w: cw - 0.56, h: 0.46, fontFace: F, fontSize: 9.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.10 });
    });
    card(s, M, 5.90, CW, 0.92, { fill: C.greenSoft, line: C.greenLine });
    const kpis = [['88.9%', '知识抽取精确率'], ['7.4 ms', '图谱加载响应'], ['224.8 ms', '智能问答首响'], ['6/6', '权限测试通过'], ['14.4×', '建图效率提升']];
    const kw = CW / 5;
    kpis.forEach((k, i) => {
      const x = M + i * kw;
      if (i) R(s, { x, y: 6.10, w: 0.01, h: 0.52, fill: { color: C.greenLine } });
      tok(s, k[0], { x: x + 0.10, y: 6.02, w: kw - 0.20, h: 0.42, fontFace: FL, fontSize: 20, bold: true, color: C.green, align: 'center', valign: 'middle' });
      T(s, k[1], { x: x + 0.10, y: 6.44, w: kw - 0.20, h: 0.28, fontFace: F, fontSize: 9, color: C.ink2, align: 'center', valign: 'middle', margin: 0 });
    });
    frame(s, 13);
  }

  // ============ P14 团队构成与分工 ============
  {
    const s = p.addSlide(); bg(s); head(s, '团队构成与分工', 'TEAM & ROLES', '14');
    claim(s, '5 人跨专业协作：产品、前端、后端、AI 算法、科研助理');
    card(s, M, 2.02, 4.44, 4.34, { fill: C.surface, radius: 0.05 });
    IMG(s, md('image1.jpeg'), { x: M + 0.20, y: 2.20, w: 4.04, h: 3.03 });
    T(s, '团队分工图', { x: M, y: 5.34, w: 4.44, h: 0.26, fontFace: F, fontSize: 9.5, color: C.muted, align: 'center', valign: 'middle', margin: 0 });
    T(s, '由项目总负责人统筹整体进度与资源分配，\n团队按专业优势分工协作，覆盖从需求到交付的完整链路。',
      { x: M + 0.24, y: 5.66, w: 3.96, h: 0.60, fontFace: F, fontSize: 9.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.14 });
    const roles = [
      ['项目总负责人 / 产品经理', '统筹协调项目全局与资源分配；负责背景调查、可行性分析、业务需求分析与功能设计文档，完成产品原型与功能框架设计。', C.green],
      ['前端开发', '负责前端页面开发与图谱可视化交互（AntV G6 2D / 3D 渲染、手绘风格界面），对接后端接口，完成功能联调与界面测试。', C.blue],
      ['后端开发', '负责后端接口与数据模型设计、JWT 权限体系与 RBAC 隔离，主导文档解析与知识抽取的服务端集成与性能优化。', C.purple],
      ['AI 算法工程师', '负责大模型提示词工程、知识抽取链路设计（jieba 分词 + LLM 抽取）、RAG 问答与 AIGC 图谱生成的技术实现与调优。', C.amberDeep],
      ['科研助理（播音专业）', '负责行业调研与资料收集、汇报文案与说明文档撰写、演示视频录制与配音讲解、答辩材料美化与宣讲呈现。', C.red],
    ];
    roles.forEach((r, i) => {
      const y = 2.02 + i * 0.90;
      card(s, 5.40, y, CW - (5.40 - M), 0.78, { fill: C.surface });
      R(s, { x: 5.40, y, w: 0.075, h: 0.78, fill: { color: r[2] } });
      T(s, r[0], { x: 5.66, y: y + 0.06, w: 2.30, h: 0.66, fontFace: F, fontSize: 11.5, bold: true, color: C.ink, valign: 'middle', margin: 0 });
      T(s, r[1], { x: 8.02, y: y + 0.05, w: CW - (8.02 - M) - 0.24, h: 0.68, fontFace: F, fontSize: 9.5, color: C.ink2, valign: 'middle', margin: 0, lineSpacingMultiple: 1.08 });
    });
    frame(s, 14);
  }

  // ============ P15 项目进度与里程碑 ============
  {
    const s = p.addSlide(); bg(s); head(s, '项目进度与里程碑', 'SCHEDULE & MILESTONES', '15');
    claim(s, '需求 → 设计 → 并行开发 → AI 集成 → 联调测试 → 文档答辩');
    card(s, M, 2.02, CW, 3.10, { fill: C.surface, radius: 0.05 });
    IMG(s, md('image2.png'), { x: M + 0.24, y: 2.20, w: 11.61, h: 2.74 });
    const phases = [
      ['需求与设计', '需求分析与原型设计、UI 设计与技术选型'],
      ['核心开发', '前端开发与后端开发并行推进，AI 链路集成'],
      ['测试优化', '测试优化与文档撰写，权限验证与整体联调'],
      ['答辩准备', '材料整理、演示视频与答辩宣讲准备'],
    ];
    const pw = (CW - 0.36) / 4;
    phases.forEach((ph, i) => {
      const x = M + i * (pw + 0.12);
      card(s, x, 5.34, pw, 1.30, { fill: i % 2 ? C.surface : C.greenSoft, line: i % 2 ? C.hair : C.greenLine });
      badge(s, String(i + 1), x + 0.22, 5.50, 0.34, C.green, 'FFFFFF', 11);
      T(s, ph[0], { x: x + 0.64, y: 5.48, w: pw - 0.86, h: 0.36, fontFace: F, fontSize: 11.5, bold: true, color: C.ink, valign: 'middle', margin: 0 });
      T(s, ph[1], { x: x + 0.22, y: 5.90, w: pw - 0.44, h: 0.62, fontFace: F, fontSize: 9.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.10 });
    });
    frame(s, 15);
  }

  // ============ P16 协作机制与工程规范 ============
  {
    const s = p.addSlide(); bg(s); head(s, '协作机制与工程规范', 'COLLABORATION', '16');
    claim(s, '接口契约先行、分层解耦、权限前后端一致');
    const steps = ['需求分析与原型', 'UI 设计与技术选型', '前后端并行开发', 'AI 链路集成', '联调与权限测试', '文档与答辩准备'];
    const sw = (CW - 0.30 * 5) / 6;
    steps.forEach((t, i) => {
      const x = M + i * (sw + 0.30);
      RR(s, { x, y: 2.06, w: sw, h: 0.86, fill: { color: i % 2 ? C.surface : C.greenSoft }, line: { color: i % 2 ? C.hair : C.greenLine, width: 0.75 }, rectRadius: 0.07 });
      tok(s, String(i + 1).padStart(2, '0'), { x, y: 2.14, w: sw, h: 0.30, fontFace: FL, fontSize: 11, bold: true, color: C.green, align: 'center' });
      T(s, t, { x: x + 0.06, y: 2.42, w: sw - 0.12, h: 0.44, fontFace: F, fontSize: 10, bold: true, color: C.ink, align: 'center', valign: 'middle', margin: 0, lineSpacingMultiple: 1.05 });
      if (i < 5) T(s, '›', { x: x + sw, y: 2.06, w: 0.30, h: 0.86, fontFace: FL, fontSize: 16, color: C.muted, align: 'center', valign: 'middle', margin: 0 });
    });
    const norms = [
      ['前后端分离 + 契约先行', '先定义接口文档（RESTful / JSON），前后端并行开发，减少联调阻塞。'],
      ['分层解耦架构', '后端 路由 → 业务 → 数据；前端 pages / components / context / middleware / services 分层组织。'],
      ['全异步中间件', '认证、路由守卫等横切逻辑统一以 async/await 实现，避免回调嵌套。'],
      ['权限定义前后端一致', '同一份角色规则同时约束后端接口与前端菜单路由，杜绝越权与体验割裂。'],
      ['双主题与视觉规范', '教师端绿色系、学生端蓝紫色系，组件与间距遵循统一设计令牌。'],
      ['多维度测试', '接口功能、角色权限、知识抽取准确率、系统效率四类测试并行推进。'],
    ];
    const cw = (CW - 0.30) / 2, ch = 1.42;
    norms.forEach((n, i) => {
      const x = M + (i % 2) * (cw + 0.30);
      const y = 3.16 + Math.floor(i / 2) * (ch + 0.18);
      card(s, x, y, cw, ch, { fill: C.surface });
      R(s, { x, y: y + 0.26, w: 0.06, h: ch - 0.52, fill: { color: C.green } });
      T(s, n[0], { x: x + 0.28, y: y + 0.20, w: cw - 0.5, h: 0.34, fontFace: F, fontSize: 12, bold: true, color: C.ink, valign: 'middle', margin: 0 });
      T(s, n[1], { x: x + 0.28, y: y + 0.58, w: cw - 0.52, h: 0.70, fontFace: F, fontSize: 9.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.12 });
    });
    frame(s, 16);
  }

  // ============ P17 团队介绍与致谢 ============
  {
    const s = p.addSlide(); bg(s, C.bg);
    R(s, { x: 0, y: 0, w: 0.28, h: H, fill: { color: C.greenDeep } });
    R(s, { x: 0.28, y: 0, w: 0.06, h: H, fill: { color: C.amber } });
    head(s, '团队介绍与致谢', 'TEAM & ACKNOWLEDGEMENT', '17');
    claim(s, '一支跨专业、优势互补的学生团队，完成从 0 到 1 的完整交付');
    const members = [
      ['项目总负责人 / 产品经理', '需求洞察 · 原型设计 · 项目管理'],
      ['前端开发', 'React / TypeScript · 图谱可视化 · 交互实现'],
      ['后端开发', 'FastAPI · 数据建模 · 权限体系'],
      ['AI 算法工程师', '提示词工程 · 知识抽取 · RAG 与 AIGC'],
      ['科研助理（播音专业）', '调研文案 · 演示配音 · 答辩宣讲'],
    ];
    const mw = (CW - 0.36) / 5;
    members.forEach((m, i) => {
      const x = M + i * (mw + 0.09);
      card(s, x, 2.06, mw, 2.06, { fill: C.surface });
      RR(s, { x: x + mw / 2 - 0.28, y: 2.26, w: 0.56, h: 0.56, fill: { color: i % 2 ? C.blueSoft : C.greenSoft }, rectRadius: 0.28 });
      tok(s, String(i + 1).padStart(2, '0'), { x: x + mw / 2 - 0.28, y: 2.26, w: 0.56, h: 0.56, fontFace: FL, fontSize: 15, bold: true, color: i % 2 ? C.blue : C.green, align: 'center', valign: 'middle' });
      T(s, m[0], { x: x + 0.12, y: 2.94, w: mw - 0.24, h: 0.60, fontFace: F, fontSize: 11, bold: true, color: C.ink, align: 'center', valign: 'middle', margin: 0, lineSpacingMultiple: 1.06 });
      T(s, m[1], { x: x + 0.12, y: 3.52, w: mw - 0.24, h: 0.52, fontFace: F, fontSize: 8.5, color: C.muted, align: 'center', valign: 'top', margin: 0, lineSpacingMultiple: 1.10 });
    });
    card(s, M, 4.36, CW, 1.30, { fill: C.greenSoft, line: C.greenLine });
    T(s, '致谢', { x: M + 0.34, y: 4.52, w: 1.0, h: 0.36, fontFace: F, fontSize: 14, bold: true, color: C.greenDeep, valign: 'middle', margin: 0 });
    R(s, { x: M + 0.34, y: 4.92, w: 0.46, h: 0.04, fill: { color: C.amber } });
    T(s, '感谢指导老师的悉心指导与团队成员的全力投入。智绘千里希望让课程知识"看得见、走得通、学得会"——以 AIGC 降低建图门槛，以图谱导航学习路径，让每一位学生都能按图索骥、循序进阶。',
      { x: M + 0.34, y: 5.04, w: CW - 0.68, h: 0.52, fontFace: F, fontSize: 10.5, color: C.ink2, valign: 'top', margin: 0, lineSpacingMultiple: 1.16 });
    T(s, '以画笔绘就知识网络 · 以智能导航千里学程', { x: M, y: 5.94, w: CW, h: 0.52, fontFace: F, fontSize: 20, bold: true, color: C.greenDeep, align: 'center', valign: 'middle', margin: 0, charSpacing: 1.5 });
    R(s, { x: M, y: H - 0.50, w: CW, h: 0.01, fill: { color: C.hair } });
    T(s, '智绘千里 · AIGC 知识图谱智能导学系统', { x: M, y: H - 0.44, w: 8.4, h: 0.26, fontFace: F, fontSize: 8.5, color: C.muted, valign: 'middle', margin: 0 });
    tok(s, '17', { x: W - M - 0.8, y: H - 0.45, w: 0.8, h: 0.28, fontFace: FL, fontSize: 10.5, bold: true, color: C.green, align: 'right' });
  }

  await p.writeFile({ fileName: OUT });
  console.log('WROTE', OUT, 'slides=', p.slides.length);
}

main().catch((e) => { console.error(e); process.exit(1); });