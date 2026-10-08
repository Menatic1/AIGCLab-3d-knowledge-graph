// 系统截图 v7 - 最终版：修复所有页面导航 + 关闭AI助教
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
  
  // 先访问页面再注入 token
  const injectAndLoad = async (user, token) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.evaluate((u, t) => {
      localStorage.setItem('aigc_auth_token', t);
      localStorage.setItem('aigc_auth_user', JSON.stringify(u));
    }, user, token);
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(2500);
  };
  
  // 关闭 AI 助教浮动面板
  const closeAssistant = async () => {
    const closed = await page.evaluate(() => {
      // 找所有 × 关闭按钮
      const all = document.querySelectorAll('button, div[role="button"], span');
      for (const el of all) {
        const txt = el.textContent?.trim();
        if (txt === '×' || txt === '✕' || txt === '✖' || txt === '✗' || txt === '⨯') {
          const r = el.getBoundingClientRect();
          // 只关右上角区域的（浮动面板的关闭按钮）
          if (r.right > window.innerWidth - 100 && r.top < 300 && r.top > 50) {
            el.click();
            return true;
          }
        }
      }
      // 另一种：找 aria-label 包含关闭
      const btns = document.querySelectorAll('button[aria-label*="关闭"], button[aria-label*="close"]');
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (r.right > window.innerWidth - 100 && r.top < 300) {
          b.click();
          return true;
        }
      }
      return false;
    });
    if (closed) await wait(300);
  };
  
  // 通过卡片索引点击工作台卡片
  const clickCardByIndex = async (index) => {
    return page.evaluate(i => {
      const cards = document.querySelectorAll('.campus-zone-hotspot');
      if (cards[i]) { cards[i].click(); return true; }
      return false;
    }, index);
  };
  
  // 点击顶部标签
  const clickTab = async (label) => {
    return page.evaluate(l => {
      const all = document.querySelectorAll('header button, header div[role="button"], header span');
      for (const el of all) {
        if (el.textContent && el.textContent.trim() === l && el.getBoundingClientRect().top < 60) {
          const clickable = el.closest('button, div[role="button"], div[onclick], div.cursor-pointer');
          if (clickable) { clickable.click(); return true; }
          el.click(); return true;
        }
      }
      return false;
    }, label);
  };
  
  // 回到工作台
  const goHome = async () => {
    await clickTab('工作台');
    await wait(1200);
    await closeAssistant();
  };
  
  // 截图
  const shot = async (name) => {
    await wait(500);
    await closeAssistant();
    await wait(200);
    await page.screenshot({ path: path.join(OUT_DIR, name) });
    console.log(`截图: ${name.replace('.png','')}`);
  };
  
  // 点击包含指定文本的按钮
  const clickBtn = async (text) => {
    return page.evaluate(t => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent && b.textContent.includes(t) && b.getBoundingClientRect().width > 0) {
          b.click(); return true;
        }
      }
      return false;
    }, text);
  };
  
  // ========== 未登录页面 ==========
  console.log('=== 未登录页面 ===');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await wait(1500);
  await shot('01_首页.png');
  
  await clickBtn('登录');
  await wait(1500);
  await shot('02_登录页.png');
  
  await clickBtn('注册');
  await wait(1500);
  await shot('03_注册页.png');
  
  // ========== 学生端 ==========
  console.log('\n=== 学生端 ===');
  const stu = await auth('student_demo', '123456', 'student');
  await injectAndLoad(stu.user, stu.token);
  await shot('04_学生工作台.png');
  
  // 卡片顺序：0:AIGC生成 1:知识图谱 2:学习路径 3:相关学习资源
  await clickCardByIndex(1); // 知识图谱
  await wait(2000);
  await shot('05_知识图谱页.png');
  
  // 智能问答 - 点击顶部"问答"按钮
  await clickBtn('问答');
  await wait(2000);
  await shot('06_智能问答页.png');
  
  await goHome();
  await clickCardByIndex(2); // 学习路径
  await wait(2000);
  await shot('07_学习路径页.png');
  
  // 详细学习 - 点击"去学"按钮
  await clickBtn('去学');
  await wait(2000);
  await shot('08_详细学习页.png');
  
  // 知识小测验 - 从详细学习页点"开始本节测试"
  const quizFromLearn = await clickBtn('本节测试');
  if (!quizFromLearn) {
    // 兜底：从学习路径点"去测试"
    await goHome();
    await clickCardByIndex(2);
    await wait(1500);
    await clickBtn('去测试');
  }
  await wait(2000);
  await shot('09_知识小测验.png');
  
  await goHome();
  await clickCardByIndex(3); // 相关学习资源
  await wait(2000);
  await shot('10_学习资源页.png');
  
  // 访客中心 - 点击用户菜单
  await goHome();
  await page.evaluate(() => {
    const headerBtns = document.querySelectorAll('header button');
    for (let i = headerBtns.length - 1; i >= 0; i--) {
      const b = headerBtns[i];
      const r = b.getBoundingClientRect();
      if (r.width > 40 && r.right > window.innerWidth - 200) {
        b.click(); break;
      }
    }
  });
  await wait(500);
  await page.evaluate(() => {
    const all = document.querySelectorAll('div, button');
    for (const el of all) {
      if (el.textContent && el.textContent.trim() === '访客中心' && el.getBoundingClientRect().width < 300 && el.getBoundingClientRect().top > 50) {
        el.click(); return;
      }
    }
  });
  await wait(1500);
  await shot('11_访客中心.png');
  
  // ========== 教师端 ==========
  console.log('\n=== 教师端 ===');
  const tea = await auth('teacher_demo', '123456', 'teacher');
  await injectAndLoad(tea.user, tea.token);
  await shot('12_教师工作台.png');
  
  // 教师端卡片：0:文档上传 1:AIGC生成 2:知识图谱
  await clickCardByIndex(0);
  await wait(2000);
  await shot('13_文档上传页.png');
  
  await clickCardByIndex(1);
  await wait(2000);
  await shot('14_AIGC生成页.png');
  
  await clickCardByIndex(2); // 知识图谱
  await wait(2500);
  // 点击"编辑图谱"进入编辑模式
  await clickBtn('编辑图谱');
  await wait(1500);
  await shot('15_图谱编辑页.png');
  
  await browser.close();
  console.log('\n完成！');
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`共 ${files.length} 张:`);
  files.forEach(f => console.log(`  ${f}`));
}

main().catch(e => { console.error(e); process.exit(1); });
