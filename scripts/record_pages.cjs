/**
 * 前端页面录制脚本
 * - 使用 CDP Page.startScreencast 录制各场景视频片段（mp4）
 * - 同步输出高清页面截图（png）
 * 输出：赛题10_.../S3/演示素材/{视频,截图}
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
const TMP_DIR = path.join(os.tmpdir(), 'zqql_record');

const BASE_URL = 'http://localhost:5174';
const API_BASE = 'http://localhost:8000';
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

async function auth(username, password, role) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('登录失败');
  return await res.json();
}

// ── 录屏器（Puppeteer 原生 screencast → webm → H.264 mp4）──
class Recorder {
  constructor(page) {
    this.page = page;
    this.rec = null;
    this.tmp = null;
  }
  async start() {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    this.tmp = path.join(TMP_DIR, `rec_${Date.now()}.webm`);
    this.rec = await this.page.screencast({
      path: this.tmp,
      ffmpegPath: FFMPEG,
      fps: 25,
      quality: 32,
    });
  }
  async stop(name) {
    if (!this.rec) return null;
    try { await this.rec.stop(); } catch (e) {}
    this.rec = null;
    if (!this.tmp || !fs.existsSync(this.tmp) || fs.statSync(this.tmp).size < 1000) {
      console.log(`  ! ${name} 录制文件为空`);
      return null;
    }
    const outPath = path.join(VID_DIR, `${name}.mp4`);
    try {
      execFileSync(FFMPEG, [
        '-y', '-i', this.tmp,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '-an', outPath,
      ], { stdio: 'pipe' });
      const mb = (fs.statSync(outPath).size / 1048576).toFixed(1);
      console.log(`  ✓ ${name}.mp4  (${mb}MB)`);
    } catch (e) {
      console.log(`  ! 转码失败: ${e.message}`);
    }
    try { fs.rmSync(this.tmp, { force: true }); } catch (e) {}
    return outPath;
  }
}

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
  const rec = new Recorder(page);

  // ── 工具函数 ──
  const shot = async (name) => {
    await wait(400);
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
  };

  const closeAssistant = async () => {
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="关闭 AI 助教"]');
      if (btn) { btn.click(); return; }
      const all = document.querySelectorAll('button');
      for (const b of all) {
        const t = (b.textContent || '').trim();
        if (t === '×' || t === '✕') {
          const r = b.getBoundingClientRect();
          if (r.width > 0 && r.right > window.innerWidth - 120) b.click();
        }
      }
    });
    await wait(250);
  };

  const clickText = (text, sel = 'button') => page.evaluate((t, s) => {
    const els = document.querySelectorAll(s);
    for (const el of els) {
      if ((el.textContent || '').trim().includes(t)) { el.click(); return true; }
    }
    return false;
  }, text, sel);

  // 点击顶部标签页（标签是 div，不是 button）
  const clickTab = (label) => page.evaluate(l => {
    const spans = document.querySelectorAll('header span');
    for (const s of spans) {
      if ((s.textContent || '').trim() === l) {
        const tab = s.closest('div[class*="cursor-pointer"]') || s.parentElement;
        if (tab) { tab.click(); return true; }
      }
    }
    return false;
  }, label);

  // 读取当前激活的标签页标题
  const activeTab = () => page.evaluate(() => {
    const divs = document.querySelectorAll('header div[class*="cursor-pointer"]');
    for (const d of divs) {
      if (d.style && d.style.boxShadow) {
        const s = d.querySelector('span');
        if (s) return s.textContent.trim();
      }
    }
    return null;
  });

  // 通过标题点击工作台功能卡片
  const openCard = async (title) => {
    const ok = await page.evaluate(t => {
      const cards = document.querySelectorAll('.campus-zone-hotspot');
      for (const c of cards) {
        if ((c.textContent || '').includes(t)) { c.click(); return true; }
      }
      return false;
    }, title);
    if (!ok) { console.log(`    ! 未找到功能卡「${title}」`); return false; }
    await wait(1200);
    const cur = await activeTab();
    console.log(`    → 打开「${title}」｜当前标签: ${cur}`);
    return true;
  };

  const goHome = async () => {
    for (let i = 0; i < 3; i++) {
      await clickTab('工作台');
      await wait(900);
      const cur = await activeTab();
      if (cur === '工作台') break;
    }
    await closeAssistant();
  };

  const smoothScroll = async (toY, ms) => {
    await page.evaluate((target, dur) => new Promise(res => {
      const start = window.scrollY;
      const dist = target - start;
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        window.scrollTo(0, start + dist * e);
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    }), toY, ms);
  };

  const injectAndLoad = async (user, token) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(1200);
    await page.evaluate((u, t) => {
      localStorage.setItem('aigc_auth_token', t);
      localStorage.setItem('aigc_auth_user', JSON.stringify(u));
    }, user, token);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(3200);
  };

  const runScene = async (name, action) => {
    console.log(`\n▶ 录制 ${name}`);
    await rec.start();
    try { await action(); } catch (e) { console.log(`  ! 场景动作异常: ${e.message}`); }
    await rec.stop(name);
  };

  // ══════════ 场景 1：首页 ══════════
  await runScene('01_首页', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(2600);
    await shot('01_首页');
    await smoothScroll(900, 2600); await wait(1600);
    await smoothScroll(1900, 2600); await wait(1600);
    await smoothScroll(3000, 2600); await wait(1800);
    await smoothScroll(4200, 2800); await wait(1800);
    await smoothScroll(5600, 2800); await wait(1600);
    await smoothScroll(0, 1400); await wait(900);
  });

  // ══════════ 场景 2：登录 / 注册 ══════════
  await runScene('02_登录注册', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(2200);
    await clickText('登录', 'button, a');
    await wait(2000);
    await shot('02_登录页');
    // 输入动画
    await page.evaluate(() => {
      const inp = document.querySelector('input');
      if (inp) inp.focus();
    });
    await page.keyboard.type('teacher_demo', { delay: 90 });
    await wait(700);
    await page.evaluate(() => {
      const inps = document.querySelectorAll('input');
      if (inps[1]) inps[1].focus();
    });
    await page.keyboard.type('123456', { delay: 110 });
    await wait(1200);
    await clickText('注册', 'button, a');
    await wait(2000);
    await shot('03_注册页');
    await wait(1500);
  });

  // ══════════ 场景 3：教师端流程 ══════════
  await runScene('03_教师端流程', async () => {
    const tea = await auth('teacher_demo', '123456', 'teacher');
    await injectAndLoad(tea.user, tea.token);
    await closeAssistant();
    await shot('12_教师工作台');
    await wait(2600);                       // 展示工作台概览

    await openCard('文档上传');
    await wait(2600);
    await closeAssistant();
    await shot('13_文档上传页');
    // 展示上传区交互
    await page.evaluate(() => {
      const zone = document.querySelector('[class*="drop"], [class*="upload"], input[type="file"]');
      if (zone) zone.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    await wait(3000);

    await goHome();
    await openCard('AIGC 生成图谱');
    await wait(2600);
    await closeAssistant();
    await shot('14_AIGC生成页');
    // 输入主题
    await page.evaluate(() => {
      const inp = document.querySelector('input[type="text"], textarea');
      if (inp) inp.focus();
    });
    await page.keyboard.type('数据结构与算法', { delay: 80 });
    await wait(3200);

    await goHome();
    await openCard('知识图谱');
    await wait(3000);
    await closeAssistant();
    await shot('15_图谱编辑页');
    // 进入编辑模式
    await clickText('编辑图谱');
    await wait(3200);
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        for (const [dx, dy] of [[0, 0], [120, -60], [-90, 80]]) {
          canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true }));
        }
      }
    });
    await wait(3000);
  });

  // ══════════ 场景 4：学生端图谱 ══════════
  await runScene('04_学生端图谱', async () => {
    const stu = await auth('student_demo', '123456', 'student');
    await injectAndLoad(stu.user, stu.token);
    await closeAssistant();
    await shot('04_学生工作台');
    await wait(4200);                       // 3D 校园模型旋转

    await openCard('知识图谱');
    await wait(3600);
    await closeAssistant();
    await shot('05_知识图谱页');
    // 图谱交互：平移 / 缩放 / 旋转
    const canvasBox = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    });
    if (canvasBox) {
      // 拖拽平移
      await page.mouse.move(canvasBox.x, canvasBox.y);
      await page.mouse.down();
      for (let i = 1; i <= 18; i++) {
        await page.mouse.move(canvasBox.x - i * 7, canvasBox.y - i * 3);
        await wait(45);
      }
      await page.mouse.up();
      await wait(900);
      // 滚轮缩放
      for (let i = 0; i < 5; i++) { await page.mouse.wheel({ deltaY: -110 }); await wait(220); }
      await wait(700);
      for (let i = 0; i < 3; i++) { await page.mouse.wheel({ deltaY: 110 }); await wait(220); }
      await wait(700);
      // 点击中心节点
      await page.mouse.click(canvasBox.x, canvasBox.y);
      await wait(500);
      await page.mouse.click(canvasBox.x + 40, canvasBox.y - 30);
      await wait(2800);
    }
  });

  // ══════════ 场景 5：学生端学习 ══════════
  await runScene('05_学生端学习', async () => {
    // 智能问答
    await goHome();
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="打开 AI 答疑助手"]');
      if (btn) btn.click();
    });
    await wait(2000);
    await shot('06_智能问答页');
    await page.evaluate(() => {
      const inp = document.querySelector('textarea, input[type="text"]');
      if (inp) inp.focus();
    });
    await page.keyboard.type('什么是最短路径算法？', { delay: 75 });
    await wait(900);
    await page.keyboard.press('Enter');
    await wait(4200);                        // 等待流式回答
    await closeAssistant();
    await wait(900);

    // 学习路径
    await goHome();
    await openCard('学习路径');
    await wait(3200);
    await closeAssistant();
    await shot('07_学习路径页');
    await clickText('去学习');
    await wait(3200);
    await shot('08_详细学习页');
    await wait(1600);

    // 小测验
    await clickText('测验');
    await wait(2600);
    await closeAssistant();
    await shot('09_知识小测验');
    await wait(2400);

    // 学习资源
    await goHome();
    await openCard('相关学习资源');
    await wait(2800);
    await closeAssistant();
    await shot('10_学习资源页');
    await wait(2400);
  });

  // ══════════ 场景 6：学习报告 ══════════
  await runScene('06_学习报告', async () => {
    await goHome();
    // 通过头部「访客中心」按钮进入
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="打开访客中心"]');
      if (btn) btn.click();
    });
    await wait(2600);
    await closeAssistant();
    await shot('11_访客中心');
    await wait(3400);
    await smoothScroll(700, 2200);
    await wait(2000);
  });

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  console.log('\n══════ 录制完成 ══════');
  console.log('视频:');
  fs.readdirSync(VID_DIR).sort().forEach(f => {
    const mb = (fs.statSync(path.join(VID_DIR, f)).size / 1048576).toFixed(1);
    console.log(`  ${f}  (${mb}MB)`);
  });
  console.log('截图:');
  fs.readdirSync(SHOT_DIR).sort().forEach(f => console.log(`  ${f}`));
})().catch(e => { console.error(e); process.exit(1); });