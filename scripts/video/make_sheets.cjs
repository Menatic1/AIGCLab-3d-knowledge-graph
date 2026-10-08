/** 生成各素材视频的带时间戳缩略图总览，用于确定剪辑点 */
const path = require('path');
const fs = require('fs');
const L = require('./lib.cjs');

L.mkdirs(path.join(L.BUILD, 'sheets'));

const files = fs.readdirSync(L.VID_DIR).filter(f => f.endsWith('.mp4'));
for (const f of files) {
  const src = path.join(L.VID_DIR, f);
  const name = path.basename(f, '.mp4');
  const out = path.join(L.BUILD, 'sheets', `${name}.png`);
  const dur = L.duration(src);
  const vf = [
    'fps=1/3',
    'scale=360:-1',
    `drawtext=fontfile=${L.esc(L.FONT_HEI)}:text='%{pts\\:hms}':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.75:boxborderw=4`,
    'tile=4x6:margin=6:padding=4',
  ].join(',');
  L.run(['-y', '-v', 'error', '-i', src, '-vf', vf, '-frames:v', '1', out]);
  console.log(`OK  ${name}  ${dur.toFixed(1)}s`);
}