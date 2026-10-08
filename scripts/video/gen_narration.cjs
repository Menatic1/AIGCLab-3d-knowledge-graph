/** 生成旁白音频 + 计算全片时间轴 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib.cjs');
const CFG = require('./config.cjs');

const BEAT_DIR = path.join(L.AUDIO, 'beats');
L.mkdirs(BEAT_DIR, L.AUDIO, L.TMP);

const SR = 44100;
const OVERLAP = 0.4;   // 场景交叉溶解时长
const LEAD = CFG.LEAD; // 场景起点到旁白起点的留白

function wav(f) { return f.replace(/\.mp3$/, '.wav'); }

function toWav(src, dst) {
  L.run(['-y', '-v', 'error', '-i', src, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', dst]);
}

// 每个停顿值一个静音文件
const silCache = new Map();
function silenceFor(gap) {
  const key = gap.toFixed(3);
  if (silCache.has(key)) return silCache.get(key);
  const f = path.join(L.AUDIO, `_silence_${key.replace('.', '_')}.wav`);
  if (!fs.existsSync(f)) {
    L.run(['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`,
      '-t', gap.toFixed(3), '-c:a', 'pcm_s16le', f]);
  }
  silCache.set(key, f);
  return f;
}

function concatWavs(list, dst) {
  const lst = path.join(L.TMP, `concat_${path.basename(dst, '.wav')}.txt`);
  fs.writeFileSync(lst, list.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
  L.run(['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'pcm_s16le', dst]);
  fs.rmSync(lst, { force: true });
}

// ── 1) 收集旁白（已存在的音频直接复用，不重复合成）──
const items = [];
CFG.scenes.forEach(sc => sc.beats.forEach((b, i) => {
  if (!b.narration) return;
  items.push({ id: `${sc.key}_${i}`, text: b.narration, out: path.join(BEAT_DIR, `${sc.key}_${i}.mp3`) });
}));

const pending = items.filter(it => !(fs.existsSync(it.out) && fs.statSync(it.out).size > 1000));
if (pending.length) {
  const jobsFile = path.join(L.TMP, 'tts_jobs.json');
  fs.writeFileSync(jobsFile, JSON.stringify({ voice: CFG.VOICE, rate: CFG.RATE, items: pending }, null, 2), 'utf8');
  console.log(`合成旁白：${pending.length} 条待生成（共 ${items.length} 条）(${CFG.VOICE} ${CFG.RATE})`);
  const py = execFileSync('python', [path.join(L.BUILD, 'tts.py'), jobsFile], { encoding: 'utf8' });
  console.log('  ' + py.trim().split('\n').pop());
} else {
  console.log(`旁白音频已存在，复用 ${items.length} 条（${CFG.VOICE} ${CFG.RATE}）`);
}

const durs = {};
for (const it of items) {
  if (!fs.existsSync(it.out)) { console.error(`  ✗ 缺失 ${it.id}`); continue; }
  toWav(it.out, wav(it.out));
  durs[it.id] = L.duration(wav(it.out));
  console.log(`  ${it.id.padEnd(7)} ${durs[it.id].toFixed(2)}s  ${it.text.slice(0, 24)}…`);
}

// ── 2) 逐场景拼接旁白 + 计算时间轴 ──
const timeline = { overlap: OVERLAP, lead: LEAD, scenes: [] };
let start = 0;
let prevDur = 0;

CFG.scenes.forEach((sc, si) => {
  if (si > 0) start = start + prevDur - OVERLAP;

  const gap = sc.gap != null ? sc.gap : CFG.GAP_BEAT;
  const silence = silenceFor(gap);
  const parts = [];
  const beats = [];
  let t = 0;
  const isFixed = !!sc.beats[0].fixedDur;

  sc.beats.forEach((b, i) => {
    const id = `${sc.key}_${i}`;
    if (b.narration && durs[id]) {
      parts.push(wav(path.join(BEAT_DIR, `${id}.mp3`)));
      // 字幕 = 旁白原文（逐字对得上），不再使用摘要式字幕条
      beats.push({ subtitle: b.narration, start: t, end: t + durs[id] });
      t += durs[id];
    } else if (b.fixedDur) {
      beats.push({ subtitle: b.subtitle, start: 0, end: b.fixedDur });
      t += b.fixedDur;
    }
    if (i < sc.beats.length - 1) { parts.push(silence); t += gap; }
  });

  const narrationDur = t;
  const pad = sc.pad != null ? sc.pad : LEAD + 3.2;
  const dur = isFixed ? sc.beats[0].fixedDur : narrationDur + pad;

  let audio = null;
  if (!isFixed && parts.length) {
    audio = path.join(L.AUDIO, `scene_${sc.key}.wav`);
    concatWavs(parts, audio);
  }

  timeline.scenes.push({
    key: sc.key, name: sc.name,
    start, dur, narrationDur, gap,
    narrationOffset: isFixed ? 0 : LEAD,
    audio, beats,
  });

  prevDur = dur;
  console.log(`  ${sc.key}  ${sc.name.padEnd(20)} 时长 ${dur.toFixed(2)}s  旁白 ${narrationDur.toFixed(2)}s  停顿 ${gap}s  起点 ${start.toFixed(2)}s`);
});

timeline.total = timeline.scenes[timeline.scenes.length - 1].start + prevDur;
fs.writeFileSync(path.join(L.BUILD, 'timing.json'), JSON.stringify(timeline, null, 2), 'utf8');

// 语速核算（仅统计有旁白的场景）
const speechChars = items.reduce((n, it) => n + it.text.replace(/[，。；、——？！,.;]/g, '').length, 0);
const speechDur = timeline.scenes.filter(s => s.narrationDur > 0 && s.key !== 's0')
  .reduce((n, s) => n + s.narrationDur, 0);
console.log(`\n语速：${speechChars} 字 / ${speechDur.toFixed(1)}s = ${(speechChars / speechDur * 60).toFixed(0)} 字/分钟`);

const mm = Math.floor(timeline.total / 60);
const ss = (timeline.total % 60).toFixed(1).padStart(4, '0');
console.log(`全片总时长：${mm}:${ss}  (${timeline.total.toFixed(2)}s)`);