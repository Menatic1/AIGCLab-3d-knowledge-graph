const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, ImageRun, AlignmentType } = require('docx');

const S0_DIR = path.resolve(__dirname, '..', '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S0');
const coverImg = path.join(S0_DIR, '封面图_代码绘制.png');

const buf = fs.readFileSync(coverImg);
// PNG IHDR: offset 16, width=4 bytes BE, height=4 bytes BE
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);

const pageWidthIn = 8.27;
const ratio = h / w;
let imgW = pageWidthIn;
let imgH = imgW * ratio;

const doc = new Document({
  creator: '智绘千里团队',
  title: '封面',
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 0, lineRule: 'exact' },
        children: [
          new ImageRun({
            data: buf,
            transformation: { width: imgW * 96, height: imgH * 96 },
            altText: { name: '智绘千里封面', title: '智绘千里 AIGC知识图谱智能导学系统 封面', description: '智绘千里产品文档封面 - 代码绘制蓝图风格' },
          }),
        ],
      }),
    ],
  }],
});

async function main() {
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(S0_DIR, 'S0_封面.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✓ S0_封面.docx 生成完成');
  console.log(`  图片尺寸: ${w}x${h} px`);
  console.log(`  文档尺寸: ${imgW.toFixed(2)}" x ${imgH.toFixed(2)}"`);
}

main().catch(e => { console.error(e); process.exit(1); });