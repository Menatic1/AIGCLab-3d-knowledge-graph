/**
 * 补录脚本：修正场景 3（教师端流程）、场景 5（学生端学习）、场景 6（学习报告）
 * 修正点：
 *   1) 教师工作台先选课程 → 展示「课程建设概览」面板
 *   2) 图谱编辑页在点击「编辑图谱」之后截图
 *   3) 学习路径 → 「去学」进入详细学习、「去测试」进入知识小测验
 *   4) 学习资源页先选中一个知识点
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
const TMP_DIR = path.join(os.tmpdir(), 'zqql_fix');

const BASE_URL = 'http://localhost:5174';
const API_BASE = 'http://localhost:8000';
const VW = 1600, VH = 900;
const COURSE_ID = 1;          // 计算机网络（含 38 节点 / 39 关系）
const COURSE_NAME = '计算机网络';

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

// 录屏器
class Recorder {
  constructor(page) { this.page = page; this.rec = null; this.tmp = null; }
  async start() {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    this.tmp = path.join(TMP_DIR, `rec_${Date.now()}.webm`);
    this.rec = await this.page.screencast({ path: this.tmp, ffmpegPath: FFMPEG, fps: 25, quality: 32 });
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
      console.log(`  ✓ ${name}.mp4  (${(fs.statSync(outPath).size / 1048576).toFixed(1)}MB)`);
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

  // 前置：让 teacher_demo 加入「计算机网络」课程，使教师端概览面板有真实数据
  const tea = await auth('teacher_demo', '123456', 'teacher');
  const stu = await auth('student_demo', '123456', 'student');
  try {
    const res = await fetch(`${API_BASE}/api/courses/${COURSE_ID}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tea.token}` },
    });
    const j = await res.json();
    console.log(`前置：teacher_demo 加入课程 → ${j?.course?.name ?? '?'} (already=${j?.already_member})`);
  } catch (e) {
    console.log(`前置：加入课程失败 ${e.message}`);
  }

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: VW, height: VH },
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  const rec = new Recorder(page);

  const shot = async (name) => {
    await wait(400);
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
    console.log(`  · 截图 ${name}.png`);
  };

  const clickText = (text, sel = 'button, a') => page.evaluate((t, s) => {
    const els = document.querySelectorAll(s);
    for (const el of els) {
      if ((el.textContent || '').trim().includes(t)) { el.click(); return true; }
    }
    return false;
  }, text, sel);

  const clickExact = (text, sel = 'button') => page.evaluate((t, s) => {
    const els = document.querySelectorAll(s);
    for (const el of els) {
      if ((el.textContent || '').trim() === t) { el.click(); return true; }
    }
    return false;
  }, text, sel);

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
    console.log(`    → 打开「${title}」｜当前标签: ${await activeTab()}`);
    return true;
  };

  const closeAssistant = async () => {
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="关闭 AI 助教"]');
      if (btn) { btn.click(); return; }
    });
    await wait(250);
  };

  const goHome = async () => {
    for (let i = 0; i < 3; i++) {
      await clickTab('工作台');
      await wait(900);
      if (await activeTab() === '工作台') break;
    }
    await closeAssistant();
  };

  // 打开顶部课程选择器并选中某门课程
  const selectCourse = async (name) => {
    const opened = await page.evaluate(() => {
      const btns = document.querySelectorAll('button[title="切换课程"]');
      if (btns[0]) { btns[0].click(); return true; }
      return false;
    });
    if (!opened) { console.log('    ! 未找到课程选择器'); return false; }
    await wait(900);
    const picked = await page.evaluate(n => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if ((b.textContent || '').includes(n)) { b.click(); return true; }
      }
      return false;
    }, name);
    console.log(picked ? `    → 切换课程「${name}」` : `    ! 未找到课程「${name}」`);
    await wait(2600);
    return picked;
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

  // ══════════ 场景 3：教师端流程 ══════════
  await runScene('03_教师端流程', async () => {
    await injectAndLoad(tea.user, tea.token);
    await closeAssistant();

    // 3.1 工作台 + 课程建设概览
    await selectCourse(COURSE_NAME);
    await shot('12_教师工作台');
    await wait(3000);

    // 切回「全部课程」以便展示完整图谱
    await selectCourse('全部课程');
    await wait(1200);

    // 3.2 文档上传
    await openCard('文档上传');
    await wait(2400);
    await closeAssistant();
    await shot('13_文档上传页');
    await page.evaluate(() => {
      const zone = document.querySelector('[class*="drop"], [class*="upload"], input[type="file"]');
      if (zone) zone.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    await wait(2600);

    // 3.3 AIGC 生成
    await goHome();
    await openCard('AIGC 生成图谱');
    await wait(2400);
    await closeAssistant();
    await shot('14_AIGC生成页');
    await page.evaluate(() => {
      const inp = document.querySelector('input[type="text"], textarea');
      if (inp) inp.focus();
    });
    await page.keyboard.type('数据结构与算法', { delay: 80 });
    await wait(2600);

    // 3.4 图谱编辑（点击「编辑图谱」后再截图）
    await goHome();
    await openCard('知识图谱');
    await wait(3000);
    await closeAssistant();
    console.log('    → 点击「编辑图谱」');
    await clickText('编辑图谱');
    await wait(3200);
    await shot('15_图谱编辑页');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        for (const [dx, dy] of [[0, 0], [120, -60], [-90, 80]]) {
          canvas.dispatchEvent(new MouseEvent('mousemove', {
            clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy, bubbles: true,
          }));
        }
      }
    });
    await wait(2800);
  });

  // ══════════ 场景 5：学生端学习 ══════════
  await runScene('05_学生端学习', async () => {
    await injectAndLoad(stu.user, stu.token);
    await closeAssistant();

    // 5.1 智能问答
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
    await wait(4200);
    await closeAssistant();
    await wait(900);

    // 5.2 学习路径
    await goHome();
    await openCard('学习路径');
    await wait(3000);
    await closeAssistant();
    await shot('07_学习路径页');

    // 5.3 去学 → 详细学习
    console.log('    → 点击「去学」');
    await clickExact('去学');
    await wait(3400);
    await closeAssistant();
    await shot('08_详细学习页');
    await wait(2000);

    // 5.4 去测试 → 知识小测验
    await clickTab('学习路径');
    await wait(2200);
    console.log('    → 点击「去测试」');
    await clickText('去测试');
    await wait(3000);
    await closeAssistant();
    await shot('09_知识小测验');
    await wait(2400);

    // 5.5 相关学习资源（选中一个知识点）
    await goHome();
    await openCard('相关学习资源');
    await wait(2600);
    await closeAssistant();
    console.log('    → 选中知识点「TCP 协议」');
    await clickExact('TCP 协议');
    await wait(2600);
    await shot('10_学习资源页');
    await wait(2200);
  });

  // ══════════ 场景 6：学习报告 ══════════
  await runScene('06_学习报告', async () => {
    await goHome();
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="打开访客中心"]');
      if (btn) btn.click();
    });
    await wait(2600);
    await closeAssistant();
    await shot('11_访客中心');
    await wait(3200);
    await page.evaluate(() => new Promise(res => {
      const start = window.scrollY, target = 700, dur = 2200, t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        window.scrollTo(0, start + (target - start) * e);
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    }));
    await wait(2000);
  });

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('\n══════ 补录完成 ══════');
})().catch(e => { console.error(e); process.exit(1); });