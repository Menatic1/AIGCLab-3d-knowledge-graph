/**
 * 全片场景配置：旁白 / 字幕 / 素材源
 *
 * 三类画面来源混排，避免全片都是产品界面录屏：
 *   1) 实拍素材  STK(id, from, take) —— Mixkit 免费授权视频（Free License，可商用免署名）
 *      本地路径 scripts/video/stock/raw/*-<id>.mp4，由 scripts/video/stock/candidates.json 索引
 *   2) 动效动画  ANIMC(name, from, take) —— 由 anim/*.html 经 render_anim.cjs 逐帧渲染
 *   3) 产品录屏  T(file, from) —— 视频_timed/ 中按旁白节奏录制的界面操作
 *
 * 每个 beat 的窗口长度由旁白时长决定（见 timing.json）。clip.take 显式指定占用秒数，
 * 未指定 take 的片段按可用长度等比瓜分剩余窗口 —— 因此「实拍引子 → 产品录屏」可精确配比，
 * 且完全不动旁白时间轴。
 *
 * 时长公式（gen_narration）：dur = LEAD + Σ旁白 + (n-1)×gap + tail；pad = LEAD + tail
 */
const L = require('./lib.cjs');
const path = require('path');

const OUT_W = 1920, OUT_H = 1080;

// 产品录屏：file + 起始秒（跳过页面装载瞬间）
const T = (file, from = 0.4) => ({ file: path.join(L.TIMED_DIR, file), from });
// 实拍素材
const STK = (id, from, take) => ({ file: L.stock(id), from, take });
// 逐帧渲染出的动画
const ANIMC = (name, from, take) => ({ file: path.join(L.TMP, 'anim_out', `${name}.mp4`), from, take });
const ANIM = (html) => ({ type: 'anim', html: path.join(L.BUILD, 'anim', html) });

const scenes = [
  {
    key: 's0', name: '片头',
    source: ANIM('intro.html'),
    beats: [
      { narration: null, subtitle: '智绘千里 · AIGC 知识图谱智能导学系统', fixedDur: 8.0 },
    ],
  },
  {
    key: 's1', name: '问题引入',
    // 实拍蒙太奇演绎四大痛点，收束在「知识重组」动效上（不再使用首页整屏下移）
    source: { type: 'clips' },
    gap: 0.3,
    pad: 4.4,
    beats: [
      {
        narration: '一门课的资料，往往散落在几十份课件与视频里；',
        subtitle: '资料散落在 PDF、PPT、视频里，学生找不到重点',
        clips: [STK('21598', 1.0, 3.0), STK('50111', 1.0, 2.836)],   // 凌乱书堆 → 摊满资料的书桌
      },
      {
        narration: '知识点之间缺少联系，学生不知道该先学什么；',
        subtitle: '知识点之间没有联系，学完就忘',
        clips: [STK('28321', 3.0, 2.6), STK('4761', 0.5, 1.972)],    // 苦恼的学生 → 伏案苦读
      },
      {
        narration: '而老师要手工梳理知识结构，动辄数周；',
        subtitle: '老师手工梳理知识结构，耗时以周计',
        clips: [STK('16139', 1.5, 4.104)],                            // 深夜伏案
      },
      {
        narration: '答疑更是重复劳动，学情难以量化。',
        subtitle: '答疑重复劳动，学情无法量化',
        clips: [STK('48165', 1.0, 4.176)],                            // 课堂答疑
      },
      {
        narration: '知识，需要被重新组织。',
        subtitle: '知识，需要被重新组织',
        clips: [ANIMC('rebuild', 0, 6.064)],                          // 碎片 → 连成知识网络
      },
    ],
  },
  {
    key: 's2', name: '入口与角色',
    source: { type: 'clips' },
    gap: 2.0,
    pad: 5.0,
    beats: [
      {
        narration: '智绘千里用一套系统，服务教师与学生两种角色。',
        subtitle: '一套系统 · 两种角色',
        clips: [ANIMC('roles', 0, 3.6), T('s2_登录页.mp4')],           // 角色动效 → 登录页
      },
      {
        narration: '教师负责建设知识图谱，学生负责沿着图谱学习——两端的权限完全隔离。',
        subtitle: '权限完全隔离 · 教师建图 / 学生用图',
        clips: [STK('49155', 2.0, 2.2), T('s2_注册页.mp4')],          // 教师授课 → 角色注册
      },
    ],
  },
  {
    key: 's3', name: '教师端：从文档到图谱',
    source: { type: 'clips' },
    gap: 2.0,
    pad: 5.5,
    beats: [
      {
        narration: '进入教师端，课程建设进度一目了然——资料数量、解析状态、知识点抽取进度、待校对节点，全部量化。',
        subtitle: '课程建设进度，一屏掌握',
        clips: [STK('48165', 1.0, 2.5), T('s3_教师工作台.mp4')],
      },
      {
        narration: '上传课程文档，系统自动完成解析与知识点抽取。PDF、PPT、Word 均可，抽取结果实时可见。',
        subtitle: '多格式文档解析 · LLM 知识点抽取',
        clips: [ANIMC('pipeline', 0, 4.2), T('s3_文档上传.mp4')],      // 文档→解析→知识点→图谱 动效
      },
      {
        narration: '也可以直接输入一个主题，由大模型生成完整的知识图谱——节点、层级、先修关系，一次成型。',
        subtitle: '一句话生成知识图谱',
        clips: [ANIMC('graphflow', 0, 5.0), T('s3_AIGC生成.mp4')],     // 力导向生成 + 三类关系
      },
      {
        narration: '生成的图谱并非终点。教师可以在编辑器里增删节点、调整关系、修正属性，让机器产出真正变成可信的教学资产。',
        subtitle: '人工校对闭环 · 教师始终掌握最终解释权',
        clips: [ANIMC('edit', 0, 4.0), T('s3_图谱编辑.mp4')],          // 校对动效：拖动 / 新增 / 删除
      },
    ],
  },
  {
    key: 's4', name: '学生端：探索知识图谱',
    source: { type: 'clips' },
    gap: 2.0,
    pad: 5.5,
    beats: [
      {
        narration: '切换到学生视角。3D 校园工作台把功能入口变成可探索的空间。',
        subtitle: '3D 校园 · 功能入口可视化',
        clips: [STK('4560', 1.0, 2.6), T('s4_3D校园.mp4')],           // 实拍校园 → 3D 校园模型（同构转场）
      },
      {
        narration: '这就是课程的知识图谱。上百个知识点、三类语义关系，可以自由平移、缩放、旋转。点开任意节点，图片、视频、公式、代码，都在这里。',
        subtitle: '上百个知识点 · 3 类关系（包含 / 先修 / 关联）· 多模态资源',
        clips: [ANIMC('multimodal', 0, 4.0), T('s4_知识图谱.mp4')],     // 多模态资源四宫格 → 真实图谱
      },
      {
        narration: '每个节点的掌握状态清晰可见，已掌握、待巩固一目了然。',
        subtitle: '掌握状态可视化',
        clips: [STK('4531', 2.0, 2.5), T('s4_节点详情.mp4')],
      },
    ],
  },
  {
    key: 's5', name: '学生端：问答 · 路径 · 测验',
    source: { type: 'clips' },
    gap: 2.0,
    pad: 6.0,
    beats: [
      {
        narration: '遇到问题，直接问 AI 助教。基于课程知识图谱的检索增强问答，每一条回答都能溯源到具体知识点。',
        subtitle: 'RAG 检索增强 · 答案可溯源到知识点',
        clips: [ANIMC('qa', 0, 3.6), T('s5_智能问答.mp4')],             // RAG 检索 + 流式回答 + 溯源
      },
      {
        narration: '系统根据先修关系，为每个学生推荐个性化的学习路径——先学什么、后学什么，不再靠猜。',
        subtitle: '基于先修关系 · 个性化路径推荐',
        clips: [ANIMC('path', 0, 4.0), T('s5_学习路径.mp4')],          // 先修拓扑 → 推荐路径
      },
      {
        narration: '点进知识点，配套讲解与视频资源；学完立即小测，三题达标，形成完整的学习闭环。',
        subtitle: '学 — 练 — 测 闭环',
        clips: [ANIMC('quiz', 0, 3.6), T('s5_详细学习.mp4'), T('s5_小测验.mp4')],  // 测验达标动效 → 详细学习 → 小测验
      },
    ],
  },
  {
    key: 's6', name: '学习报告',
    source: { type: 'clips' },
    gap: 2.0,
    pad: 5.0,
    beats: [
      {
        narration: '所有学习行为都被记录成可量化的报告，学生看得见成长，教师看得见学情。',
        subtitle: '学习数据可量化 · 教师可追踪',
        clips: [ANIMC('report', 0, 4.0), T('s6_学习报告.mp4')],         // 掌握状态 + 学习足迹 数据可视化
      },
    ],
  },
  {
    key: 's7', name: '收尾',
    source: ANIM('outro.html'),
    gap: 0.3,
    pad: 3.204,
    beats: [
      { narration: '智绘千里——让散落的知识，连成一张可以行走的网。', subtitle: '智绘千里 · 让知识连成一张网' },
    ],
  },
];

const VOICE = 'zh-CN-YunyangNeural';   // 云扬：专业男声
const RATE = '-4%';      // 校准到约 240 字/分钟
const GAP_BEAT = 2.0;    // beat 之间停顿（默认；场景可用 gap 覆盖）
const LEAD = 1.0;        // 场景起点 → 旁白起点的画面留白

module.exports = { scenes, VOICE, RATE, GAP_BEAT, LEAD, OUT_W, OUT_H };
