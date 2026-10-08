// 系统截图 v5 - 修正：知识测验、智能问答等页面
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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  
  const injectAndLoad = async (user, token) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.evaluate((u, t) => {
      localStorage.setItem('aigc_auth_token', t);
      localStorage.setItem('aigc_auth_user', JSON.stringify(u));
    }, user, token);
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(2000);
  };
  
  // 点击标签栏中指定文字的标签
  const clickTab = async (label) => {
    return page.evaluate(l => {
      // 找 header 里的标签 span
      const header = document.querySelector('header');
      if (!header) return false;
      const spans = header.querySelectorAll('span');
      for (const s of spans) {
        if (s.textContent && s.textContent.trim() === l) {
          const clickable = s.closest('div[role="button"], div[onclick], div.cursor-pointer, div');
          if (clickable) { clickable.click(); return true; }
        }
      }
      // 兜底：所有 div
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        if (d.textContent && d.textContent.trim() === l && d.getBoundingClientRect().top < 100) {
          d.click();
          return true;
        }
      }
      return false;
    }, label);
  };
  
  // 点击工作台卡片打开新标签
  const clickCard = async (text) => {
    return page.evaluate(t => {
      // 找所有包含文字的可点击元素
      const all = document.querySelectorAll('div, button, a');
      for (const el of all) {
        if (el.textContent && el.textContent.includes(t) && el.getBoundingClientRect().width > 80) {
          el.click();
          return true;
        }
      }
      return false;
    }, text);
  };
  
  // ========== 学生端 ==========
  console.log('=== 学生端 ===');
  const stu = await auth('student_demo', '123456', 'student');
  await injectAndLoad(stu.user, stu.token);
  
  // 知识图谱（已经能成功）
  console.log('截图: 知识图谱页');
  await clickCard('知识图谱');
  await wait(2500);
  await page.screenshot({ path: path.join(OUT_DIR, '05_知识图谱页.png') });
  
  // 学习路径
  console.log('截图: 学习路径页');
  await clickTab('工作台');
  await wait(800);
  await clickCard('学习路径');
  await wait(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '07_学习路径页.png') });
  
  // 智能问答 - 点击右下角浮动按钮
  console.log('截图: 智能问答页');
  await clickTab('工作台');
  await wait(800);
  await page.evaluate(() => {
    // 找浮动助手按钮
    const floatBtns = document.querySelectorAll('button, div[class*="floating"], div[class*="Floating"], div[class*="assistant"], div[class*="Assistant"]');
    for (const btn of floatBtns) {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 30 && rect.right > window.innerWidth - 100 && rect.bottom > window.innerHeight - 100) {
        btn.click();
        return true;
      }
    }
    // 也试试找右下角的圆形按钮
    const allDivs = document.querySelectorAll('div');
    for (const d of allDivs) {
      const r = d.getBoundingClientRect();
      const style = window.getComputedStyle(d);
      if (r.width > 40 && r.width < 80 && r.right > window.innerWidth - 80 && r.bottom > window.innerHeight - 80 && style.position === 'fixed') {
        d.click();
        return true;
      }
    }
    return false;
  });
  await wait(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '06_智能问答页.png') });
  
  // 知识测验 - 尝试点击
  console.log('截图: 知识小测验');
  await clickTab('工作台');
  await wait(800);
  const quizClicked = await clickCard('知识测验');
  if (!quizClicked) await clickCard('测验');
  await wait(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '09_知识小测验.png') });
  
  // 详细学习 - 从知识图谱点击节点或从学习路径点击
  console.log('截图: 详细学习页');
  await clickTab('工作台');
  await wait(800);
  const learnClicked = await clickCard('详细学习');
  if (!learnClicked) {
    // 从学习路径里找"去学习"按钮
    await clickCard('学习路径');
    await wait(1500);
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent && b.textContent.includes('去学习')) {
          b.click(); return true;
        }
      }
      return false;
    });
    await wait(1500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, '08_详细学习页.png') });
  
  // 学习资源
  console.log('截图: 学习资源页');
  await clickTab('工作台');
  await wait(800);
  await clickCard('相关学习资源');
  await wait(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '10_学习资源页.png') });
  
  // 访客中心 - 点击头像菜单里的
  console.log('截图: 访客中心');
  await clickTab('工作台');
  await wait(800);
  await page.evaluate(() => {
    // 点击用户按钮
    const userBtns = document.querySelectorAll('header button');
    if (userBtns.length > 0) userBtns[userBtns.length - 1].click();
  });
  await wait(500);
  await clickCard('访客中心');
  await wait(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '11_访客中心.png') });
  
  await browser.close();
  console.log('\n完成！');
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`共 ${files.length} 张:`);
  files.forEach(f => console.log(`  ${f}`));
}

main().catch(e => { console.error(e); process.exit(1); });
