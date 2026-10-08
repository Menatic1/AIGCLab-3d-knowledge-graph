// 修复：教师端知识图谱+编辑模式 - 直接触发 React 事件
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
  await wait(4000);
  
  // 关闭 AI 助教
  const closeAssistant = async () => {
    await page.evaluate(() => {
      const all = document.querySelectorAll('button, div[role="button"], span');
      for (const el of all) {
        const txt = el.textContent?.trim();
        if (txt === '×' || txt === '✕' || txt === '✖' || txt === '✗' || txt === '⨯') {
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth - 100 && r.top < 300 && r.top > 50) {
            el.click(); return;
          }
        }
      }
    });
    await wait(200);
  };
  
  // 用 React 合成事件方式点击卡片
  const clicked = await page.evaluate(idx => {
    const cards = document.querySelectorAll('.campus-zone-hotspot');
    if (!cards[idx]) return false;
    const card = cards[idx];
    
    // 方法1: 直接原生 click
    card.click();
    
    // 方法2: 派发 MouseEvent
    setTimeout(() => {
      card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, 100);
    
    return true;
  }, 2);
  
  console.log('点击卡片:', clicked);
  await wait(3000);
  
  // 检查标签
  const tabs = await page.evaluate(() => {
    const all = document.querySelectorAll('header *');
    const result = [];
    all.forEach(t => {
      const r = t.getBoundingClientRect();
      if (t.textContent && r.top < 60 && r.height > 25 && r.width > 40) {
        const txt = t.textContent.trim();
        if (txt.length < 30 && !result.includes(txt)) {
          result.push(txt);
        }
      }
    });
    return result.slice(0, 10);
  });
  console.log('顶部元素:', tabs);
  
  await closeAssistant();
  await page.screenshot({ path: path.join(OUT_DIR, '15_图谱编辑页.png') });
  
  // 如果知识图谱标签没打开，试试其他方式
  const hasGraphTab = tabs.some(t => t.includes('知识图谱'));
  if (!hasGraphTab) {
    console.log('知识图谱标签未打开，尝试其他方式...');
    
    // 试试点击 header 里的"工作台"按钮是否存在
    const hasWorkbench = tabs.some(t => t.includes('工作台'));
    console.log('有工作台标签:', hasWorkbench);
    
    // 再等等，可能加载慢
    await wait(3000);
    
    // 再试一次点击
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.campus-zone-hotspot');
      cards.forEach(c => {
        const strong = c.querySelector('strong');
        if (strong && strong.textContent === '知识图谱') {
          c.click();
        }
      });
    });
    await wait(3000);
    
    const tabs2 = await page.evaluate(() => {
      const all = document.querySelectorAll('header *');
      const result = [];
      all.forEach(t => {
        const r = t.getBoundingClientRect();
        if (t.textContent && r.top < 60 && r.height > 25 && r.width > 40) {
          const txt = t.textContent.trim();
          if (txt.length < 30 && !result.includes(txt)) result.push(txt);
        }
      });
      return result.slice(0, 10);
    });
    console.log('第二次顶部元素:', tabs2);
    
    await closeAssistant();
    await page.screenshot({ path: path.join(OUT_DIR, '15_图谱编辑页.png') });
  }
  
  console.log('截图完成');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
