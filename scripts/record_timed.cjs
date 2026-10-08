/**
 * 按旁白节奏录制演示素材
 * - 每段素材单独录制，时长 = 该段在成片中需要的时长 + 余量
 * - 输出到 演示素材/视频_timed/
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx', '668c188756b835f3', 'node_modules', 'puppeteer-core'));

const ROOT = path.resolve(__dirname, '..');
const OUT_BASE = path.join(ROOT, '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S3', '演示素材');
const VID_DIR = path.join(OUT_BASE, '视频_timed');
const SHOT_DIR = path.join(OUT_BASE, '截图');
const TMP_DIR = path.join(os.tmpdir(), 'zqql_timed');

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
const only = process.argv.slice(2);

async function auth(username, password, role) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('登录失败');
  return await res.json();
}

class Recorder {
  constructor(page) { this.page = page; this.rec = null; this.tmp = null; }
  async start() {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    this.tmp = path.join(TMP_DIR, `rec_${Date.now()}_${Math.floor(Math.random() * 1e5)}.webm`);
    this.rec = await this.page.screencast({ path: this.tmp, ffmpegPath: FFMPEG, fps: 25, quality: 30 });
  }
  async stop(name) {
    if (!this.rec) return null;
    try { await this.rec.stop(); } catch (e) {}
    this.rec = null;
    if (!this.tmp || !fs.existsSync(this.tmp) || fs.statSync(this.tmp).size < 2000) {
      console.log(`  ! ${name} 录制文件为空`);
      return null;
    }
    const outPath = path.join(VID_DIR, `${name}.mp4`);
    execFileSync(FFMPEG, [
      '-y', '-v', 'error', '-i', this.tmp,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outPath,
    ], { stdio: 'pipe' });
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
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'],
  });
  const page = await browser.newPage();
  const rec = new Recorder(page);

  // ══════════ 工具 ══════════
  const closeAssistant = async () => {
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="关闭 AI 助教"]');
      if (btn) { btn.click(); return; }
      for (const b of document.querySelectorAll('button')) {
        const t = (b.textContent || '').trim();
        if (t === '×' || t === '✕') {
          const r = b.getBoundingClientRect();
          if (r.width > 0 && r.right > window.innerWidth - 120) b.click();
        }
      }
    });
    await wait(300);
  };

  const clickText = (text, sel = 'button') => page.evaluate((t, s) => {
    for (const el of document.querySelectorAll(s)) {
      if ((el.textContent || '').trim().includes(t)) { el.click(); return true; }
    }
    return false;
  }, text, sel);

  const clickTab = (label) => page.evaluate(l => {
    for (const s of document.querySelectorAll('header span')) {
      if ((s.textContent || '').trim() === l) {
        const tab = s.closest('div[class*="cursor-pointer"]') || s.parentElement;
        if (tab) { tab.click(); return true; }
      }
    }
    return false;
  }, label);

  const activeTab = () => page.evaluate(() => {
    for (const d of document.querySelectorAll('header div[class*="cursor-pointer"]')) {
      if (d.style && d.style.boxShadow) {
        const s = d.querySelector('span');
        if (s) return s.textContent.trim();
      }
    }
    return null;
  });

  const openCard = async (title) => {
    const ok = await page.evaluate(t => {
      for (const c of document.querySelectorAll('.campus-zone-hotspot')) {
        if ((c.textContent || '').includes(t)) { c.click(); return true; }
      }
      return false;
    }, title);
    if (!ok) { console.log(`    ! 未找到功能卡「${title}」`); return false; }
    await wait(1400);
    return true;
  };

  const goHome = async () => {
    for (let i = 0; i < 4; i++) {
      await clickTab('工作台');
      await wait(900);
      if ((await activeTab()) === '工作台') break;
    }
    await closeAssistant();
    await wait(400);
  };

  const smoothScroll = async (toY, ms) => page.evaluate((target, dur) => new Promise(res => {
    const start = window.scrollY, dist = target - start, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      window.scrollTo(0, start + dist * e);
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  }), toY, ms);

  const injectAndLoad = async (user, token) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(1200);
    await page.evaluate((u, t) => {
      localStorage.setItem('aigc_auth_token', t);
      localStorage.setItem('aigc_auth_user', JSON.stringify(u));
    }, user, token);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(3400);
  };

  // 保持页面"活着"：轻柔的鼠标漂移
  const hold = async (ms, cx = 800, cy = 470, r = 1.0) => {
    const t0 = Date.now();
    let k = 0;
    while (Date.now() - t0 < ms) {
      k++;
      const x = cx + Math.sin(k * 0.30) * 250 * r;
      const y = cy + Math.cos(k * 0.23) * 150 * r;
      try { await page.mouse.move(x, y, { steps: 5 }); } catch (e) {}
      await wait(200);
    }
  };

  const canvasBox = () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  });

  const shot = async (name) => {
    await wait(350);
    try { await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) }); } catch (e) {}
  };

  const runSeg = async (name, holdMs, prepare, during) => {
    if (only.length && !only.some(o => name.includes(o))) return;
    console.log(`\n▶ ${name}  目标 ${(holdMs / 1000).toFixed(1)}s`);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { await prepare(); } catch (e) { console.log(`  ! 准备异常: ${e.message}`); }
      await wait(700);
      await rec.start();
      const t0 = Date.now();
      try { await during(); } catch (e) { console.log(`  ! 动作异常: ${e.message}`); }
      const spent = Date.now() - t0;
      if (spent < holdMs) await hold(holdMs - spent);
      await rec.stop(name);
      const f = path.join(VID_DIR, `${name}.mp4`);
      if (fs.existsSync(f) && fs.statSync(f).size > 20000) {
        const d = parseFloat(execFileSync(FFMPEG.replace(/ffmpeg\.exe$/, 'ffprobe.exe'),
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());
        console.log(`  ✓ ${name}.mp4  ${d.toFixed(2)}s`);
        return;
      }
      console.log(`  ! 第 ${attempt} 次录制无效，${attempt < 2 ? '重试…' : '放弃'}`);
      await wait(1500);
    }
  };

  // ══════════════════════════════════════════════
  // 场景 1　首页（问题引入）　21.9s
  // ══════════════════════════════════════════════
  await runSeg('s1_首页', 21900, async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(2600);
    await shot('01_首页');
  }, async () => {
    await smoothScroll(760, 3400);  await wait(900);
    await smoothScroll(1620, 3400); await wait(1100);
    await smoothScroll(2600, 3400); await wait(1000);
    await smoothScroll(3700, 3400); await wait(1100);
    await smoothScroll(4700, 3400); await wait(1100);
    await smoothScroll(5600, 3200); await wait(1400);
  });

  // ══════════════════════════════════════════════
  // 场景 2　登录 / 注册
  // ══════════════════════════════════════════════
  await runSeg('s2_登录页', 9000, async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(2800);
  }, async () => {
    await clickText('进入系统');
    await wait(2200);
    await shot('02_登录页');
    await page.evaluate(() => { const i = document.querySelector('input'); if (i) i.focus(); });
    await page.keyboard.type('teacher_demo', { delay: 130 });
    await wait(800);
    await page.evaluate(() => { const i = document.querySelectorAll('input')[1]; if (i) i.focus(); });
    await page.keyboard.type('123456', { delay: 150 });
    await wait(1400);
    await hold(1800, 1180, 520, 0.5);
  });

  await runSeg('s2_注册页', 11000, async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await wait(2800);
    await clickText('进入系统');
    await wait(2200);
  }, async () => {
    await clickText('注册新账号');
    await wait(2400);
    await shot('03_注册页');
    // 依次悬停"我是学生 / 我是教师"角色选项，突出角色隔离
    const hoverRole = async (label) => {
      await page.evaluate(l => {
        for (const el of document.querySelectorAll('div,label,button,span')) {
          if ((el.textContent || '').trim() === l) {
            const r = el.getBoundingClientRect();
            if (r.width > 30 && r.width < 420 && r.height > 20) {
              el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              return;
            }
          }
        }
      }, label);
    };
    for (let k = 0; k < 2; k++) {
      await hoverRole('我是学生');
      await hold(1900, 1150, 480, 0.5);
      await hoverRole('我是教师');
      await hold(1900, 1150, 560, 0.5);
    }
    await hold(1500, 1180, 520, 0.6);
  });

  // ══════════════════════════════════════════════
  // 场景 3　教师端
  // ══════════════════════════════════════════════
  const tea = await auth('teacher_demo', '123456', 'teacher');

  await runSeg('s3_教师工作台', 13500, async () => {
    await injectAndLoad(tea.user, tea.token);
    await closeAssistant();
    await shot('12_教师工作台');
  }, async () => {
    await hold(12500, 800, 420, 1.0);
  });

  await runSeg('s3_文档上传', 12500, async () => {
    await openCard('文档上传');
    await closeAssistant();
    await shot('13_文档上传页');
  }, async () => {
    await page.evaluate(() => {
      const z = document.querySelector('[class*="drop"], [class*="upload"], input[type="file"]');
      if (z) z.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    await hold(11500, 800, 460, 0.9);
  });

  await runSeg('s3_AIGC生成', 11500, async () => {
    await goHome();
    await openCard('AIGC 生成图谱');
    await closeAssistant();
    await shot('14_AIGC生成页');
  }, async () => {
    await page.evaluate(() => {
      const i = document.querySelector('input[type="text"], textarea');
      if (i) i.focus();
    });
    await page.keyboard.type('数据结构与算法', { delay: 150 });
    await wait(1800);
    await hold(7500, 800, 440, 0.9);
  });

  await runSeg('s3_图谱编辑', 16500, async () => {
    await goHome();
    await openCard('知识图谱');
    await wait(2600);
    await closeAssistant();
    await shot('15_图谱编辑页');
    await clickText('编辑图谱');
    await wait(3000);
  }, async () => {
    const b = await canvasBox();
    if (b) {
      // 缓慢平移
      await page.mouse.move(b.x, b.y);
      await page.mouse.down();
      for (let i = 1; i <= 30; i++) { await page.mouse.move(b.x - i * 6, b.y - i * 2.4); await wait(80); }
      await page.mouse.up();
      await wait(700);
      // 缓慢缩放
      for (let i = 0; i < 4; i++) { await page.mouse.wheel({ deltaY: -90 }); await wait(420); }
      await wait(600);
      for (let i = 0; i < 2; i++) { await page.mouse.wheel({ deltaY: 90 }); await wait(420); }
      await wait(600);
      // 选中节点
      await page.mouse.click(b.x - 30, b.y - 10);
      await wait(600);
      await page.mouse.click(b.x + 60, b.y - 40);
      await hold(3200, b.x, b.y, 0.35);
    } else {
      await hold(12000, 800, 440, 1.0);
    }
  });

  // ══════════════════════════════════════════════
  // 场景 4　学生端：3D 校园 / 知识图谱 / 节点详情
  // ══════════════════════════════════════════════
  const stu = await auth('student_demo', '123456', 'student');

  await runSeg('s4_3D校园', 10500, async () => {
    await injectAndLoad(stu.user, stu.token);
    await closeAssistant();
    await shot('04_学生工作台');
  }, async () => {
    await hold(10000, 800, 470, 0.9);
  });

  await runSeg('s4_知识图谱', 17000, async () => {
    await openCard('知识图谱');
    await wait(3800);
    await closeAssistant();
    await shot('05_知识图谱页');
  }, async () => {
    const b = await canvasBox();
    if (b) {
      await page.mouse.move(b.x, b.y);
      await page.mouse.down();
      for (let i = 1; i <= 26; i++) { await page.mouse.move(b.x - i * 6, b.y - i * 2.6); await wait(90); }
      await page.mouse.up();
      await wait(700);
      for (let i = 0; i < 5; i++) { await page.mouse.wheel({ deltaY: -100 }); await wait(400); }
      await wait(700);
      for (let i = 0; i < 3; i++) { await page.mouse.wheel({ deltaY: 100 }); await wait(400); }
      await wait(700);
      // 中键旋转
      await page.mouse.move(b.x, b.y);
      await page.mouse.down({ button: 'middle' });
      for (let i = 1; i <= 16; i++) { await page.mouse.move(b.x + i * 5, b.y + Math.sin(i * 0.4) * 26); await wait(90); }
      await page.mouse.up({ button: 'middle' });
      await hold(3200, b.x, b.y, 0.3);
    } else {
      await hold(12000, 800, 440, 1.0);
    }
  });

  await runSeg('s4_节点详情', 10500, async () => {
    const b = await canvasBox();
    if (b) {
      await page.mouse.click(b.x, b.y);
      await wait(900);
      await page.mouse.click(b.x + 50, b.y - 35);
      await wait(1800);
    }
    await closeAssistant();
    await shot('05b_节点详情');
  }, async () => {
    await hold(8000, 700, 460, 0.7);
  });

  // ══════════════════════════════════════════════
  // 场景 5　智能问答 / 学习路径 / 详细学习 / 小测验
  // ══════════════════════════════════════════════
  await runSeg('s5_智能问答', 13500, async () => {
    await goHome();
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="打开 AI 答疑助手"]');
      if (btn) btn.click();
    });
    await wait(2200);
    await shot('06_智能问答页');
  }, async () => {
    await page.evaluate(() => {
      const i = document.querySelector('textarea, input[type="text"]');
      if (i) i.focus();
    });
    await page.keyboard.type('什么是最短路径算法？', { delay: 140 });
    await wait(1000);
    await page.keyboard.press('Enter');
    await wait(6000);          // 等待流式回答
    await hold(3500, 1000, 500, 0.4);
  });

  await runSeg('s5_学习路径', 10500, async () => {
    await goHome();
    await openCard('学习路径');
    await wait(3200);
    await closeAssistant();
    await shot('07_学习路径页');
  }, async () => {
    await hold(9500, 800, 460, 0.8);
  });

  await runSeg('s5_详细学习', 8500, async () => {
    await injectAndLoad(stu.user, stu.token);
    await goHome();
    await openCard('学习路径');
    await wait(3200);
    const ok = await clickText('去学');
    if (!ok) console.log('    ! 未找到「去学」按钮');
    await wait(3400);
    await closeAssistant();
    await shot('08_详细学习页');
  }, async () => {
    await hold(7500, 800, 440, 0.7);
  });

  await runSeg('s5_小测验', 7500, async () => {
    const ok = await clickText('开始本节测试');
    if (!ok) {
      // 兜底：重新加载学生会话，从学习路径页进入详细学习，再进测验
      await injectAndLoad(stu.user, stu.token);
      await goHome();
      await openCard('学习路径');
      await wait(3200);
      await clickText('去学');
      await wait(3400);
      await clickText('开始本节测试');
    }
    await wait(2600);
    await closeAssistant();
    await shot('09_知识小测验');
  }, async () => {
    // 先停留展示题目，再作答，最后提交查看即时反馈
    await hold(2200, 800, 460, 0.6);

    // 依据当前测验知识点，从后端图谱推导三道题的正确答案
    const nodeName = await page.evaluate(() => {
      const h2 = document.querySelector('h2');
      return h2 ? h2.textContent.trim() : null;
    });
    let targets = null;
    try {
      const g = await fetch(`${API_BASE}/api/graph`).then(r => r.json());
      const n = (g.nodes || []).find(x => String(x.name).trim() === nodeName);
      if (n) {
        const imp = Math.max(1, Math.min(5, Math.round(Number(n.difficulty ?? 3))));
        targets = [String(n.description ?? ''), String(n.category ?? ''), `重要度 ${imp}/5`];
      }
    } catch (e) { console.log(`    ! 图谱查询异常: ${e.message}`); }

    const allOk = targets ? await page.evaluate((ts) => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => {
        const s = b.querySelector('span');
        return s && /^[A-D]$/.test((s.textContent || '').trim());
      });
      if (btns.length < 12) return false;
      const groups = [];
      for (let i = 0; i + 4 <= btns.length; i += 4) groups.push(btns.slice(i, i + 4));
      let ok = true;
      groups.slice(0, 3).forEach((g, qi) => {
        const hit = g.find(b => (b.textContent || '').includes(ts[qi]));
        if (hit) hit.click(); else ok = false;
      });
      return ok;
    }, targets) : false;

    if (!allOk) console.log(`    ! 未全部命中正确答案（${nodeName}），仅展示作答状态`);
    await wait(1100);
    if (allOk) {
      await clickText('提交并查看结果');
      await wait(1500);
    }
    await hold(2000, 800, 460, 0.6);
  });

  // ══════════════════════════════════════════════
  // 场景 6　学习报告
  // ══════════════════════════════════════════════
  await runSeg('s6_学习报告', 12500, async () => {
    await goHome();
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="打开访客中心"]');
      if (btn) btn.click();
    });
    await wait(3000);
    await closeAssistant();
    await shot('11_访客中心');
  }, async () => {
    await hold(3000, 800, 430, 0.6);
    await smoothScroll(620, 2600);
    await wait(1200);
    await hold(3000, 800, 520, 0.5);
  });

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  console.log('\n══════ 录制完成 ══════');
  fs.readdirSync(VID_DIR).sort().forEach(f => {
    const mb = (fs.statSync(path.join(VID_DIR, f)).size / 1048576).toFixed(1);
    console.log(`  ${f}  (${mb}MB)`);
  });
})().catch(e => { console.error(e); process.exit(1); });