// 智绘千里 - 产品说明书最终版
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, Header, Footer, PageNumber,
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', '撰写材料', '最终文档');
const CODE_IMG = path.join(ROOT, 'docs', '撰写材料', '配图素材', '代码配图');
const AI_IMG = path.join(ROOT, 'docs', '撰写材料', '配图素材', 'AI配图');
const SHOT_IMG = path.join(ROOT, 'assets', '系统截图');

const MAX_WIDTH = 5.8;
const MAX_HEIGHT = 7.5;

function getImageSize(filePath) {
  const buf = fs.readFileSync(filePath);
  const isJpg = filePath.endsWith('.jpg') || filePath.endsWith('.jpeg');
  let w, h;
  if (isJpg) {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xFF) break;
      const marker = buf[offset + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        h = buf.readUInt16BE(offset + 5);
        w = buf.readUInt16BE(offset + 7);
        break;
      }
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
    if (!w || !h) { w = 1600; h = 1200; }
  } else {
    w = buf.readUInt32BE(16);
    h = buf.readUInt32BE(20);
  }
  const ratio = h / w;
  let widthIn = MAX_WIDTH;
  let heightIn = widthIn * ratio;
  if (heightIn > MAX_HEIGHT) {
    heightIn = MAX_HEIGHT;
    widthIn = heightIn / ratio;
  }
  return { w, h, ratio, widthIn, heightIn };
}

const IMG = {
  // 代码生成图
  tongxin: getImageSize(path.join(CODE_IMG, '通信流程图.png')),
  kuangjia: getImageSize(path.join(CODE_IMG, '系统技术框架图.png')),
  frontend: getImageSize(path.join(CODE_IMG, '前端系统框架图.png')),
  backend: getImageSize(path.join(CODE_IMG, '后端系统框架图.png')),
  // AI生成图
  team: getImageSize(path.join(AI_IMG, '团队分工图.jpg')),
  // 系统截图
  shot_home: getImageSize(path.join(SHOT_IMG, '01_首页.png')),
  shot_login: getImageSize(path.join(SHOT_IMG, '02_登录页.png')),
  shot_register: getImageSize(path.join(SHOT_IMG, '03_注册页.png')),
  shot_stu_workbench: getImageSize(path.join(SHOT_IMG, '04_学生工作台.png')),
  shot_graph: getImageSize(path.join(SHOT_IMG, '05_知识图谱页.png')),
  shot_qa: getImageSize(path.join(SHOT_IMG, '06_智能问答页.png')),
  shot_learn_path: getImageSize(path.join(SHOT_IMG, '07_学习路径页.png')),
  shot_learning: getImageSize(path.join(SHOT_IMG, '08_详细学习页.png')),
  shot_quiz: getImageSize(path.join(SHOT_IMG, '09_知识小测验.png')),
  shot_resources: getImageSize(path.join(SHOT_IMG, '10_学习资源页.png')),
  shot_visitor: getImageSize(path.join(SHOT_IMG, '11_访客中心.png')),
  shot_tea_workbench: getImageSize(path.join(SHOT_IMG, '12_教师工作台.png')),
  shot_upload: getImageSize(path.join(SHOT_IMG, '13_文档上传页.png')),
  shot_aigc: getImageSize(path.join(SHOT_IMG, '14_AIGC生成页.png')),
  shot_editor: getImageSize(path.join(SHOT_IMG, '15_图谱编辑页.png')),
};

const FONT_HEI  = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '黑体',   cs: 'Times New Roman' };
const FONT_FANG = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '仿宋',   cs: 'Times New Roman' };
const FONT_HEADER = { ascii: '仿宋', hAnsi: '仿宋', eastAsia: '仿宋', cs: '仿宋' };

const SZ_TITLE = 36; const SZ_H1 = 32; const SZ_H2 = 30;
const SZ_BODY  = 28; const SZ_CAP = 24; const SZ_HDR = 24; const SZ_FTR = 18;

const LINE_RULE = { line: 360, lineRule: 'auto' };
const INDENT_BODY = { firstLine: 560 };
const INDENT_CAP  = { firstLine: 480 };

const HEADER_SHADING = { fill: 'D5E5F2', type: ShadingType.CLEAR };
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };
const borders = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
};

function docTitle(t) { return new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
  children: [new TextRun({ text: t, bold: true, size: SZ_TITLE, font: FONT_HEI })] }); }
function h1(t) { return new Paragraph({ alignment: AlignmentType.BOTH, spacing: LINE_RULE,
  children: [new TextRun({ text: t, bold: true, size: SZ_H1, font: FONT_HEI })] }); }
function h2(t) { return new Paragraph({ alignment: AlignmentType.LEFT, spacing: LINE_RULE,
  children: [new TextRun({ text: t, bold: true, size: SZ_H2, font: FONT_HEI })] }); }
function body(t) { return new Paragraph({ alignment: AlignmentType.LEFT, spacing: LINE_RULE, indent: INDENT_BODY,
  children: [new TextRun({ text: t, size: SZ_BODY, font: FONT_FANG })] }); }
function bodyBold(t) { return new Paragraph({ alignment: AlignmentType.LEFT, spacing: LINE_RULE, indent: INDENT_BODY,
  children: [new TextRun({ text: t, size: SZ_BODY, font: FONT_FANG, bold: true })] }); }
function caption(t) { return new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE, indent: INDENT_CAP,
  children: [new TextRun({ text: t, size: SZ_CAP, font: FONT_FANG })] }); }
function emptyPara() { return new Paragraph({ spacing: LINE_RULE, children: [] }); }

function img(key, filePath, alt) {
  const info = IMG[key];
  const buf = fs.readFileSync(filePath);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: LINE_RULE,
    children: [new ImageRun({
      data: buf,
      transformation: { width: info.widthIn * 96, height: info.heightIn * 96 },
      altText: { name: alt, title: alt, description: alt },
    })],
  });
}

function makeTable(headers, rows, colWidths) {
  const total = 8306;
  const dxaWidths = colWidths.map(p => Math.round(total * p / 100));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: dxaWidths,
    rows: [
      new TableRow({ cantSplit: true, children: headers.map((h, i) => new TableCell({
        borders, width: { size: dxaWidths[i], type: WidthType.DXA },
        shading: HEADER_SHADING, margins: CELL_MARGINS,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
          children: [new TextRun({ text: h, bold: true, size: SZ_BODY - 2, font: FONT_HEI })] })],
      })) }),
      ...rows.map(row => new TableRow({ cantSplit: true, children: row.map((cell, i) => new TableCell({
        borders, width: { size: dxaWidths[i], type: WidthType.DXA }, margins: CELL_MARGINS,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
          children: [new TextRun({ text: String(cell), size: SZ_BODY - 2, font: FONT_FANG })] })],
      })) })),
    ],
  });
}
function tableCaption(t) { return new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
  children: [new TextRun({ text: t, size: SZ_BODY, font: FONT_FANG, bold: true })] }); }

function baseDoc(title, children) {
  return new Document({
    creator: '智绘千里团队',
    title,
    styles: { default: { document: { run: { font: FONT_FANG, size: SZ_BODY } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '智绘千里 · AIGC 知识图谱智能导学系统', size: SZ_HDR, font: FONT_HEADER, color: '666666' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '第 ', size: SZ_FTR, font: FONT_FANG }),
                  new TextRun({ children: [PageNumber.CURRENT], size: SZ_FTR, font: FONT_FANG }),
                  new TextRun({ text: ' 页', size: SZ_FTR, font: FONT_FANG }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

// ═══════════ 产品说明书内容 ═══════════
function buildManual() {
  const c = [];
  
  // 封面标题
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
    children: [new TextRun({ text: '智绘千里', bold: true, size: 48, font: FONT_HEI })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
    children: [new TextRun({ text: 'AIGC 知识图谱智能导学系统', size: 36, font: FONT_HEI, color: '3F7BA0' })] }));
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
    children: [new TextRun({ text: '产品说明书', bold: true, size: 40, font: FONT_HEI })] }));
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(emptyPara());
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
    children: [new TextRun({ text: '版本：V1.0', size: SZ_BODY, font: FONT_FANG })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: LINE_RULE,
    children: [new TextRun({ text: '日期：2026 年 10 月', size: SZ_BODY, font: FONT_FANG })] }));

  // ─── 第一章 产品概述 ───
  c.push(h1('一、产品概述'));
  c.push(h2('1.1 产品简介'));
  c.push(body('智绘千里是一款基于 AIGC 技术的课程知识图谱智能导学系统，面向高校教师与学生两类用户，提供"知识图谱构建 + 智能学习导航"的一体化解决方案。系统以知识图谱为核心载体，以大语言模型为技术引擎，帮助教师快速构建课程知识图谱，帮助学生进行结构化、个性化的课程学习。'));
  c.push(body('系统采用"蓝图 + 手绘"的独特视觉风格，教师端以绿色系为主色调，学生端以蓝紫色系为主色调，从视觉上强化角色区分。知识图谱采用手绘风格渲染，兼具科技感与人文温度，为用户带来愉悦的使用体验。'));
  
  c.push(h2('1.2 产品定位'));
  c.push(body('智绘千里定位于高校课程教学场景下的知识图谱智能导学工具，核心解决两大痛点：'));
  c.push(bodyBold('（1）教师建图难'));
  c.push(body('传统手工绘制知识图谱效率低、维护难，一张几十节点的图谱往往需要数小时甚至数天。智绘千里将建图流程革新为"上传文档 + AI 抽取 + 校对发布"，建图时间从小时级压缩到分钟级，让知识图谱真正从"奢侈品"变为教学"必需品"。'));
  c.push(bodyBold('（2）学生学习散'));
  c.push(body('学生按教材章节线性学习，往往缺乏对课程知识的整体结构化认知。智绘千里以知识图谱为核心，提供图谱探索、智能问答、路径推荐、进度追踪等全流程学习导航，帮助学生建立完整的知识网络，提升学习效率。'));

  c.push(h2('1.3 产品亮点'));
  c.push(bodyBold('1）AIGC 一键建图'));
  c.push(body('教师输入课程主题即可调用大模型自动生成知识图谱草稿，支持文档解析抽取与 AIGC 生成两种建图方式，大幅降低知识图谱构建门槛。'));
  c.push(bodyBold('2）手绘风格图谱'));
  c.push(body('基于 AntV G6 + g-plugin-rough-canvas-renderer 实现手绘风格的知识图谱渲染，视觉效果独特，在同类产品中具有差异化竞争力。'));
  c.push(bodyBold('3）RAG 智能问答'));
  c.push(body('采用检索增强生成技术，回答基于课程知识库且可溯源到图谱节点，实现"问一个问题、懂一片知识"的学习效果。'));
  c.push(bodyBold('4）双角色权限隔离'));
  c.push(body('教师端与学生端功能严格隔离，接口级 + 界面级双重权限控制，确保数据安全与功能边界清晰。'));
  c.push(bodyBold('5）3D 校园导览'));
  c.push(body('基于 Three.js 实现的 3D 校园模型，为访客提供沉浸式的平台功能导览体验。'));

  c.push(h2('1.4 技术架构'));
  c.push(body('系统采用前后端分离架构，前端基于 React 18 + Vite 5 + TypeScript，后端基于 FastAPI + SQLite，AI 层基于大语言模型 API。整体技术框架如图 1-1 所示。'));
  c.push(emptyPara());
  c.push(img('kuangjia', path.join(CODE_IMG, '系统技术框架图.png'), '系统技术框架图'));
  c.push(caption('图1-1 系统技术框架图'));
  c.push(body('通信流程采用标准的 B/S 架构，浏览器与服务器通过 HTTP 协议通信，数据以 JSON 格式传输，使用 JWT 令牌进行身份认证与角色鉴权。'));
  c.push(emptyPara());
  c.push(img('tongxin', path.join(CODE_IMG, '通信流程图.png'), '通信流程图'));
  c.push(caption('图1-2 通信流程图'));

  // ─── 第二章 功能介绍 ───
  c.push(h1('二、功能介绍'));
  c.push(h2('2.1 注册前功能'));
  c.push(h2('2.1.1 首页'));
  c.push(body('首页是系统的门户与功能导览页，展示产品名称和 Logo，介绍系统简介与产品亮点，展示核心功能区域划分及教师端/学生端角色说明。新用户可以通过首页快速了解系统定位，点击"进入系统"按钮进入登录注册流程。'));
  c.push(emptyPara());
  c.push(img('shot_home', path.join(SHOT_IMG, '01_首页.png'), '首页'));
  c.push(caption('图2-1 系统首页'));

  c.push(h2('2.1.2 登录注册'));
  c.push(body('系统支持教师与学生两种身份的账号注册与登录。采用 JWT 令牌鉴权，登录成功后根据角色自动进入对应工作台。教师端与学生端的功能菜单、操作权限及数据视图严格隔离。'));
  c.push(emptyPara());
  c.push(img('shot_login', path.join(SHOT_IMG, '02_登录页.png'), '登录界面'));
  c.push(caption('图2-2 登录界面'));
  c.push(emptyPara());
  c.push(img('shot_register', path.join(SHOT_IMG, '03_注册页.png'), '注册界面'));
  c.push(caption('图2-3 注册界面'));

  c.push(h2('2.2 教师端功能'));
  c.push(h2('2.2.1 教师工作台'));
  c.push(body('教师登录后的首页，提供课程切换下拉与新建课程入口，以概览面板展示课程建设与图谱生成进度，包括课程资料数量、文档解析状态、知识点抽取进度、关系构建情况、图谱生成状态及待校对/待修正节点数等关键指标，帮助教师一目了然地掌握课程建设状况。'));
  c.push(emptyPara());
  c.push(img('shot_tea_workbench', path.join(SHOT_IMG, '12_教师工作台.png'), '教师工作台'));
  c.push(caption('图2-4 教师工作台'));

  c.push(h2('2.2.2 文档上传与解析'));
  c.push(body('教师可以上传 PDF、Word、PPT、TXT、MD 等多种格式的课程材料，系统自动解析文档内容并进行知识抽取。右侧已加载图谱面板展示当前图谱的节点数、关系数、类型数等统计信息，支持直接进入图谱探索。'));
  c.push(emptyPara());
  c.push(img('shot_upload', path.join(SHOT_IMG, '13_文档上传页.png'), '文档上传页面'));
  c.push(caption('图2-5 文档上传页面'));

  c.push(h2('2.2.3 AIGC 生成图谱'));
  c.push(body('教师输入课程主题，系统通过大模型自动生成课程知识图谱草稿，包含核心知识点及其之间的关系。生成过程约需 2-6 分钟，生成结果会自动写入知识图谱，教师可在图谱编辑页面进行校对和调整。'));
  c.push(emptyPara());
  c.push(img('shot_aigc', path.join(SHOT_IMG, '14_AIGC生成页.png'), 'AIGC生成图谱页面'));
  c.push(caption('图2-6 AIGC 生成图谱页面'));

  c.push(h2('2.2.4 知识图谱编辑'));
  c.push(body('教师可以在图谱编辑界面对课程知识图谱进行全面维护，包含三大功能区域：节点与资源列表（左侧）、节点属性编辑（中部）、关系管理（右侧）。支持新增/删除知识点节点、编辑节点名称与描述、修改节点分类与重要度、添加/删除关系、设置关系类型与起点终点等操作。'));
  c.push(emptyPara());
  c.push(img('shot_editor', path.join(SHOT_IMG, '15_图谱编辑页.png'), '知识图谱编辑页面'));
  c.push(caption('图2-7 知识图谱编辑页面'));

  c.push(h2('2.3 学生端功能'));
  c.push(h2('2.3.1 学生工作台'));
  c.push(body('学生登录后的首页，以 3D 校园模型为视觉中心，展示当前课程的学习进度概览：知识点总数、关系网络数、已掌握数、掌握率四大指标一目了然。四大功能建筑（AIGC 生成图谱、知识图谱、学习路径、相关学习资源）分布在校园四周，点击即可进入对应功能。'));
  c.push(emptyPara());
  c.push(img('shot_stu_workbench', path.join(SHOT_IMG, '04_学生工作台.png'), '学生工作台'));
  c.push(caption('图2-8 学生工作台'));

  c.push(h2('2.3.2 知识图谱探索'));
  c.push(body('学生可以查看课程知识点的可视化网络图，支持拖拽、缩放、搜索定位与邻居发现。顶部统计面板展示图谱节点数、关系数、多模态资源数、已掌握数、关系类型数等信息。左侧知识点列表按分类组织，支持搜索与筛选。图谱以"包含、先修、关联"三类关系呈现知识结构，帮助学生建立完整的知识体系认知。'));
  c.push(emptyPara());
  c.push(img('shot_graph', path.join(SHOT_IMG, '05_知识图谱页.png'), '知识图谱页面'));
  c.push(caption('图2-9 知识图谱页面'));

  c.push(h2('2.3.3 智能问答'));
  c.push(body('学生可以基于课程知识向 AI 助教提问。系统采用 RAG 检索增强生成技术，回答内容会关联并高亮图谱中的相关节点。智能问答页面提供预设问题快捷按钮，学生一键即可提问，支持清空对话历史。回答基于课程知识库，保证准确性与可溯源性。'));
  c.push(emptyPara());
  c.push(img('shot_qa', path.join(SHOT_IMG, '06_智能问答页.png'), '智能问答页面'));
  c.push(caption('图2-10 智能问答页面'));

  c.push(h2('2.3.4 学习路径'));
  c.push(body('系统根据知识点的先修关系为学生推荐个性化学习路径。左侧为知识点掌握清单，支持按分类筛选与搜索；右侧为下一步学习推荐，综合前置关系、重点程度、测试正确率和学习偏好实时重排。底部为可视化学习路径，按学习难度与依赖关系划分为多个阶段逐步推进。'));
  c.push(emptyPara());
  c.push(img('shot_learn_path', path.join(SHOT_IMG, '07_学习路径页.png'), '学习路径页面'));
  c.push(caption('图2-11 学习路径页面'));

  c.push(h2('2.3.5 详细学习'));
  c.push(body('学生进入详细学习模块可以浏览知识点的多模态学习资料，包括知识点定义、后续知识（学完可继续学习）、B站视频讲解等。右侧继续学习相关知识点面板支持同级节点点击直接跳转，底部"开始本节测试"按钮可直接进入知识小测验。'));
  c.push(emptyPara());
  c.push(img('shot_learning', path.join(SHOT_IMG, '08_详细学习页.png'), '详细学习页面'));
  c.push(caption('图2-12 详细学习页面'));

  c.push(h2('2.3.6 知识小测验'));
  c.push(body('系统根据课程知识点自动生成测验题目，学生在学习完成后可以通过测验检验掌握情况。测验题目涵盖概念理解、分类判断、重要度评估等多种题型，提交后系统自动批改并更新掌握状态，测验结果同步到学习报告中。'));
  c.push(emptyPara());
  c.push(img('shot_quiz', path.join(SHOT_IMG, '09_知识小测验.png'), '知识小测验页面'));
  c.push(caption('图2-13 知识小测验页面'));

  c.push(h2('2.3.7 相关学习资源'));
  c.push(body('系统根据当前学习的知识点推荐相关学习资源，左侧为知识点列表，点击即可查看对应知识点的相关学习资源推荐，帮助学生拓展学习深度与广度。'));
  c.push(emptyPara());
  c.push(img('shot_resources', path.join(SHOT_IMG, '10_学习资源页.png'), '学习资源页面'));
  c.push(caption('图2-14 学习资源页面'));

  c.push(h2('2.3.8 个人中心（访客中心）'));
  c.push(body('在个人中心界面，学生可以查看个人学习报告，包括总体掌握率、测试次数、平均正确率等数据概览，动态学习建议（巩固优先/均衡推进/挑战进阶三种模式），薄弱点诊断，近期测试记录以及已掌握知识点列表。学习建议会随着测试表现实时更新，帮助学生有针对性地提升。'));
  c.push(emptyPara());
  c.push(img('shot_visitor', path.join(SHOT_IMG, '11_访客中心.png'), '个人中心页面'));
  c.push(caption('图2-15 个人中心页面'));

  // ─── 第三章 技术实现 ───
  c.push(h1('三、技术实现'));
  c.push(h2('3.1 前端技术'));
  c.push(body('前端项目采用 React 18 + Vite 5 + TypeScript 的技术栈，按照 pages（页面）、components（组件）、context（全局状态）、middleware（中间件）、services（API 封装）、utils（工具函数）进行分层组织。'));
  c.push(emptyPara());
  c.push(img('frontend', path.join(CODE_IMG, '前端系统框架图.png'), '前端系统架构图'));
  c.push(caption('图3-1 前端系统架构图'));
  c.push(bodyBold('知识图谱渲染：AntV G6'));
  c.push(body('知识图谱渲染使用蚂蚁集团的 AntV G6 图可视化引擎，支持 Canvas2D 高性能渲染与丰富的交互能力。通过 g-plugin-rough-canvas-renderer 插件实现手绘风格渲染，与系统整体的"蓝图+手绘"视觉风格统一。力导向布局参数经过调优（charge=-480、link distance=150-260、collide=radius+38），保证节点分布均匀、层次清晰。'));
  c.push(bodyBold('3D 渲染：Three.js'));
  c.push(body('3D 校园模型使用 Three.js 作为底层 3D 渲染引擎，配合 react-force-graph-3d 实现三维力导向图谱，为访客中心提供沉浸式的 3D 交互体验。'));
  c.push(bodyBold('状态管理与权限控制'));
  c.push(body('全局状态通过 React Context（TabContext、KnowledgeContext、AuthContext、CourseContext 等）进行管理，配合自定义中间件实现路由级的角色权限守卫。通过 getVisibleTabsForRole 和 canAccessTab 函数，根据当前用户角色过滤可见的标签页菜单与路由。'));

  c.push(h2('3.2 后端技术'));
  c.push(body('后端采用 FastAPI 框架，基于 Python 开发，天然适合集成 AI 相关能力。数据库采用 SQLite，轻量免运维。认证体系采用 JWT 令牌 + 基于角色的访问控制（RBAC），通过 require_role、require_teacher、require_student 等依赖注入函数实现接口级别的权限隔离。'));
  c.push(emptyPara());
  c.push(img('backend', path.join(CODE_IMG, '后端系统框架图.png'), '后端系统架构图'));
  c.push(caption('图3-2 后端系统架构图'));
  c.push(body('后端项目按照路由（routers）、认证（auth）、数据模型（models）、数据校验（schemas）、业务工具（parsers、llm_client）、权限（permissions）的结构组织。每个路由模块对应一类业务功能，通过 APIRouter 进行注册，主入口文件统一挂载。'));

  c.push(h2('3.3 AI 技术'));
  c.push(bodyBold('1）知识抽取'));
  c.push(body('采用 jieba 中文分词的精确模式 + 2-gram 兜底策略，调用大语言模型从文档片段中抽取出知识点实体及其关系，经过关系类型映射（统一为"包含、先修、关联"三类）与方向修正后，存入知识图谱数据库。'));
  c.push(bodyBold('2）AIGC 图谱生成'));
  c.push(body('教师输入课程主题，系统调用大模型自动生成结构化的节点列表与关系列表，解析 JSON 后直接写入知识图谱数据库。生成的图谱以核心概念为主，可作为建图的高效起点。'));
  c.push(bodyBold('3）RAG 智能问答'));
  c.push(body('采用检索增强生成技术路线：先在课程知识库中检索相关知识点，将检索结果作为上下文注入提示词，再由大模型生成回答，并在回答中标注引用的知识点，实现答案的可溯源性。'));

  // ─── 第四章 使用指南 ───
  c.push(h1('四、使用指南'));
  c.push(h2('4.1 教师使用流程'));
  c.push(body('教师使用系统构建课程知识图谱的流程如下：'));
  c.push(bodyBold('第一步：注册登录'));
  c.push(body('访问系统首页，点击"进入系统"，选择"教师"身份进行注册，填写用户名和密码后即可登录。登录成功后自动进入教师端工作台。'));
  c.push(bodyBold('第二步：创建/选择课程'));
  c.push(body('在教师工作台顶部的课程选择下拉框中，可以切换已有课程或新建课程。新建课程只需输入课程名称即可。'));
  c.push(bodyBold('第三步：构建知识图谱（二选一）'));
  c.push(body('方式一：文档上传。进入"文档上传"页面，拖拽或点击上传 PDF、Word、PPT 等格式的课程文档，系统自动解析并抽取知识点与关系。'));
  c.push(body('方式二：AIGC 生成。进入"AIGC 生成图谱"页面，输入课程主题（如"计算机网络""高等数学"），点击"生成知识图谱"按钮，等待 2-6 分钟即可生成图谱草稿。'));
  c.push(bodyBold('第四步：校对编辑'));
  c.push(body('进入"知识图谱"页面，点击右上角"编辑图谱"按钮，在编辑器中对自动生成的结果进行校对和调整，包括增删节点、修改属性、管理关系等。'));
  c.push(bodyBold('第五步：发布使用'));
  c.push(body('校对完成后关闭编辑模式，图谱即对学生可见。学生登录后即可浏览图谱、智能问答、按路径学习。'));

  c.push(h2('4.2 学生使用流程'));
  c.push(bodyBold('第一步：注册登录'));
  c.push(body('选择"学生"身份注册并登录，自动进入学生端工作台。'));
  c.push(bodyBold('第二步：浏览知识图谱'));
  c.push(body('点击"知识图谱"进入图谱页面，拖拽画布浏览整体知识结构，点击节点查看详情，使用搜索框快速定位知识点。'));
  c.push(bodyBold('第三步：智能问答'));
  c.push(body('点击"问答"进入智能问答页面，向 AI 助教提问课程相关问题，回答会关联图谱节点，帮助定位知识来源。'));
  c.push(bodyBold('第四步：按路径学习'));
  c.push(body('进入"学习路径"页面，查看系统推荐的学习顺序，从第一个知识点开始，点击"去学"进入详细学习页面。'));
  c.push(bodyBold('第五步：详细学习 + 测验'));
  c.push(body('在详细学习页面浏览知识点介绍与视频资源，学习完成后点击"开始本节测试"检验掌握情况，通过后知识点标记为"已掌握"。'));
  c.push(bodyBold('第六步：查看学习报告'));
  c.push(body('点击右上角用户头像进入个人中心，查看总体掌握率、薄弱点诊断、学习建议等数据，有针对性地查漏补缺。'));

  c.push(h2('4.3 系统要求'));
  c.push(body('系统为 Web 应用，用户无需安装客户端，通过浏览器即可访问使用。推荐使用 Chrome、Edge、Firefox 等现代浏览器，浏览器版本需支持 Canvas2D 与 WebGL（3D 校园功能）。服务端最低配置为 2 核 4GB 内存，可支撑中小规模的课程与用户量。'));

  // ─── 第五章 性能指标 ───
  c.push(h1('五、性能指标'));
  c.push(h2('5.1 系统效率'));
  c.push(body('系统主要接口响应时间如下表所示（测试环境：本地开发机 Windows + 16GB 内存）：'));
  c.push(emptyPara());
  c.push(tableCaption('表5-1 主要接口响应时间'));
  c.push(makeTable(
    ['接口名称', '平均响应时间（ms）', '最小响应（ms）', '最大响应（ms）'],
    [
      ['用户登录', '36.6', '31.2', '53.3'],
      ['课程列表加载', '6.5', '3.1', '18.9'],
      ['知识图谱加载（36节点）', '7.4', '3.1', '23.1'],
      ['智能问答首响', '224.8', '11.4', '650.1'],
      ['学习路径推荐', '10.6', '3.0', '22.4'],
    ],
    [30, 25, 22, 23]
  ));
  c.push(body('常规 CRUD 类接口响应时间均在 50ms 以内，图谱加载与路径推荐在 10ms 级别，智能问答首响平均 224.8ms（主要消耗在大模型 API 调用）。整体响应迅速，用户体验流畅。'));

  c.push(h2('5.2 知识抽取质量'));
  c.push(body('以系统内置示例图谱（高等数学主题，202 个节点）为基准，AIGC 生成同主题图谱的抽取质量指标如下：'));
  c.push(emptyPara());
  c.push(tableCaption('表5-2 知识抽取准确率'));
  c.push(makeTable(
    ['指标', '数值', '说明'],
    [
      ['精确率（Precision）', '88.9%', '生成节点正确率高'],
      ['召回率（Recall）', '18.2%', 'AIGC 生成核心节点为主'],
      ['F1 值', '30.2%', '精确率与召回率的调和平均'],
      ['AIGC 生成节点数', '36 个', '涵盖课程核心概念'],
      ['AIGC 生成关系数', '55 条', '先修关系占比 67.3%'],
    ],
    [30, 25, 45]
  ));
  c.push(body('AIGC 生成图谱精确率达 88.9%，节点质量高。在实际使用中，教师可通过"文档抽取 + AIGC 生成 + 人工补充"的方式，快速构建完整的课程知识图谱。'));

  c.push(h2('5.3 权限安全'));
  c.push(body('系统采用接口级 + 界面级的双重权限控制，6 项权限测试全部通过：'));
  c.push(emptyPara());
  c.push(tableCaption('表5-3 角色权限测试'));
  c.push(makeTable(
    ['测试项', '返回状态码', '预期结果', '是否通过'],
    [
      ['教师访问学生接口', '403', '403 Forbidden', '通过'],
      ['学生访问教师接口', '403', '403 Forbidden', '通过'],
      ['未登录访问受保护接口', '401', '401 Unauthorized', '通过'],
      ['未登录访问公开接口', '200', '200 OK', '通过'],
    ],
    [35, 20, 25, 20]
  ));

  return baseDoc('智绘千里产品说明书', c);
}

async function main() {
  console.log('生成产品说明书...');
  const doc = buildManual();
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(OUT_DIR, '智绘千里_产品说明书_最终版.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✓ 智绘千里_产品说明书_最终版.docx');
  console.log('完成！');
}

main().catch(e => { console.error(e); process.exit(1); });
