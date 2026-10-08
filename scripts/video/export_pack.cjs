/**
 * 素材与字幕打包：把成片、实拍素材、动画、产品录屏、截图、字幕、时间轴
 * 整理到同一个交付文件夹，并生成 SRT / ASS / 字幕文本 / 分镜对照表 / README。
 *
 * 用法：node scripts/video/export_pack.cjs
 * 幂等：重复运行会覆盖目标包内容。
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const CFG = require('./config.cjs');
const TIMING = require('./timing.json');

const PACK = path.join(L.S3, '演示视频_素材与字幕包');
const D = {
  film:   path.join(PACK, '01_成片'),
  subs:   path.join(PACK, '02_字幕'),
  subPng: path.join(PACK, '02_字幕', '字幕条_透明PNG'),
  stock:  path.join(PACK, '03_实拍素材'),
  animOut:path.join(PACK, '04_动画素材', '动画成片'),
  animSrc:path.join(PACK, '04_动画素材', '动画源文件'),
  raw:    path.join(PACK, '05_产品录屏', '原始录屏'),
  timed:  path.join(PACK, '05_产品录屏', '分镜录屏'),
  shots:  path.join(PACK, '06_产品截图'),
  tl:     path.join(PACK, '07_时间轴与分镜'),
  tools:  path.join(PACK, '08_工程脚本'),
};
const NO_SUB = new Set(['s0', 's7']);   // 片头/片尾字幕由动画本身承载
const FPS = 25, LEAD = TIMING.lead;

let nCopy = 0, nBytes = 0;
function copyInto(src, dstDir, rename) {
  if (!fs.existsSync(src)) { console.log('  ! 缺失 ' + src); return null; }
  fs.mkdirSync(dstDir, { recursive: true });
  const dst = path.join(dstDir, rename || path.basename(src));
  fs.copyFileSync(src, dst);
  nCopy++; nBytes += fs.statSync(dst).size;
  return dst;
}
function copyDir(srcDir, dstDir, filter) {
  if (!fs.existsSync(srcDir)) { console.log('  ! 缺失目录 ' + srcDir); return 0; }
  let n = 0;
  for (const f of fs.readdirSync(srcDir)) {
    if (filter && !filter(f)) continue;
    if (copyInto(path.join(srcDir, f), dstDir)) n++;
  }
  return n;
}

// ── 时间码工具 ──
const pad = (n, w = 2) => String(n).padStart(w, '0');
function srtTime(s) {
  const ms = Math.round(s * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}
function assTime(s) {
  const cs = Math.round(s * 100);
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
}

// ── 取得全片字幕 cue（与烧录进画面的窗口完全一致）──
const cues = [];
for (const sc of TIMING.scenes) {
  if (NO_SUB.has(sc.key)) continue;
  sc.beats.forEach((b, i) => {
    if (!b.subtitle) return;
    cues.push({
      scene: sc.key, sceneName: sc.name, beat: i,
      start: sc.start + sc.narrationOffset + b.start,
      end: sc.start + sc.narrationOffset + b.end + 0.15,
      text: b.subtitle,
      png: `${sc.key}_${i}.png`,
    });
  });
}

// ── 复刻 compose 的分镜切分，产出「哪一秒是哪段素材」──
const cfgByKey = Object.fromEntries(CFG.scenes.map(s => [s.key, s]));
function takeDur(file) { try { return L.duration(file); } catch { return 0; } }
function shotsOf(ts) {
  const cs = cfgByKey[ts.key], src = cs.source, out = [];
  if (src.type === 'anim') {
    const f = path.join(L.TMP, 'anim_out', path.basename(src.html, '.html') + '.mp4');
    out.push({ file: f, from: 0, take: ts.dur, kind: '动画' });
    return out;
  }
  const add = (clips, win) => {
    const avails = clips.map(c => Math.max(0, takeDur(c.file) - c.from));
    const fixed = clips.map((c, j) => (c.take != null ? Math.min(c.take, avails[j]) : null));
    const fixedSum = fixed.reduce((a, b) => a + (b || 0), 0);
    const restIdx = fixed.map((f, j) => (f == null ? j : -1)).filter(j => j >= 0);
    const restWin = Math.max(0, win - fixedSum);
    const restTotal = restIdx.reduce((a, j) => a + avails[j], 0) || 1;
    clips.forEach((c, j) => {
      const take = fixed[j] != null ? fixed[j] : Math.min(avails[j], restWin * avails[j] / restTotal);
      if (take > 0.05) out.push({ file: c.file, from: c.from, take, kind: classify(c.file) });
    });
  };
  if (src.continuous) add(src.clips, ts.dur);
  else {
    const bounds = [0];
    for (let i = 1; i < ts.beats.length; i++) bounds.push(LEAD + ts.beats[i].start);
    bounds.push(ts.dur);
    ts.beats.forEach((b, i) => {
      const clips = (cs.beats[i] && cs.beats[i].clips) || [];
      if (clips.length) add(clips, bounds[i + 1] - bounds[i]);
    });
  }
  return out;
}
function classify(f) {
  if (f.includes(`${path.sep}anim_out${path.sep}`)) return '动画';
  if (f.includes(`${path.sep}stock${path.sep}`)) return '实拍';
  return '产品录屏';
}

(async () => {
  console.log('打包到：' + PACK);
  fs.rmSync(PACK, { recursive: true, force: true });
  Object.values(D).forEach(d => fs.mkdirSync(d, { recursive: true }));

  // 1) 成片
  copyInto(path.join(L.S3, '演示视频_智绘千里.mp4'), D.film);

  // 2) 字幕条 PNG + manifest
  copyDir(path.join(L.OVERLAY, 'subs'), D.subPng, f => f.endsWith('.png') || f === 'manifest.json');

  // 3) 实拍素材 + 清单
  copyDir(L.STOCK, D.stock, f => f.endsWith('.mp4'));
  copyInto(path.join(L.BUILD, 'stock', 'candidates.json'), D.stock, 'Mixkit候选清单_原始抓取.json');

  // 4) 动画成片 + 源文件
  copyDir(path.join(L.TMP, 'anim_out'), D.animOut, f => f.endsWith('.mp4'));
  copyDir(path.join(L.BUILD, 'anim'), D.animSrc, f => f.endsWith('.html'));

  // 5) 产品录屏（原始 + 分镜）
  copyDir(path.join(L.MATERIAL, '视频'), D.raw, f => f.endsWith('.mp4'));
  copyDir(L.TIMED_DIR, D.timed, f => f.endsWith('.mp4'));

  // 6) 产品截图
  copyDir(L.SHOT_DIR, D.shots, f => f.endsWith('.png'));

  // 7) 时间轴
  copyInto(path.join(L.BUILD, 'timing.json'), D.tl, 'timing.json');

  // 8) 工程脚本
  for (const f of ['lib.cjs', 'config.cjs', 'gen_narration.cjs', 'render_subs.cjs', 'render_anim.cjs',
                   'compose.cjs', 'assemble.cjs', 'export_pack.cjs', 'tts.py']) {
    copyInto(path.join(L.BUILD, f), D.tools);
  }

  // ── 生成 SRT ──
  const srt = cues.map((c, i) =>
    `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
  fs.writeFileSync(path.join(D.subs, '演示视频_智绘千里.srt'), '\uFEFF' + srt, 'utf8');

  // ── 生成 ASS（蓝图风格，可直接烧录）──
  const HEAD = `[Script Info]
Title: 智绘千里 · AIGC知识图谱智能导学系统 — 演示视频字幕
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,44,&H00FFF7F2,&H00FFF7F2,&H96040A14,&H64040A14,0,0,0,0,100,100,2,0,1,3.5,2.5,2,120,120,110,134

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const ev = cues.map(c => {
    const t = c.text.replace(/\n/g, '\\N');
    return `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${t}`;
  }).join('\n');
  fs.writeFileSync(path.join(D.subs, '演示视频_智绘千里.ass'), '\uFEFF' + HEAD + ev + '\n', 'utf8');

  // ── 字幕文本对照 ──
  const mdSub = ['# 字幕文本对照', '',
    `共 ${cues.length} 条字幕，全部为旁白原文（逐字一致）。时间码与成片中烧录的字幕条完全一致。`, '',
    '| # | 时间码 | 时长 | 场景 | 字幕文本 |', '|---|---|---|---|---|',
    ...cues.map((c, i) => `| ${i + 1} | ${srtTime(c.start).replace(',', '.')} → ${srtTime(c.end).replace(',', '.')} | ${(c.end - c.start).toFixed(1)}s | ${c.sceneName} | ${c.text} |`),
    '', '> 片头（0:00–0:08）与片尾（3:06–3:14）字幕由动画本身承载，不使用字幕条叠加。', ''];
  fs.writeFileSync(path.join(D.subs, '字幕文本对照.md'), mdSub.join('\n'), 'utf8');

  // ── 分镜对照表 ──
  const rows = [];
  rows.push('# 分镜对照表', '',
    `全片 ${TIMING.total.toFixed(2)}s（${Math.floor(TIMING.total / 60)}:${(TIMING.total % 60).toFixed(1).padStart(4, '0')}） · 1920×1080 / ${FPS}fps · 旁白 552 字 / 215 字每分钟`, '',
    `场景之间为 ${TIMING.overlap}s 交叉溶解，故相邻场景的时间码有 ${TIMING.overlap}s 重叠。「对应字幕」标在**该条字幕出现的那一格画面**上。`, '',
    '| 场景 | 时间码 | 时长 | 画面来源 | 类型 | 对应字幕 |', '|---|---|---|---|---|---|');
  for (const ts of TIMING.scenes) {
    const shots = shotsOf(ts);
    const scStart = ts.start;
    // 先算出每格画面的绝对时间
    let cursor = scStart;
    const abs = shots.map(s => { const o = { ...s, abs: cursor, name: path.basename(s.file) }; cursor += s.take; return o; });
    // 每条字幕落到它起点所在的那一格
    const subOf = new Map();
    if (!NO_SUB.has(ts.key)) {
      ts.beats.forEach(b => {
        if (!b.subtitle) return;
        const ws = scStart + ts.narrationOffset + b.start;
        const idx = abs.findIndex(s => ws >= s.abs - 1e-6 && ws < s.abs + s.take);
        if (idx >= 0) subOf.set(idx, b.subtitle);
      });
    }
    abs.forEach((s, i) => {
      rows.push(`| ${i === 0 ? ts.name : ''} | ${srtTime(s.abs).replace(',', '.')} → ${srtTime(s.abs + s.take).replace(',', '.')} | ${s.take.toFixed(1)}s | \`${s.name}\` | ${s.kind} | ${subOf.get(i) || ''} |`);
    });
  }
  fs.writeFileSync(path.join(D.tl, '分镜对照表.md'), rows.join('\n') + '\n', 'utf8');

  // ── README ──
  const animCount = fs.readdirSync(D.animOut).filter(f => f.endsWith('.mp4')).length;
  const stockCount = fs.readdirSync(D.stock).filter(f => f.endsWith('.mp4')).length;
  const timedCount = fs.readdirSync(D.timed).filter(f => f.endsWith('.mp4')).length;
  const rawCount = fs.readdirSync(D.raw).filter(f => f.endsWith('.mp4')).length;
  const shotCount = fs.readdirSync(D.shots).filter(f => f.endsWith('.png')).length;

  const readme = `# 智绘千里 · 演示视频素材与字幕包

产品：**智绘千里 — AIGC 知识图谱智能导学系统**
成片：\`01_成片/演示视频_智绘千里.mp4\` — 1920×1080 / ${FPS}fps / H.264 + AAC，时长 **3:14.2**（上限 3:30）

---

## 目录结构

| 文件夹 | 内容 | 数量 |
|---|---|---|
| \`01_成片/\` | 最终成片 | 1 |
| \`02_字幕/\` | SRT / ASS / 文本对照 / 透明字幕条 PNG | ${cues.length} 条字幕 |
| \`03_实拍素材/\` | Mixkit 免费授权实拍素材 + 素材清单 | ${stockCount} |
| \`04_动画素材/\` | 动画成片 mp4 + 可复现的 HTML 源文件 | ${animCount} + ${fs.readdirSync(D.animSrc).length} |
| \`05_产品录屏/\` | 原始整段录屏 + 按旁白节奏的分镜录屏 | ${rawCount} + ${timedCount} |
| \`06_产品截图/\` | 产品页面截图 | ${shotCount} |
| \`07_时间轴与分镜/\` | timing.json + 分镜对照表 | 2 |
| \`08_工程脚本/\` | 重建成片所需的完整流水线 | 9 |

---

## 字幕说明

- **02_字幕/演示视频_智绘千里.srt** —— 标准 SRT，可直接导入 Premiere / 剪映 / DaVinci。
- **02_字幕/演示视频_智绘千里.ass** —— 带蓝图风格样式的 ASS，可直接烧录成与成片一致的字幕条。
- **02_字幕/字幕文本对照.md** —— 人读版对照表（时间码 + 文本）。
- **02_字幕/字幕条_透明PNG/** —— 成片中实际叠加的 1920×1080 透明底字幕条。

字幕**全部为旁白原文，逐字一致**。长句在最靠近句中的标点处断成两行，字号按最长行自动收缩（26 / 28 / 31 / 34px）。

时间轴复核：字幕相对语音的前导量为 **0.21～0.42s**（字幕略早于语音，属正常做法），语音覆盖率 69～91%，其余为句内停顿。

> 片头（0:00–0:08）与片尾（3:06–3:14）不使用字幕条叠加 —— 字幕由动画本身承载，避免与片尾标语重叠。因此 \`s0_*\` / \`s7_*\` 若存在于 PNG 目录中即未被使用。

---

## 画面构成

| 类型 | 时长 | 占比 |
|---|---|---|
| 动画（12 段） | 58.2s | 30% |
| 实拍素材 | 28.5s | 15% |
| 产品界面录屏 | 107.5s | 55% |

12 段动画：片头、知识重组、两种角色、文档解析流程、力导向生成图谱、图谱人工校对、多模态资源、片尾。
动画源文件为自包含 HTML，通过 \`window.__seek(t)\` 逐帧确定性驱动，可用无头 Chrome 精确复现。

---

## 实拍素材授权

来源 **Mixkit**（https://mixkit.co），适用 **Mixkit Free License**：可免费用于商业与非商业项目，**无需署名**。
限制：不得将素材本身作为独立素材再分发或转售。

素材清单见 \`03_实拍素材/Mixkit候选清单_原始抓取.json\`（抓取到的全部候选）与 \`素材清单.md\`（实际使用的片段与在片中的位置）。

---

## 重建成片

\`\`\`powershell
cd <项目根>
node scripts/video/gen_narration.cjs     # 生成旁白与时间轴（已存在则复用）
node scripts/video/render_subs.cjs       # 渲染字幕条 PNG（需 Chrome）
node scripts/video/render_anim.cjs       # 渲染全部动画（需 Chrome）
node scripts/video/compose.cjs           # 逐场景合成
node scripts/video/assemble.cjs          # 拼接成片
\`\`\`

> \`08_工程脚本/\` 中的脚本需放回项目 \`scripts/video/\` 下运行；脚本按 id 从 \`03_实拍素材/\` 解析实拍文件，路径见 \`lib.cjs\`。
> 注：\`render_subs.cjs\` / \`render_anim.cjs\` 需要无头 Chrome，在受限沙箱下会因命名管道被拦截而失败，须在正常桌面环境运行。
`;
  fs.writeFileSync(path.join(PACK, 'README.md'), readme, 'utf8');

  // ── 实拍素材清单 ──
  const used = new Map();
  for (const ts of TIMING.scenes) for (const s of shotsOf(ts)) {
    if (s.kind !== '实拍') continue;
    const id = (path.basename(s.file).match(/-(\d+)\.mp4$/) || [])[1];
    if (!id) continue;
    const cur = used.get(id) || { file: path.basename(s.file), total: 0 };
    cur.total += s.take; used.set(id, cur);
  }
  const byId = new Map(JSON.parse(fs.readFileSync(path.join(L.BUILD, 'stock', 'candidates.json'), 'utf8')).map(c => [c.id, c]));
  const mdStock = ['# 实拍素材清单', '',
    '来源：**Mixkit**（https://mixkit.co）· **Mixkit Free License**：可商用免署名，但不得作为独立素材再分发。', '',
    `本目录共收录 **${stockCount}** 段实拍素材，其中 **${used.size}** 段用进了成片，其余为同期抓取的备选。`, '',
    '## 已用进成片的片段', '',
    '| 素材 id | 文件名 | 片中用量 | Mixkit 页面 |', '|---|---|---|---|'];
  for (const [id, v] of [...used.entries()].sort((a, b) => b[1].total - a[1].total)) {
    const c = byId.get(id);
    mdStock.push(`| ${id} | \`${v.file}\` | ${v.total.toFixed(1)}s | https://mixkit.co/free-stock-video/${c ? c.slug : ''}/ |`);
  }
  mdStock.push('', `合计约 **${[...used.values()].reduce((a, b) => a + b.total, 0).toFixed(1)}s**。`, '',
    '## 备选（未剪入成片）', '');
  const unused = [...byId.values()].filter(c => !used.has(c.id) &&
    fs.existsSync(path.join(D.stock, c.slug + '.mp4')));
  if (unused.length) {
    mdStock.push('| 素材 id | 文件名 | Mixkit 页面 |', '|---|---|---|');
    for (const c of unused.sort((a, b) => a.slug.localeCompare(b.slug))) {
      mdStock.push(`| ${c.id} | \`${c.slug}.mp4\` | https://mixkit.co/free-stock-video/${c.slug}/ |`);
    }
  } else mdStock.push('（无）');
  mdStock.push('', `> 另有 \`Mixkit候选清单_原始抓取.json\`：抓取阶段得到的全部 ${JSON.parse(fs.readFileSync(path.join(L.BUILD, 'stock', 'candidates.json'), 'utf8')).length} 条候选（含未下载项）。`, '');
  fs.writeFileSync(path.join(D.stock, '素材清单.md'), mdStock.join('\n'), 'utf8');

  // ── 汇总 ──
  let total = 0, files = 0;
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
    const st = fs.statSync(p); if (st.isDirectory()) walk(p); else { files++; total += st.size; } } })(PACK);
  console.log(`\n✓ 打包完成：${files} 个文件，${(total / 1048576).toFixed(1)}MB`);
  for (const [k, v] of Object.entries(D)) {
    const rel = path.relative(PACK, v);
    const c = fs.existsSync(v) ? fs.readdirSync(v).length : 0;
    console.log(`  ${rel.padEnd(34)} ${c} 项`);
  }
})().catch(e => { console.error(e); process.exit(1); });
