// 渲染代码绘制封面：HTML -> PNG（A4 竖版）
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '668c188756b835f3', 'node_modules', 'puppeteer-core'));

const SCRIPT_DIR = __dirname;
const HTML = path.join(SCRIPT_DIR, 'cover.html');
const OUT_DIR = path.resolve(SCRIPT_DIR, '..', '..', '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S0');
const OUT_PNG = path.join(OUT_DIR, '封面图_代码绘制.png');

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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1654, height: 2339, deviceScaleFactor: 1 });
  await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: OUT_PNG, type: 'png', clip: { x: 0, y: 0, width: 1654, height: 2339 } });
  await browser.close();
  console.log('✓ 封面渲染完成:', OUT_PNG);
  console.log('  尺寸: 1654 x 2339 (A4 @200dpi)');
})().catch(e => { console.error(e); process.exit(1); });