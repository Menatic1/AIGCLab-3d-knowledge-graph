// 单独修复：图谱编辑页截图
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '668c188756b835f3', 'node_modules', 'puppeteer-core'));

const OUT_DIR = path.join(__dirname, '..', 'assets', '系统截图');
const BASE_URL = 'http://localhost:5174';
const API_BASE = 'http://localhost:8000';

const findChrome = () => {
  const paths = [
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ];
  return paths.find(p => fs.existsSync(p));
};
const wait = ms => new Promise(r => setTimeout(r, ms));

async function auth(username, password, role) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (res.ok) return await res.json();
  } catch(e) {}
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('登录失败');
  return await res.json();
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  
  const tea = await auth('teacher_demo', '123456', 'teacher');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.evaluate((u, t) => {
    localStorage.setItem('aigc_auth_token', t);
    localStorage.setItem('aigc_auth_user', JSON.stringify(u));
  }, tea.user, tea.token);
  await page.reload({ waitUntil: 'networkidle2' });
  await wait(2500);
  
  // 关闭 AI 助教面板
  const closeAssistant = async () => {
    await page.evaluate(() => {
      const all = document.querySelectorAll('button, div[role="button"], span');
      for (const el of all) {
        const txt = el.textContent?.trim();
        if (txt === '×' || txt === '✕' || txt === '✖' || txt === '✗' || txt === '⨯') {
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth - 100 && r.top < 300 && r.top > 50) {
            el.click();
            return;
          }
        }
      }
    });
    await wait(200);
  };
  
  // 点击工作台卡片（知识图谱是第3个卡片，索引2）
  await page.evaluate(i => {
    const cards = document.querySelectorAll('.campus-zone-hotspot');
    if (cards[i]) cards[i].click();
  }, 2);
  await wait(2500);
  
  // 打印当前活跃标签
  const activeTab = await page.evaluate(() => {
    const tabs = document.querySelectorAll('header button, header div[role="button"]');
    const result = [];
    tabs.forEach(t => {
      if (t.textContent && t.getBoundingClientRect().top < 60) {
        result.push(t.textContent.trim().substring(0, 20));
      }
    });
    return result;
  });
  console.log('顶部标签:', activeTab);
  
  await closeAssistant();
  
  // 点击"编辑图谱"按钮
  const clicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent && b.textContent.includes('编辑图谱')) {
        b.click();
        return true;
      }
    }
    return false;
  });
  console.log('点击编辑图谱:', clicked);
  await wait(2000);
  
  await closeAssistant();
  
  // 截图
  await page.screenshot({ path: path.join(OUT_DIR, '15_图谱编辑页.png') });
  console.log('截图完成: 15_图谱编辑页.png');
  
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
