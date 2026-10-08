/** 为指定素材生成缩略图时间轴（每 2 秒一帧），用于核验内容 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const VID = path.join(L.MATERIAL, '视频_timed');
const OUT = path.join(L.TMP, 'sheets');
const STEP = 2;
const COLS = 5;

(async () => {
  L.mkdirs(OUT);
  const names = process.argv.slice(2);
  for (const name of names) {
    const file = path.join(VID, `${name}.mp4`);
    if (!fs.existsSync(file)) { console.log(`! 缺失 ${name}`); continue; }
    const d = L.duration(file);
    const rows = Math.ceil(Math.ceil(d / STEP) / COLS);
    const out = path.join(OUT, `${name}.png`);
    L.run([
      '-y', '-v', 'error', '-i', file,
      '-vf', `fps=1/${STEP},scale=440:-1,` +
        `drawtext=fontfile=${L.esc(L.FONT_HEI)}:text='%{eif\\:t\\:d}s':x=6:y=6:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.75,` +
        `tile=${COLS}x${rows}`,
      '-frames:v', '1', out,
    ]);
    console.log(`✓ ${name}.png  (${d.toFixed(1)}s, ${COLS}x${rows})`);
  }
})().catch(e => { console.error(e.stderr ? e.stderr.toString() : e); process.exit(1); });