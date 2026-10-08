/**
 * 逐场景合成：按 beat 窗口裁剪素材 / 缩放 1080p / 字幕叠加 → scenes/<key>.mp4（无声）
 *
 * 素材类型：
 *   anim   —— 片头/片尾 HTML 动画渲染出的 mp4
 *   clips  —— 视频_timed 中按旁白节奏录制的素材；每个 beat 指定 clips[]
 *             continuous: 整段共用同一条素材（首页连续下移）
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const CFG = require('./config.cjs');
const TIMING = require('./timing.json');

const OUT = L.SCENES;
const SUBS = path.join(L.OVERLAY, 'subs');
const ANIM_OUT = path.join(L.TMP, 'anim_out');

const W = CFG.OUT_W, H = CFG.OUT_H, FPS = 25;
const LEAD = TIMING.lead;
const SUB_TAIL = 0.15;              // 字幕比旁白多停留
const NO_SUB = new Set(['s0', 's7']); // 片头/片尾字幕由动画本身承载

const cfgByKey = Object.fromEntries(CFG.scenes.map(s => [s.key, s]));

function padTrim(avail, dur) {
  const pad = Math.max(0, dur - avail);
  const tpad = pad > 0.005 ? `,tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)}` : '';
  return `${tpad},trim=duration=${dur.toFixed(3)}`;
}

function buildScene(ts) {
  const cs = cfgByKey[ts.key];
  const src = cs.source;
  const dur = ts.dur;
  const args = ['-y', '-v', 'error'];
  let fc = '';
  let avail = 0;
  let nIn = 0;

  if (src.type === 'anim') {
    const f = path.join(ANIM_OUT, path.basename(src.html, '.html') + '.mp4');
    args.push('-i', f);
    nIn = 1;
    avail = L.duration(f);
    fc = `[0:v]scale=${W}:${H}:flags=lanczos,setsar=1,fps=${FPS}${padTrim(avail, dur)},setpts=PTS-STARTPTS[base];`;

  } else {
    // clips：按窗口把素材切成若干 shot
    //   - clip.take 显式指定占用秒数（用于「实拍引子 + 产品录屏」这类固定配比）
    //   - 未指定 take 的片段，按各自可用长度等比瓜分剩余窗口
    const shots = [];
    const addShots = (clips, win) => {
      const avails = clips.map(c => Math.max(0, L.duration(c.file) - c.from));
      const fixed = clips.map((c, j) => (c.take != null ? Math.min(c.take, avails[j]) : null));
      const fixedSum = fixed.reduce((a, b) => a + (b || 0), 0);
      const restIdx = fixed.map((f, j) => (f == null ? j : -1)).filter(j => j >= 0);
      const restWin = Math.max(0, win - fixedSum);
      const restTotal = restIdx.reduce((a, j) => a + avails[j], 0) || 1;
      clips.forEach((c, j) => {
        const take = fixed[j] != null ? fixed[j] : Math.min(avails[j], restWin * avails[j] / restTotal);
        if (take > 0.05) shots.push({ file: c.file, from: c.from, take });
      });
    };

    if (src.continuous) {
      addShots(src.clips, dur);
    } else {
      // 窗口边界：beat 0 覆盖开头 LEAD 预卷，末 beat 覆盖到场景结束
      const bounds = [0];
      for (let i = 1; i < ts.beats.length; i++) bounds.push(LEAD + ts.beats[i].start);
      bounds.push(dur);
      ts.beats.forEach((b, i) => {
        const clips = (cs.beats[i] && cs.beats[i].clips) || [];
        const win = bounds[i + 1] - bounds[i];
        if (clips.length) addShots(clips, win);
      });
    }

    shots.forEach(s => args.push('-ss', s.from.toFixed(3), '-t', s.take.toFixed(3), '-i', s.file));
    nIn = shots.length;

    shots.forEach((s, j) => {
      fc += `[${j}:v]scale=${W}:${H}:flags=lanczos,setsar=1,fps=${FPS},setpts=PTS-STARTPTS[sh${j}];`;
    });
    fc += shots.map((s, j) => `[sh${j}]`).join('') + `concat=n=${shots.length}:v=1:a=0[cat];`;
    avail = shots.reduce((a, s) => a + s.take, 0);
    fc += `[cat]null${padTrim(avail, dur)},setpts=PTS-STARTPTS[base];`;
  }

  // ── 字幕叠加 ──
  let last = 'base';
  let nSub = 0;
  if (!NO_SUB.has(ts.key)) {
    ts.beats.forEach((b, i) => {
      const png = path.join(SUBS, `${ts.key}_${i}.png`);
      if (!fs.existsSync(png)) return;
      const s = ts.narrationOffset + b.start;
      const e = Math.min(dur, ts.narrationOffset + b.end + SUB_TAIL);
      if (e <= s) return;
      args.push('-loop', '1', '-framerate', String(FPS), '-i', png);
      const idx = nIn + nSub;
      fc += `[${idx}:v]format=rgba[sb${i}];`;
      fc += `[${last}][sb${i}]overlay=0:0:eof_action=repeat:enable='between(t,${s.toFixed(3)},${e.toFixed(3)})'[o${i}];`;
      last = `o${i}`;
      nSub++;
    });
  }
  fc += `[${last}]format=yuv420p[v]`;

  const out = path.join(OUT, `${ts.key}.mp4`);
  args.push(
    '-filter_complex', fc,
    '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-t', dur.toFixed(3),
    '-movflags', '+faststart',
    out,
  );
  return { args, out, dur, avail, nSub, nShot: nIn };
}

// 可选：仅重建指定场景，如 `node compose.cjs s5`（默认全部重建）
const ONLY = process.argv.slice(2).filter(a => !a.startsWith('-'));

(async () => {
  L.mkdirs(OUT);
  const list = ONLY.length ? TIMING.scenes.filter(s => ONLY.includes(s.key)) : TIMING.scenes;
  console.log(`合成场景：${list.length} 段${ONLY.length ? `（筛选 ${ONLY.join(',')}）` : ''}\n`);

  let sum = 0;
  for (const ts of list) {
    const { args, out, dur, avail, nSub, nShot } = buildScene(ts);
    process.stdout.write(`▶ ${ts.key} ${ts.name.padEnd(20)} ${dur.toFixed(2)}s  shot ${nShot}  素材 ${avail.toFixed(2)}s  字幕 ${nSub}  `);
    L.run(args);
    const d = L.duration(out);
    sum += d;
    console.log(`→ ${d.toFixed(2)}s  ${(fs.statSync(out).size / 1048576).toFixed(1)}MB`);
  }

  console.log(`\n场景总时长 ${sum.toFixed(2)}s（未计转场重叠）→ ${OUT}`);
})().catch(e => { console.error(e.stderr ? e.stderr.toString() : e); process.exit(1); });