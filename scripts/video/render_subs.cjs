/**
 * 字幕条渲染：按 timing.json 的 beat 生成透明底 PNG（1920×1080）
 * 输出：overlay/subs/<scene>_<i>.png + overlay/subs/manifest.json
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const puppeteer = L.loadPuppeteer();
const TIMING = require('./timing.json');

const OUT = path.join(L.OVERLAY, 'subs');
const W = 1920, H = 1080;

const findChrome = () => {
  const paths = [
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return paths.find(p => fs.existsSync(p));
};

// 字幕排版：短句单行；长句按标点折成 2 行并自动缩号，保证两侧留白
function layout(text) {
  const chars = [...text];
  const n = chars.length;
  if (n <= 22) return { lines: [text], fs: 38, ls: 3 };

  // 找最靠近中点的标点作为断行位置
  const PUNCT = new Set(['，', '。', '；', '、', '：', '——', '！', '？', '·', '—']);
  let cut = -1, best = Infinity;
  for (let i = 1; i < n - 1; i++) {
    if (!PUNCT.has(chars[i - 1])) continue;
    const score = Math.abs(i - n / 2);
    if (score < best) { best = score; cut = i; }
  }
  let lines;
  if (cut > 0) {
    lines = [chars.slice(0, cut).join('').trim(), chars.slice(cut).join('').trim()].filter(Boolean);
  } else {
    lines = [text];
  }
  const maxLen = Math.max(...lines.map(l => [...l].length));
  const fs = maxLen > 34 ? 26 : maxLen > 30 ? 28 : maxLen > 26 ? 31 : 34;
  const ls = maxLen > 30 ? 1 : 2;
  return { lines, fs, ls };
}

// 蓝图风格字幕条
function page(text) {
  const { lines, fs, ls } = layout(text);
  const body = lines.map(l =>
    `<div class="ln">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
  .band{
    position:absolute;left:0;right:0;bottom:0;height:380px;
    background:linear-gradient(to top,
      rgba(4,10,20,0.88) 0%,
      rgba(4,10,20,0.64) 30%,
      rgba(4,10,20,0.26) 64%,
      rgba(4,10,20,0) 100%);
  }
  .bar{
    position:absolute;left:0;right:0;bottom:104px;
    display:flex;flex-direction:column;align-items:center;
  }
  .line{
    display:flex;align-items:center;margin-bottom:20px;
  }
  .line .seg{
    width:300px;height:1.5px;
    background:linear-gradient(90deg, rgba(214,170,84,0) 0%, rgba(232,196,116,0.95) 100%);
  }
  .line .seg.r{transform:scaleX(-1)}
  .line .dm{
    width:9px;height:9px;margin:0 6px;transform:rotate(45deg);
    background:rgba(232,196,116,0.95);
    box-shadow:0 0 12px rgba(232,196,116,0.7);
  }
  .txt{
    font-family:"Microsoft YaHei","微软雅黑",sans-serif;
    font-size:${fs}px;font-weight:500;letter-spacing:${ls}px;
    color:#f2f7ff;text-align:center;
    text-shadow:0 2px 10px rgba(0,0,0,0.92),0 0 26px rgba(0,0,0,0.78),0 1px 2px rgba(0,0,0,1);
  }
  .ln{white-space:nowrap;line-height:1.46;padding-left:${ls}px}
</style></head><body>
  <div class="band"></div>
  <div class="bar">
    <div class="line">
      <div class="seg"></div><div class="dm"></div><div class="seg r"></div>
    </div>
    <div class="txt">${body}</div>
  </div>
</body></html>`;
}

(async () => {
  L.mkdirs(OUT);

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'],
  });
  const p = await browser.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const manifest = [];
  let count = 0;

  for (const sc of TIMING.scenes) {
    // 片头字幕由动画本身承载，不叠加
    if (sc.key === 's0') continue;
    for (let i = 0; i < sc.beats.length; i++) {
      const b = sc.beats[i];
      const name = `${sc.key}_${i}.png`;
      await p.setContent(page(b.subtitle), { waitUntil: 'load' });
      await p.evaluate(() => document.fonts && document.fonts.ready);
      await p.screenshot({
        path: path.join(OUT, name),
        type: 'png',
        omitBackground: true,
        clip: { x: 0, y: 0, width: W, height: H },
      });
      manifest.push({ scene: sc.key, beat: i, subtitle: b.subtitle, file: name });
      count++;
      console.log(`  ✓ ${name}  ${b.subtitle.slice(0, 30)}`);
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n字幕条渲染完成：${count} 张 → ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });