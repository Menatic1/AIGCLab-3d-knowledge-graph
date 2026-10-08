/**
 * 补录场景 2：登录 / 注册
 * 落地页 → 进入系统 → 登录页 → 注册页（含身份选择）→ 返回登录 → 进入系统
 * 输出：S3/演示素材/视频/02_登录注册.mp4、S3/演示素材/截图/{02_登录页,03_注册页}.png
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '668c188756b835f3', 'node_modules', 'puppeteer-core'));

const ROOT = path.resolve(__dirname, '..');
const OUT_BASE = path.join(ROOT, '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S3', '演示素材');
const VID_DIR = path.join(OUT_BASE, '视频');
const SHOT_DIR = path.join(OUT_BASE, '截图');
const TMP_DIR = path.join(os.tmpdir(), 'zqql_login');

const BASE_URL = 'http://localhost:5174';
const VW = 1600, VH = 900;

const FFMPEG = (() => {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const winget = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(winget)) {
    for (const d of fs.readdirSync(winget)) {
      if (!d.startsWith('Gyan.FFmpeg')) continue;
      const root = path.join(winget, d);
      for (const sub of fs.readdirSync(root)) {
        const p = path.join(root, sub, 'bin', 'ffmpeg.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return 'ffmpeg';
})();

const findChrome = () => {
  const paths = [
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return paths.find(p => fs.existsSync(p));
};

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  [VID_DIR, SHOT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: VW, height: VH },
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();

  const shot = async (name) => {
    await wait(400);
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
    console.log(`  · 截图 ${name}.png`);
  };

  const clickText = (text, sel = 'button, a') => page.evaluate((t, s) => {
    const els = document.querySelectorAll(s);
    for (const el of els) {
      if ((el.textContent || '').trim().includes(t)) { el.click(); return true; }
    }
    return false;
  }, text, sel);

  const clickExact = (text, sel = 'button') => page.evaluate((t, s) => {
    const els = document.querySelectorAll(s);
    for (const el of els) {
      if ((el.textContent || '').trim() === t) { el.click(); return true; }
    }
    return false;
  }, text, sel);

  // ── 开始录屏 ──
  const tmp = path.join(TMP_DIR, `rec_${Date.now()}.webm`);
  const rec = await page.screencast({ path: tmp, ffmpegPath: FFMPEG, fps: 25, quality: 32 });
  console.log('▶ 录制 02_登录注册');

  try {
    // 1. 落地页
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(3200);

    // 2. 进入系统 → 登录页
    console.log('  → 点击「进入系统」');
    await clickText('进入系统');
    await wait(2400);
    await shot('02_登录页');

    // 3. 输入账号
    await page.evaluate(() => { const i = document.querySelector('input'); if (i) i.focus(); });
    await page.keyboard.type('teacher_demo', { delay: 95 });
    await wait(600);
    await page.evaluate(() => { const i = document.querySelectorAll('input'); if (i[1]) i[1].focus(); });
    await page.keyboard.type('123456', { delay: 110 });
    await wait(1400);

    // 4. 切到注册模式
    console.log('  → 点击「注册新账号」');
    await clickExact('注册新账号');
    await wait(2000);
    await shot('03_注册页');

    // 5. 选择教师身份
    console.log('  → 选择「我是老师」');
    await clickText('我是老师');
    await wait(1600);

    // 6. 返回登录
    console.log('  → 点击「返回登录」');
    await clickExact('返回登录');
    await wait(1800);

    // 7. 提交登录 → 进入系统
    console.log('  → 提交登录');
    await clickExact('进入系统');
    await wait(4200);
  } catch (e) {
    console.log(`  ! 场景异常: ${e.message}`);
  }

  await rec.stop();
  console.log('  ✓ 录屏结束');

  const outPath = path.join(VID_DIR, '02_登录注册.mp4');
  try {
    execFileSync(FFMPEG, [
      '-y', '-i', tmp,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-an', outPath,
    ], { stdio: 'pipe' });
    const mb = (fs.statSync(outPath).size / 1048576).toFixed(1);
    console.log(`  ✓ 02_登录注册.mp4  (${mb}MB)`);
  } catch (e) {
    console.log(`  ! 转码失败: ${e.message}`);
  }

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('完成');
})().catch(e => { console.error(e); process.exit(1); });