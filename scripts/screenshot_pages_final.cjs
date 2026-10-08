// 系统截图 v6 - 完整修复：关闭AI助教、正确打开各页面、教师端编辑模式
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
  
  // 先访问页面（让 localStorage 可用），注入 token，再刷新
  const injectAndLoad = async (user, token) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.evaluate((u, t) => {
      localStorage.setItem('aigc_auth_token', t);
      localStorage.setItem('aigc_auth_user', JSON.stringify(u));
    }, user, token);
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(2500);
  };
  
  // 关闭 AI 助教浮动面板（如果打开）
  const closeAssistant = async () => {
    await page.evaluate(() => {
      // 找面板右上角的关闭按钮（X）
      const closeBtns = document.querySelectorAll('button');
      for (const btn of closeBtns) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.right > window.innerWidth - 400 && rect.top < 200) {
          // 检查是否是关闭按钮
          if (btn.textContent === '' || btn.getAttribute('aria-label')?.includes('关闭')) {
            btn.click();
          }
        }
      }
      // 另一种方式：找 × 符号的按钮
      const allBtns = document.querySelectorAll('button, div[role="button"]');
      for (const b of allBtns) {
        if (b.textContent && b.textContent.trim() === '×') {
          const r = b.getBoundingClientRect();
          if (r.right > window.innerWidth - 100 && r.top < 300) b.click();
        }
      }
    });
    await wait(300);
  };
  
  // 通过卡片索引点击（学生工作台有4个卡片）
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
      // 找 header 里的标签
      const allBtns = document.querySelectorAll('header button, header div[role="button"]');
      for (const b of allBtns) {
        if (b.textContent && b.textContent.trim() === l) {
          b.click();
          return true;
        }
      }
      return false;
    }, label);
  };
  
  // 回到工作台（点击"工作台"标签）
  const goHome = async () => {
    await clickTab('工作台');
    await wait(1000);
    await closeAssistant();
  };
  
  // 截图工具
  const shot = async (name) => {
    await wait(500);
    await page.screenshot({ path: path.join(OUT_DIR, name) });
    console.log(`截图: ${name.replace('.png','')}`);
  };
  
  // ========== 未登录页面 ==========
  console.log('=== 未登录页面 ===');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await wait(1500);
  await shot('01_首页.png');
  
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a');
    for (const b of btns) {
      if (b.textContent && b.textContent.includes('登录')) { b.click(); return; }
    }
  });
  await wait(1500);
  await shot('02_登录页.png');
  
  await page.evaluate(() => {
    const links = document.querySelectorAll('a, button');
    for (const l of links) {
      if (l.textContent && l.textContent.includes('注册')) { l.click(); return; }
    }
  });
  await wait(1500);
  await shot('03_注册页.png');
  
  // ========== 学生端 ==========
  console.log('\n=== 学生端 ===');
  const stu = await auth('student_demo', '123456', 'student');
  await injectAndLoad(stu.user, stu.token);
  await closeAssistant();
  await shot('04_学生工作台.png');
  
  // 卡片0: AIGC 生成图谱  卡片1: 知识图谱  卡片2: 学习路径  卡片3: 相关学习资源
  await clickCardByIndex(1); // 知识图谱
  await wait(2000);
  await closeAssistant();
  await shot('05_知识图谱页.png');
  
  // 智能问答 - 点击右下角浮动按钮后截图
  await goHome();
  await page.evaluate(() => {
    // 找右下角浮动按钮
    const allBtns = document.querySelectorAll('button, div[role="button"]');
    for (const b of allBtns) {
      const r = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      if (r.width > 40 && r.right > window.innerWidth - 80 && r.bottom > window.innerHeight - 80 && style.position === 'fixed') {
        b.click(); return true;
      }
    }
    return false;
  });
  await wait(1500);
  await shot('06_智能问答页.png');
  // 关闭后再继续
  await closeAssistant();
  
  await goHome();
  await clickCardByIndex(2); // 学习路径
  await wait(2000);
  await closeAssistant();
  await shot('07_学习路径页.png');
  
  await goHome();
  // 详细学习 - 从知识图谱点击节点，或者直接用 openTab
  // 先试试从学习路径里点"去学习"
  await clickCardByIndex(2); // 学习路径
  await wait(1500);
  const learnClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent && b.textContent.includes('去学习')) {
        b.click(); return true;
      }
    }
    return false;
  });
  if (!learnClicked) {
    // 兜底：点击知识图谱节点
    await clickTab('知识图谱');
    await wait(1000);
    await page.evaluate(() => {
      // 点击第一个节点（g6 canvas 上的节点可能无法直接 DOM 点击）
      // 试试用 dispatchEvent 模拟点击 canvas 中心
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('click', {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          bubbles: true
        }));
      }
    });
    await wait(1000);
  }
  await closeAssistant();
  await shot('08_详细学习页.png');
  
  // 知识小测试
  await goHome();
  // 学生端工作台只有4个卡片，知识测验可能在其他地方
  // 试试从详细学习页找测验入口，或者从学习路径找"去测试"
  await clickCardByIndex(2); // 学习路径
  await wait(1500);
  const quizClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent && (b.textContent.includes('去测试') || b.textContent.includes('开始测验'))) {
        b.click(); return true;
      }
    }
    return false;
  });
  if (!quizClicked) {
    // 试试点击详细学习里的测验
    await goHome();
    await clickCardByIndex(1); // 知识图谱
    await wait(1500);
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent && b.textContent.includes('测验')) {
          b.click(); return true;
        }
      }
      return false;
    });
  }
  await wait(1500);
  await closeAssistant();
  await shot('09_知识小测验.png');
  
  await goHome();
  await clickCardByIndex(3); // 相关学习资源
  await wait(2000);
  await closeAssistant();
  await shot('10_学习资源页.png');
  
  // 访客中心 - 从头像菜单
  await goHome();
  await page.evaluate(() => {
    // 点击右上角用户头像按钮
    const headerBtns = document.querySelectorAll('header button');
    // 通常最后一个是用户菜单
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
    // 找菜单里的"访客中心"
    const all = document.querySelectorAll('div, button');
    for (const el of all) {
      if (el.textContent && el.textContent.trim() === '访客中心' && el.getBoundingClientRect().width < 300) {
        el.click(); return;
      }
    }
  });
  await wait(1500);
  await closeAssistant();
  await shot('11_访客中心.png');
  
  // ========== 教师端 ==========
  console.log('\n=== 教师端 ===');
  const tea = await auth('teacher_demo', '123456', 'teacher');
  await injectAndLoad(tea.user, tea.token);
  await closeAssistant();
  await shot('12_教师工作台.png');
  
  // 教师端工作台卡片：文档上传、AIGC生成、知识图谱/编辑
  await clickCardByIndex(0); // 文档上传（第一个）
  await wait(2000);
  await closeAssistant();
  await shot('13_文档上传页.png');
  
  await clickCardByIndex(1); // AIGC生成（第二个）
  await wait(2000);
  await closeAssistant();
  await shot('14_AIGC生成页.png');
  
  await clickCardByIndex(2); // 知识图谱（第三个）
  await wait(2500);
  // 点击"编辑图谱"按钮进入编辑模式
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent && b.textContent.includes('编辑图谱')) {
        b.click(); return true;
      }
    }
    return false;
  });
  await wait(1500);
  await closeAssistant();
  await shot('15_图谱编辑页.png');
  
  await browser.close();
  console.log('\n完成！');
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`共 ${files.length} 张:`);
  files.forEach(f => console.log(`  ${f}`));
}

main().catch(e => { console.error(e); process.exit(1); });
