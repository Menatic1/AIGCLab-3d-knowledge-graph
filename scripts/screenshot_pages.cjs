// 系统截图 v4 - 通过 TabContext 直接打开各标签页
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
  
  // 注入 token 并等待页面就绪
  const injectAndLoad = async (user, token) => {
    await page.evaluate((u, t) => {
      localStorage.setItem('aigc_auth_token', t);
      localStorage.setItem('aigc_auth_user', JSON.stringify(u));
    }, user, token);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
  };
  
  // 通过 TabContext 打开标签
  const openTabByKind = async (kind) => {
    return page.evaluate(k => {
      // 触发自定义事件打开标签
      const event = new CustomEvent('openTab', { detail: k });
      window.dispatchEvent(event);
      // 也尝试直接调用全局方法
      if (window.__openTab) window.__openTab(k);
      return true;
    }, kind);
  };
  
  // 先给 window 注入 openTab 钩子
  await page.exposeFunction('__openTabExternal', () => {});
  
  // ========== 未登录页面 ==========
  console.log('=== 未登录页面 ===');
  const publicPages = [
    { name: '01_首页', path: '/' },
    { name: '02_登录页', path: '/login' },
    { name: '03_注册页', path: '/register' },
  ];
  for (const p of publicPages) {
    console.log(`截图: ${p.name}`);
    await page.goto(BASE_URL + p.path, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    await page.screenshot({ path: path.join(OUT_DIR, `${p.name}.png`) });
  }
  
  // ========== 学生端 ==========
  console.log('\n=== 学生端 ===');
  const stu = await auth('student_demo', '123456', 'student');
  console.log('用户:', stu.user?.username);
  
  await injectAndLoad(stu.user, stu.token);
  
  // 先截图工作台
  console.log('截图: 04_学生工作台');
  await page.screenshot({ path: path.join(OUT_DIR, '04_学生工作台.png') });
  
  // 通过点击功能建筑模块的卡片打开各标签
  // 从截图看卡片有"AIGC生成图谱""知识图谱""学习路径""相关学习资源"
  const studentCards = [
    { name: '05_知识图谱页', text: '知识图谱', wait: 2500 },
    { name: '06_智能问答页', text: 'AI 助教', wait: 1500 },
    { name: '07_学习路径页', text: '学习路径', wait: 1500 },
    { name: '08_详细学习页', text: '详细学习', wait: 1500 },
    { name: '09_知识小测验', text: '知识测验', wait: 1500 },
    { name: '10_学习资源页', text: '相关学习资源', wait: 1500 },
    { name: '11_访客中心', text: '访客中心', wait: 1500 },
  ];
  
  for (const card of studentCards) {
    console.log(`截图: ${card.name}`);
    try {
      // 点击包含指定文本的卡片
      const clicked = await page.evaluate(t => {
        // 找所有可能的可点击元素
        const selectors = ['.campus-card', '.building-card', '[role="button"]', 'button', 'a', 'div[class*="card"]', 'div[class*="Card"]'];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (el.textContent && el.textContent.includes(t)) {
              el.click();
              return true;
            }
          }
        }
        // 兜底：找所有有点击事件的 div
        const allDivs = document.querySelectorAll('div');
        for (const d of allDivs) {
          if (d.textContent && d.textContent.includes(t) && d.getBoundingClientRect().width > 50) {
            d.click();
            return true;
          }
        }
        return false;
      }, card.text);
      
      await wait(card.wait || 1500);
      await page.screenshot({ path: path.join(OUT_DIR, `${card.name}.png`) });
      
      // 返回工作台（点击工作台标签）
      await page.evaluate(() => {
        const spans = document.querySelectorAll('header span');
        for (const s of spans) {
          if (s.textContent && s.textContent.trim() === '工作台') {
            s.closest('div')?.click();
            return;
          }
        }
      });
      await wait(800);
    } catch (e) {
      console.log(`  失败: ${e.message}`);
    }
  }
  
  // ========== 教师端 ==========
  console.log('\n=== 教师端 ===');
  const tea = await auth('teacher_demo', '123456', 'teacher');
  console.log('用户:', tea.user?.username);
  
  await injectAndLoad(tea.user, tea.token);
  
  console.log('截图: 12_教师工作台');
  await page.screenshot({ path: path.join(OUT_DIR, '12_教师工作台.png') });
  
  const teacherCards = [
    { name: '13_文档上传页', text: '文档上传', wait: 1500 },
    { name: '14_AIGC生成页', text: 'AIGC 生成图谱', wait: 1500 },
    { name: '15_图谱编辑页', text: '知识图谱', wait: 2500 },
  ];
  
  for (const card of teacherCards) {
    console.log(`截图: ${card.name}`);
    try {
      const clicked = await page.evaluate(t => {
        const selectors = ['div[class*="card"]', 'div[class*="Card"]', 'button', 'a', '[role="button"]'];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (el.textContent && el.textContent.includes(t)) {
              el.click();
              return true;
            }
          }
        }
        return false;
      }, card.text);
      
      await wait(card.wait || 1500);
      await page.screenshot({ path: path.join(OUT_DIR, `${card.name}.png`) });
      
      // 返回工作台
      await page.evaluate(() => {
        const spans = document.querySelectorAll('header span');
        for (const s of spans) {
          if (s.textContent && s.textContent.trim() === '工作台') {
            s.closest('div')?.click();
            return;
          }
        }
      });
      await wait(800);
    } catch (e) {
      console.log(`  失败: ${e.message}`);
    }
  }
  
  await browser.close();
  console.log('\n完成！');
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`\n共 ${files.length} 张截图:`);
  files.forEach(f => console.log(`  ${f}`));
}

main().catch(e => { console.error(e); process.exit(1); });
