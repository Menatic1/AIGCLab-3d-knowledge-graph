/**
 * HTML 动画 → mp4
 * 通过 window.__seek(t) 逐帧确定性渲染，puppeteer 截图后由 ffmpeg 编码
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib.cjs');
const puppeteer = L.loadPuppeteer();
const ANIM_DIR = path.join(L.BUILD, 'anim');
const FRAME_ROOT = path.join(L.TMP, 'frames');
const OUT_DIR = path.join(L.TMP, 'anim_out');

const FPS = 25;
const W = 1920, H = 1080;

// name, 时长(秒)
const ALL_JOBS = [
  { html: 'intro.html', dur: 8.0 },
  { html: 'outro.html', dur: 8.1 },
  { html: 'rebuild.html', dur: 6.1 },
  { html: 'roles.html', dur: 3.6 },
  { html: 'pipeline.html', dur: 4.2 },
  { html: 'graphflow.html', dur: 5.0 },
  { html: 'path.html', dur: 4.0 },
  { html: 'report.html', dur: 4.0 },
  { html: 'multimodal.html', dur: 4.0 },
  { html: 'qa.html', dur: 3.6 },
  { html: 'edit.html', dur: 4.0 },
  { html: 'quiz.html', dur: 3.6 },
];
const only = process.argv.slice(2);
const JOBS = only.length ? ALL_JOBS.filter(j => only.includes(path.basename(j.html, '.html'))) : ALL_JOBS;

const findChrome = () => {
  const paths = [
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return paths.find(p => fs.existsSync(p));
};

(async () => {
  [FRAME_ROOT, OUT_DIR].forEach(d => L.mkdirs(d));

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  for (const job of JOBS) {
    const htmlPath = path.join(ANIM_DIR, job.html);
    const name = path.basename(job.html, '.html');
    const frames = Math.round(job.dur * FPS);
    console.log(`\n▶ ${name}  ${frames} 帧 @ ${FPS}fps`);

    // 每个动画独立帧目录，避免残留帧污染
    const FRAME_DIR = path.join(FRAME_ROOT, name);
    fs.rmSync(FRAME_DIR, { recursive: true, force: true });
    L.mkdirs(FRAME_DIR);

    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction('window.__ready === true', { timeout: 30000 });
    // 等字体就绪
    await page.evaluate(() => document.fonts && document.fonts.ready);

    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      const t = i / FPS;
      await page.evaluate(tt => window.__seek(tt), t);
      await page.screenshot({
        path: path.join(FRAME_DIR, `f_${String(i).padStart(5, '0')}.png`),
        type: 'png',
        clip: { x: 0, y: 0, width: W, height: H },
        optimizeForSpeed: true,
      });
      if (i % 25 === 0) process.stdout.write(`  ${i}/${frames}\r`);
    }
    console.log(`  截图完成 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const out = path.join(OUT_DIR, `${name}.mp4`);
    execFileSync(L.FFMPEG, [
      '-y', '-v', 'error',
      '-framerate', String(FPS),
      '-i', path.join(FRAME_DIR, 'f_%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
      '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-movflags', '+faststart',
      '-an', out,
    ], { stdio: 'inherit' });

    const d = L.duration(out);
    console.log(`  ✓ ${name}.mp4  ${d.toFixed(2)}s  ${(fs.statSync(out).size / 1048576).toFixed(1)}MB`);
  }

  await browser.close();
  fs.rmSync(FRAME_ROOT, { recursive: true, force: true });
  console.log('\n动画渲染完成 →', OUT_DIR);
})().catch(e => { console.error(e); process.exit(1); });