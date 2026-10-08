/**
 * 公共工具：路径解析、ffmpeg 调用、时长探测
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const S3 = path.join(ROOT, '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S3');
const MATERIAL = path.join(S3, '演示素材');
const VID_DIR = path.join(MATERIAL, '视频');
const TIMED_DIR = path.join(MATERIAL, '视频_timed');
const SHOT_DIR = path.join(MATERIAL, '截图');
const COVER_PNG = path.join(ROOT, '赛题10_智绘千里_AIGC知识图谱智能导学系统', 'S0', '封面图_代码绘制.png');
const BUILD = path.join(ROOT, 'scripts', 'video');
const TMP = path.join(BUILD, 'tmp');
const AUDIO = path.join(BUILD, 'audio');
const OVERLAY = path.join(BUILD, 'overlay');
const SCENES = path.join(BUILD, 'scenes');
const STOCK = path.join(BUILD, 'stock', 'raw');

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

const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/, 'ffprobe.exe');
const FONT_HEI = 'C:/Windows/Fonts/simhei.ttf';
const FONT_MSYH = 'C:/Windows/Fonts/msyh.ttc';
const FONT_ZHONGSONG = 'C:/Windows/Fonts/STZHONGS.TTF';

// ffmpeg 滤镜内的 Windows 路径需转义冒号并加引号：C:/x -> 'C\:/x'
const esc = p => `'${p.replace(/^([A-Za-z]):/, '$1\\:')}'`;

function mkdirs(...dirs) { dirs.forEach(d => fs.mkdirSync(d, { recursive: true })); }

// 按素材 id 取本地实拍文件（Mixkit 下载件以 -<id>.mp4 结尾）
function stock(id) {
  if (!fs.existsSync(STOCK)) throw new Error('缺少实拍素材目录：' + STOCK);
  const f = fs.readdirSync(STOCK).find(n => n.endsWith(`-${id}.mp4`));
  if (!f) throw new Error(`未找到实拍素材 ${id}（${STOCK}）`);
  return path.join(STOCK, f);
}

// 沙箱下 Node 的管道 stdio（默认 'pipe'）无法打开命名管道 → EPERM。
// 故 run 默认改用 'inherit'；需要捕获 stdout 时改写临时文件，而不是走管道。
let capSeq = 0;
function capture(cmd, args) {
  fs.mkdirSync(TMP, { recursive: true });
  const f = path.join(TMP, `.capture_${process.pid}_${capSeq++}.txt`);
  const fd = fs.openSync(f, 'w');
  try {
    execFileSync(cmd, args, { stdio: ['ignore', fd, 'ignore'] });
  } finally {
    fs.closeSync(fd);
  }
  const out = fs.readFileSync(f, 'utf8');
  fs.rmSync(f, { force: true });
  return out;
}

function run(args, opts = {}) {
  return execFileSync(FFMPEG, args, { maxBuffer: 1024 * 1024 * 64, ...opts, stdio: opts.stdio || 'inherit' });
}

function duration(file) {
  const out = capture(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ]);
  return parseFloat(out.trim());
}

function videoInfo(file) {
  const out = capture(FFPROBE, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
    '-of', 'csv=p=0', file,
  ]);
  const [w, h, fps, frames] = out.trim().split(',');
  return { w: +w, h: +h, fps: fps, frames: +frames };
}

// puppeteer-core 不在本仓库依赖里；按候选路径逐个尝试，避免写死 npx 缓存哈希
function loadPuppeteer() {
  const cands = [
    path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx', '668c188756b835f3', 'node_modules', 'puppeteer-core'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@mermaid-js', 'mermaid-cli', 'node_modules', 'puppeteer-core'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'puppeteer-core'),
    'puppeteer-core',
    'puppeteer',
  ];
  const tried = [];
  for (const c of cands) {
    try { return require(c); } catch { tried.push(c); }
  }
  throw new Error('未找到 puppeteer / puppeteer-core（已尝试：' + tried.join(' , ') + '）');
}

module.exports = {
  ROOT, S3, MATERIAL, VID_DIR, TIMED_DIR, SHOT_DIR, COVER_PNG,
  BUILD, TMP, AUDIO, OVERLAY, SCENES, STOCK,
  FFMPEG, FFPROBE, FONT_HEI, FONT_MSYH, FONT_ZHONGSONG, esc,
  mkdirs, run, duration, videoInfo, loadPuppeteer, stock,
};