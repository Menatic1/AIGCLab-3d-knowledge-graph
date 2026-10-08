// 生成 S0 封面文档（使用代码绘制封面）
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, ImageRun, AlignmentType } = require('docx');

const S0_DIR = path.resolve(__dirname, '..', '..', '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S0');
const coverImg = path.join(S0_DIR, '封面图_代码绘制.png');

// 读取 PNG 尺寸（IHDR: 宽高在 16-24 字节）
const buf = fs.readFileSync(coverImg);
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
const ratio = h / w;

// A4 页面: 210mm x 297mm = 8.27" x 11.69"，无边距整页铺满
const pageWidthIn = 8.27;
let imgW = pageWidthIn;
let imgH = imgW * ratio;

const doc = new Document({
  creator: '智绘千里团队',
  title: 'S0 封面',
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 0, lineRule: 'exact' },
        children: [
          new ImageRun({
            data: fs.readFileSync(coverImg),
            transformation: { width: imgW * 96, height: imgH * 96 },
            altText: {
              name: '智绘千里封面',
              title: '智绘千里 AIGC知识图谱智能导学系统 封面',
              description: '代码绘制封面',
            },
          }),
        ],
      }),
    ],
  }],
});

(async () => {
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(S0_DIR, 'S0_封面.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✓ S0_封面.docx 已更新（代码绘制封面）');
  console.log(`  源图: ${w}x${h}px → 文档: ${imgW.toFixed(2)}" x ${imgH.toFixed(2)}"`);
})().catch(e => { console.error(e); process.exit(1); });