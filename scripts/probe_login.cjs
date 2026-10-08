/** 调试：首页 → 登录页 的跳转方式 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '668c188756b835f3', 'node_modules', 'puppeteer-core'));

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
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: 'new', defaultViewport: { width: 1600, height: 900 }, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
  await wait(2600);

  const info = await page.evaluate(() => {
    const cands = [];
    document.querySelectorAll('button, a, div, span').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t === '登录' || t.includes('登录')) {
        const r = el.getBoundingClientRect();
        cands.push({ tag: el.tagName, text: t.slice(0, 20), href: el.getAttribute && el.getAttribute('href'), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) });
      }
    });
    return { url: location.href, cands: cands.slice(0, 14) };
  });
  console.log('URL:', info.url);
  console.log(JSON.stringify(info.cands, null, 1));

  // 尝试点击
  const clicked = await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, a')) {
      if ((el.textContent || '').trim() === '进入系统') { el.click(); return (el.textContent || '').trim(); }
    }
    return null;
  });
  console.log('clicked:', clicked);
  await wait(2800);
  console.log('URL after:', await page.evaluate(() => location.href));
  console.log('has password input:', await page.evaluate(() => !!document.querySelector('input[type="password"]')));
  console.log('buttons:', await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim()).filter(Boolean).slice(0, 20)));
  console.log('links:', await page.evaluate(() => Array.from(document.querySelectorAll('a,span,div')).map(b => (b.textContent || '').trim()).filter(t => t && t.length < 14 && (t.includes('注册') || t.includes('登录') || t.includes('学生') || t.includes('教师'))).slice(0, 20)));
  await page.screenshot({ path: path.join(__dirname, 'video', 'tmp', 'probe_login.png') });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });