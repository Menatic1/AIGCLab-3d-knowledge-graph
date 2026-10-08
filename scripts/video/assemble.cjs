/**
 * 全片拼接：场景转场（交叉溶解）+ 旁白按时间轴混音 → 最终成片
 * 输出：赛题10_.../S3/演示视频_智绘千里.mp4
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const TIMING = require('./timing.json');

const OV = TIMING.overlap;
const OUT = path.join(L.S3, '演示视频_智绘千里.mp4');

const scenes = TIMING.scenes;

// 场景实际时长（编码后可能与配置略有出入）
const durs = scenes.map(s => L.duration(path.join(L.SCENES, `${s.key}.mp4`)));
const TOTAL = durs.reduce((a, b) => a + b, 0) - (scenes.length - 1) * OV;

const args = ['-y', '-v', 'error', '-stats'];

// 视频输入
scenes.forEach(s => args.push('-i', path.join(L.SCENES, `${s.key}.mp4`)));
// 旁白输入
const voiced = [];
scenes.forEach((s, k) => {
  if (s.audio && fs.existsSync(s.audio)) {
    voiced.push({ idx: scenes.length + voiced.length, scene: k, delay: s.start + s.narrationOffset, file: s.audio });
    args.push('-i', s.audio);
  }
});

let fc = '';
let cur = '0:v';
scenes.forEach((s, k) => {
  if (k === 0) return;
  fc += `[${cur}][${k}:v]xfade=transition=fade:duration=${OV}:offset=${s.start.toFixed(3)}[x${k}];`;
  cur = `x${k}`;
});
fc += `[${cur}]format=yuv420p[v];`;

voiced.forEach((a, j) => {
  fc += `[${a.idx}:a]adelay=${Math.round(a.delay * 1000)}:all=1[a${j}];`;
});
fc += `${voiced.map((a, j) => `[a${j}]`).join('')}amix=inputs=${voiced.length}:normalize=0:duration=longest,apad,atrim=0:${TOTAL.toFixed(3)},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a]`;

args.push(
  '-filter_complex', fc,
  '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-r', '25',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
  '-t', TOTAL.toFixed(3),
  '-movflags', '+faststart',
  OUT,
);

console.log(`拼接 ${scenes.length} 段  转场 ${OV}s×${scenes.length - 1}  旁白 ${voiced.length} 条`);
console.log(`成片时长 ${TOTAL.toFixed(2)}s = ${Math.floor(TOTAL / 60)}:${(TOTAL % 60).toFixed(1).padStart(4, '0')}`);

L.run(args, { stdio: 'inherit' });

const d = L.duration(OUT);
const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
console.log(`\n✓ 成片完成：${OUT}`);
console.log(`  时长 ${d.toFixed(2)}s (${Math.floor(d / 60)}:${(d % 60).toFixed(1).padStart(4, '0')})  ${mb}MB  1920×1080 / 25fps`);