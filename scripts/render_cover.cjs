const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '668c188756b835f3', 'node_modules', 'puppeteer-core'));

const HTML = path.resolve(__dirname, 'cover', 'cover.html');
const OUT = path.resolve(__dirname, '..', '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S0', '封面图_代码绘制.png');

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
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1654, height: 2339, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: OUT, type: 'png', clip: { x: 0, y: 0, width: 1654, height: 2339 } });
  await browser.close();
  const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
  console.log(`✓ ${path.basename(OUT)}  (${mb}MB)`);
})().catch(e => { console.error(e); process.exit(1); });