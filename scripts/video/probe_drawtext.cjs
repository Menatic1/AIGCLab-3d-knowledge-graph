/** 探针：找出在 Node execFileSync 下可用的 drawtext 写法 */
const path = require('path');
const fs = require('fs');
const L = require('./lib.cjs');

const src = path.join(L.VID_DIR, '06_学习报告.mp4');
const outDir = path.join(L.BUILD, 'probe');
L.mkdirs(outDir);

const base = (fontExpr, textExpr) => [
  'fps=1/3', 'scale=320:-1',
  `drawtext=${fontExpr}:text=${textExpr}:x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.75:boxborderw=4`,
  'tile=4x4:margin=4:padding=3',
].join(',');

const variants = [
  ['A_esc_notext-colon', base('fontfile=C\\:/Windows/Fonts/simhei.ttf', '%{pts}')],
  ['B_quote_esc',        base("fontfile='C\\:/Windows/Fonts/simhei.ttf'", '%{pts}')],
  ['C_double_backslash', base('fontfile=C\\\\:/Windows/Fonts/simhei.ttf', '%{pts}')],
  ['D_quote_raw',        base("fontfile='C:/Windows/Fonts/simhei.ttf'", '%{pts}')],
];

for (const [name, vf] of variants) {
  const out = path.join(outDir, `${name}.png`);
  try {
    L.run(['-y', '-v', 'error', '-i', src, '-vf', vf, '-frames:v', '1', out]);
    console.log(`PASS  ${name}`);
  } catch (e) {
    const msg = (e.stderr || Buffer.from('')).toString().split('\n')[0];
    console.log(`FAIL  ${name}  ::  ${msg.slice(0, 110)}`);
  }
}