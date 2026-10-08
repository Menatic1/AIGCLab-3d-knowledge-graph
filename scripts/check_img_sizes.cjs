const fs = require('fs');
const path = require('path');

const CODE_DIR = path.join(__dirname, '..', 'docs', '撰写材料', '配图-code');
const AI_DIR = path.join(__dirname, '..', 'docs', '撰写材料', '配图');

function getPngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h, ratio: h / w };
}

console.log('=== 代码生成图（Mermaid）===');
const codeFiles = fs.readdirSync(CODE_DIR).filter(f => f.endsWith('.png'));
for (const f of codeFiles) {
  const { w, h, ratio } = getPngSize(path.join(CODE_DIR, f));
  const widthIn55 = 5.5;
  const heightIn55 = 5.5 * ratio;
  const widthIn50 = 5.0;
  const heightIn50 = 5.0 * ratio;
  const widthIn45 = 4.5;
  const heightIn45 = 4.5 * ratio;
  console.log(`${f.padEnd(28)} ${w}x${h}  比例${ratio.toFixed(2)}  | 5.5"宽 -> ${heightIn55.toFixed(1)}"高  | 5.0"宽 -> ${heightIn50.toFixed(1)}"高  | 4.5"宽 -> ${heightIn45.toFixed(1)}"高`);
}

console.log('\n=== AI 生图 ===');
const aiFiles = fs.readdirSync(AI_DIR).filter(f => f.endsWith('.jpg'));
for (const f of aiFiles) {
  const buf = fs.readFileSync(path.join(AI_DIR, f));
  const w = buf.readUInt32BE(6);
  const h = buf.readUInt32BE(10);
  const ratio = h / w;
  const widthIn55 = 5.5;
  const heightIn55 = 5.5 * ratio;
  console.log(`${f.padEnd(28)} ${w}x${h}  比例${ratio.toFixed(2)}  | 5.5"宽 -> ${heightIn55.toFixed(1)}"高`);
}

console.log('\n页面可用区域：宽约 5.8 英寸，高约 8.3 英寸（扣除页眉页脚）');
