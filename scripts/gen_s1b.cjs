// 智绘千里 S1B 概要介绍（参考文档图片矫正系统格式，不含专利）
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, Header, Footer, PageNumber,
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', '撰写材料', '最终文档');
const SHOT_IMG = path.join(ROOT, 'assets', '系统截图');
const CODE_IMG = path.join(ROOT, 'docs', '撰写材料', '配图素材', '代码配图');

const MAX_WIDTH = 5.8;
const MAX_HEIGHT = 4.5;

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
  shot_home: getImageSize(path.join(SHOT_IMG, '01_首页.png')),
  shot_graph: getImageSize(path.join(SHOT_IMG, '05_知识图谱页.png')),
  shot_qa: getImageSize(path.join(SHOT_IMG, '06_智能问答页.png')),
  shot_aigc: getImageSize(path.join(SHOT_IMG, '14_AIGC生成页.png')),
  shot_learn_path: getImageSize(path.join(SHOT_IMG, '07_学习路径页.png')),
  kuangjia: getImageSize(path.join(CODE_IMG, '系统技术框架图.png')),
};

// 参考文档字体：Times New Roman + 宋体
const FONT_DEF = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体', cs: 'Times New Roman' };

const SZ_TITLE = 36;  // 小二号
const SZ_H1 = 32;     // 三号
const SZ_BODY = 28;   // 小四号
const SZ_CAP = 24;    // 小五号
const SZ_FTR = 18;

const LINE_RULE = { line: 360, lineRule: 'auto' };
const INDENT = { firstLine: 480 };

function h1(t) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, spacing: LINE_RULE,
    children: [new TextRun({ text: t, bold: true, size: SZ_H1, font: FONT_DEF })],
  });
}
function h2(t) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, spacing: LINE_RULE,
    children: [new TextRun({ text: t, bold: true, size: SZ_BODY, font: FONT_DEF })],
  });
}
function body(t) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, spacing: LINE_RULE, indent: INDENT,
    children: [new TextRun({ text: t, size: SZ_BODY, font: FONT_DEF })],
  });
}
function bodyBold(t) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, spacing: LINE_RULE, indent: INDENT,
    children: [new TextRun({ text: t, size: SZ_BODY, font: FONT_DEF, bold: true })],
  });
}
function caption(t) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: LINE_RULE,
    children: [new TextRun({ text: t, size: SZ_CAP, font: FONT_DEF, bold: true })],
  });
}
function emptyPara() {
  return new Paragraph({ spacing: LINE_RULE, children: [] });
}
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

const borders = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
};
const HEADER_SHADING = { fill: 'D5E5F2', type: ShadingType.CLEAR };
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

function makeTable(headers, rows, colWidths) {
  const total = 8306;
  const dxaWidths = colWidths.map(p => Math.round(total * p / 100));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: dxaWidths,
    rows: [
      new TableRow({
        cantSplit: true,
        children: headers.map((h, i) => new TableCell({
          borders,
          width: { size: dxaWidths[i], type: WidthType.DXA },
          shading: HEADER_SHADING,
          margins: CELL_MARGINS,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER, spacing: LINE_RULE,
            children: [new TextRun({ text: h, bold: true, size: SZ_BODY - 2, font: FONT_DEF })],
          })],
        })),
      }),
      ...rows.map(row => new TableRow({
        cantSplit: true,
        children: row.map((cell, i) => new TableCell({
          borders,
          width: { size: dxaWidths[i], type: WidthType.DXA },
          margins: CELL_MARGINS,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER, spacing: LINE_RULE,
            children: [new TextRun({ text: String(cell), size: SZ_BODY - 2, font: FONT_DEF })],
          })],
        })),
      })),
    ],
  });
}

function buildDoc() {
  const c = [];

  // 标题
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: LINE_RULE,
    children: [new TextRun({ text: '概要介绍', bold: true, size: SZ_TITLE, font: FONT_DEF })],
  }));
  c.push(emptyPara());

  // 一、目标问题
  c.push(h1('一、目标问题'));
  c.push(body('随着高等教育数字化转型的深入推进，课程知识体系日益庞大且复杂，知识点分散在各章节目录与多种教学材料之中。在课程教学与学习过程中，知识图谱作为一种结构化的知识组织方式，其应用价值已得到广泛认可，但在实际落地过程中仍面临以下几大核心问题：'));
  c.push(body('1）教师构建知识图谱效率低下。传统手工绘制课程知识图谱依赖 Visio、MindMaster 等工具，一张包含几十个节点的图谱往往需要数小时甚至数天的工作量，且随着教学内容的迭代更新，图谱的维护成本居高不下，导致知识图谱在实际教学中难以真正落地。'));
  c.push(body('2）学生缺乏结构化的学习导航。学生按教材章节线性学习，往往"只见树木不见森林"，缺乏对课程知识的整体结构化认知，难以建立起完整的知识体系，学习效率和深度理解能力受限。'));
  c.push(body('3）课后答疑受时空限制。传统的师生答疑模式受限于时间与空间，学生课后遇到问题往往无法及时得到解答，而通用大模型的回答缺乏针对性，无法与具体课程的知识结构深度结合。'));
  c.push(body('4）学习进度难以追踪与量化。学生对自己的学习状况缺乏清晰的量化认知，教师也难以全面掌握每个学生的学习进度与薄弱环节，无法提供有针对性的学习指导。'));
  c.push(body('基于以上问题，本团队设计了智绘千里——AIGC 知识图谱智能导学系统。'));

  // 二、项目思路
  c.push(h1('二、项目思路'));
  c.push(body('本系统基于 AIGC 大语言模型与知识图谱可视化技术，使用 FastAPI、React、AntV G6 等技术栈，通过文档智能抽取与 AIGC 生成两种方式快速构建课程知识图谱，并以图谱为核心载体为学生提供全流程的智能学习导航。本系统的基本思路分为以下几个部分：'));
  c.push(body('1）基于教师快速建图的需求，设置了文档上传与解析版块，支持 PDF、Word、PPT 等多种格式的课程文档上传，自动抽取知识点与关系，还支持 AIGC 一键生成图谱草稿；'));
  c.push(body('2）基于图谱校对与维护的需求，设置了知识图谱编辑功能，教师可以对节点、关系、属性进行增删改操作，确保图谱内容的准确性；'));
  c.push(body('3）基于学生结构化学习的需求，设置了知识图谱探索与学习路径推荐功能，学生可以可视化浏览知识结构，按照先修关系推荐的路径循序渐进学习；'));
  c.push(body('4）基于智能答疑的需求，增设了 RAG 智能问答功能，回答基于课程知识库且可溯源到图谱节点；'));
  c.push(body('5）基于学习效果检验的需求，设置了知识小测验与学习报告功能，帮助学生检验掌握情况并追踪学习进度；'));
  c.push(body('6）基于用户的不同身份，分设教师账户和学生账户，两种角色功能严格隔离，权限安全可控。'));

  // 三、项目做法
  c.push(h1('三、项目做法'));
  c.push(emptyPara());
  c.push(img('kuangjia', path.join(CODE_IMG, '系统技术框架图.png'), '系统技术框架图'));
  c.push(caption('图3-1 系统技术框架图'));
  c.push(emptyPara());
  c.push(body('系统主要功能描述：'));
  c.push(bodyBold('1）教师端功能：'));
  c.push(body('教师可以上传课程文档或输入课程主题，由 AI 自动生成知识图谱草稿，并通过图谱编辑器进行校对和维护，支持多课程管理与课程资料管理。'));
  c.push(bodyBold('2）学生端功能：'));
  c.push(body('学生可以浏览可视化知识图谱、向 AI 助教智能提问、按推荐路径学习、进行知识测验并查看学习报告，实现全流程的智能导学。'));
  c.push(bodyBold('3）知识图谱可视化功能：'));
  c.push(body('基于 AntV G6 引擎实现手绘风格的知识图谱渲染，支持拖拽、缩放、搜索、节点详情等丰富交互，以"包含、先修、关联"三类关系呈现知识结构。'));
  c.push(bodyBold('4）双角色权限隔离功能：'));
  c.push(body('采用接口级 + 界面级的双重权限控制，教师端与学生端功能严格隔离，确保数据安全与功能边界清晰。'));

  // 四、项目亮点
  c.push(h1('四、项目亮点'));
  c.push(body('针对项目所运用的 AIGC 技术和针对性的产品设计，我们总结了项目所具备的以下六个项目创新点：'));
  c.push(emptyPara());

  c.push(bodyBold('1. 基于大语言模型的知识抽取与图谱自动构建；'));
  c.push(body('采用 jieba 中文分词 + LLM 知识抽取的技术路线，从课程文档中自动抽取知识点实体及其之间的关系，经过关系类型映射（统一为"包含、先修、关联"三类）与方向修正后，批量写入知识图谱数据库。同时支持 AIGC 一键生成图谱，教师输入主题即可得到结构化的图谱草稿，建图效率较手工方式提升 10 倍以上。'));
  c.push(emptyPara());
  c.push(img('shot_aigc', path.join(SHOT_IMG, '14_AIGC生成页.png'), 'AIGC生成图谱'));
  c.push(caption('图4-1 AIGC 一键生成知识图谱'));
  c.push(emptyPara());

  c.push(bodyBold('2. 基于 AntV G6 的手绘风格知识图谱可视化；'));
  c.push(body('使用蚂蚁集团 AntV G6 图可视化引擎，配合 g-plugin-rough-canvas-renderer 插件实现手绘风格的图谱渲染，视觉效果独特。力导向布局参数经过精细调优（charge=-480、link distance=150-260、collide=radius+38），保证节点分布均匀、层次清晰，支持拖拽、缩放、搜索定位、邻居发现等丰富交互。'));
  c.push(emptyPara());
  c.push(img('shot_graph', path.join(SHOT_IMG, '05_知识图谱页.png'), '知识图谱页面'));
  c.push(caption('图4-2 手绘风格知识图谱可视化'));
  c.push(emptyPara());

  c.push(bodyBold('3. 基于 RAG 检索增强生成的智能问答；'));
  c.push(body('采用检索增强生成（RAG）技术路线，学生提问时先在课程知识库中检索相关知识点，将检索结果作为上下文注入提示词，再由大模型生成回答，并在回答中标注引用的知识点。回答基于课程知识库，保证准确性与可溯源性，实现"问一个问题、懂一片知识"的学习效果。'));
  c.push(emptyPara());
  c.push(img('shot_qa', path.join(SHOT_IMG, '06_智能问答页.png'), '智能问答页面'));
  c.push(caption('图4-3 RAG 智能问答与节点关联溯源'));
  c.push(emptyPara());

  c.push(bodyBold('4. 基于先修关系拓扑排序的学习路径推荐；'));
  c.push(body('将知识点之间的"先修"关系构建为有向无环图（DAG），使用拓扑排序算法计算出合理的学习顺序。结合学生已掌握的知识点与学习偏好，实时动态重排下一步推荐内容，引导学生循序渐进地掌握课程知识，实现个性化学习导航。'));
  c.push(emptyPara());
  c.push(img('shot_learn_path', path.join(SHOT_IMG, '07_学习路径页.png'), '学习路径页面'));
  c.push(caption('图4-4 个性化学习路径推荐'));
  c.push(emptyPara());

  c.push(bodyBold('5. 基于 Three.js 的 3D 校园沉浸式导览；'));
  c.push(body('使用 Three.js 实现 3D 校园模型，将系统功能映射为校园中的建筑（教学楼=知识图谱、图书馆=学习资源、实验楼=AIGC 生成、体育馆=学习路径），为访客提供沉浸式的平台功能导览体验，在同类产品中具有差异化的视觉竞争力。'));
  c.push(emptyPara());
  c.push(img('shot_home', path.join(SHOT_IMG, '01_首页.png'), '系统首页'));
  c.push(caption('图4-5 系统首页与产品导览'));
  c.push(emptyPara());

  c.push(bodyBold('6. 测试结果'));
  c.push(emptyPara());
  c.push(caption('表4-1 系统主要性能指标'));
  c.push(makeTable(
    ['测试项', '指标值', '说明'],
    [
      ['知识抽取精确率', '88.9%', 'AIGC 生成节点正确率'],
      ['图谱加载响应', '7.4 ms', '36节点图谱平均加载时间'],
      ['智能问答首响', '224.8 ms', '含大模型 API 调用'],
      ['权限隔离测试', '6/6 全部通过', '教师/学生/未登录三级权限'],
      ['建图效率提升', '14.4 倍', '系统建图 vs 手工建图对比'],
      ['接口响应（常规）', '<50 ms', 'CRUD 类接口平均响应'],
    ],
    [25, 20, 55]
  ));
  c.push(emptyPara());
  c.push(body('测试从系统效率、知识抽取质量、角色权限安全、建图效率对比等多个维度进行验证。结果表明：常规接口响应均在 50ms 以内，知识抽取精确率达 88.9%，6 项权限测试全部通过，系统建图效率约为手工建图的 14.4 倍，整体性能满足教学场景的使用需求。'));

  return new Document({
    creator: '智绘千里团队',
    title: '概要介绍',
    styles: {
      default: {
        document: {
          run: { font: FONT_DEF, size: SZ_BODY },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: '第 ', size: SZ_FTR, font: FONT_DEF }),
              new TextRun({ children: [PageNumber.CURRENT], size: SZ_FTR, font: FONT_DEF }),
              new TextRun({ text: ' 页', size: SZ_FTR, font: FONT_DEF }),
            ],
          })],
        }),
      },
      children: c,
    }],
  });
}

async function main() {
  console.log('生成 S1B 概要介绍...');
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(OUT_DIR, 'S1B_概要介绍_智绘千里.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✓ S1B_概要介绍_智绘千里.docx');
  console.log('完成！');
}

main().catch(e => { console.error(e); process.exit(1); });
