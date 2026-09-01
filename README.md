# AIGC 课程知识图谱学习平台

基于 AIGC 自动构建学科知识图谱，并以「图谱」为知识大脑驱动文档解析、智能问答、学习路径规划、AI 讲题等教学场景的 Web 应用。前端采用手绘水彩风格，后端兼容 OpenAI 协议接入大模型，支持零配置离线兜底运行。

---

## 功能特性

| 模块 | 说明 |
| --- | --- |
| 用户认证 | 注册 / 登录 / JWT 鉴权，所有学习数据按用户隔离 |
| 文档上传 | 支持 PDF / Word / PPT 解析，自动抽取文本并生成知识图谱 |
| AIGC 生成图谱 | 输入课程主题，调用大模型围绕主题生成节点与关系 |
| 我的图谱 | 每份课程 / 文档独立存储为一份图谱，支持列表、切换、改名、删除 |
| 知识图谱可视化 | AntV G 手绘风格渲染，支持拖拽 / 点击 / 高亮 / 关系图例 |
| 智能问答 | RAG 检索知识图谱 + 大模型回答，附带引用节点 |
| 学习路径 | 基于前置依赖关系生成阶段化学习路径与推荐 |
| 学习进度 | 节点掌握度标记，反向影响路径推荐 |
| AI 讲题老师 | 拍照 / 文字输入题目，AI 板书分步讲解，可打断提问，结束后生成变式练习，形成讲-练-测闭环 |

---

## 技术栈

**后端**
- FastAPI 0.115 + Uvicorn
- SQLAlchemy 2.0 + SQLite（自动迁移，零配置）
- httpx（调用 LLM）
- PyPDF2 / python-docx / python-pptx（文档解析）
- jieba（中文分词，用于问答检索）

**前端**
- React 18 + Vite 5 + TypeScript
- TailwindCSS（手绘水彩主题）
- AntV G + g-plugin-rough-svg-renderer（手绘图谱渲染）
- KaTeX（数学公式）
- d3-force（力导向布局）
- lucide-react（图标）

**LLM**
- 兼容 OpenAI Chat Completions 协议（火山方舟 Ark / DeepSeek / 通义 / 本地 Ollama 均可）
- 未配置 API Key 时自动回退离线规则抽取，保证基本功能可用

---

## 项目结构

```
aigc课程/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── routers/         # 路由（按功能分文件）
│   │   │   ├── auth.py          # 认证
│   │   │   ├── documents.py     # 文档上传+解析
│   │   │   ├── aigc.py          # AIGC 主题生成图谱
│   │   │   ├── graph.py         # 图谱节点/关系 CRUD（旧版兼容）
│   │   │   ├── graphs.py        # 图谱列表/详情/删除/改名（新版）
│   │   │   ├── qa.py            # 智能问答
│   │   │   ├── learning_path.py # 学习路径
│   │   │   ├── progress.py      # 学习进度
│   │   │   └── tutor.py         # AI 讲题老师
│   │   ├── models.py         # 数据模型
│   │   ├── schemas.py        # Pydantic schema
│   │   ├── llm_client.py     # LLM 客户端（含离线兜底）
│   │   ├── parsers.py        # 文档解析器
│   │   ├── auth.py           # JWT 工具
│   │   ├── config.py         # 配置
│   │   └── database.py       # 数据库连接
│   ├── main.py               # FastAPI 入口（含数据库迁移）
│   ├── requirements.txt
│   ├── .env.example
│   └── data/                 # 运行时生成（数据库+上传文件）
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── pages/            # 页面（HomePage/GraphListPage/TutorPage 等）
│   │   ├── components/       # 组件（graph/qa/tutor/upload/layout 等）
│   │   ├── context/          # 全局状态（Auth/Knowledge/Tutor/Tab）
│   │   ├── lib/graphMap.ts   # 后端图谱→前端格式映射
│   │   ├── mock/             # 示例图谱
│   │   └── types/            # 类型定义
│   ├── vite.config.ts        # 端口 5173
│   └── package.json
└── README.md
```

---

## 环境要求

- **Node.js** ≥ 18（前端）
- **Python** ≥ 3.11（后端）
- **npm** 或 **pnpm** / **yarn**（任一即可）

---

## 快速启动

### 1. 启动后端（端口 8000）

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（可选；不配置则走离线兜底）
cp .env.example .env
# 编辑 .env 填写 LLM_API_KEY（留空则使用离线规则抽取）

# 启动服务
uvicorn main:app --reload --port 8000
```

启动后访问接口文档：
- Swagger UI：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc

数据库 `data/app.db` 与上传目录 `data/uploads/` 会在首次启动时自动创建，表结构自动迁移，无需手动建表。

### 2. 启动前端（端口 5173）

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

启动后访问：http://localhost:5173/

### 3. 开始使用

1. 打开 http://localhost:5173/，首次访问会跳转到登录页
2. 点击「注册」创建一个账号（用户名 + 密码即可）
3. 登录后进入工作台，可见 9 个功能卡片
4. 推荐入门路径：
   - 点击「我的图谱」→「加载示例」可立即体验图谱可视化
   - 或「文档上传」上传一份课程材料自动生成图谱
   - 或「AIGC 生成图谱」输入主题让大模型生成（需配置 LLM_API_KEY）

---

## 配置说明（backend/.env）

```env
# LLM 配置（兼容 OpenAI 协议）
# 留空 LLM_API_KEY 时自动回退离线规则抽取（关键词 + 正则），零配置可用
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
LLM_API_KEY=
LLM_MODEL=doubao-seed-2-1-pro-260628
LLM_TIMEOUT=360

# 文件与数据库
UPLOAD_DIR=./data/uploads
SQLITE_URL=sqlite:///./data/app.db

# CORS（前端端口需在此列表中）
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177
```

**LLM 接入示例**：

| 提供商 | LLM_BASE_URL | LLM_MODEL |
| --- | --- | --- |
| 火山方舟 Ark | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-2-1-pro-260628` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` |

未配置 Key 时，以下功能仍可离线使用：
- 文档上传与解析（图谱抽取走规则兜底，质量较低但可用）
- 示例图谱加载与可视化
- 知识图谱手动编辑
- 学习路径与进度

以下功能在离线模式下不可用（必须配置 LLM）：
- AIGC 主题生成图谱（返回空结果）
- 智能问答（提示未配置）
- AI 讲题老师（提示未配置）

---

## API 概览

| 前缀 | 功能 | 关键接口 |
| --- | --- | --- |
| `/api/auth` | 认证 | `POST /register` `POST /login` `GET /me` |
| `/api/documents` | 文档 | `POST /upload` `GET` `DELETE /{id}` |
| `/api/aigc` | AIGC 生成 | `POST /generate` `POST /suggest-resources` |
| `/api/graphs` | 图谱列表 | `GET` `GET /{id}` `PATCH /{id}` `DELETE /{id}` |
| `/api/graph` | 图谱节点 | `GET` `POST /nodes` `POST /relations` `POST /seed-sample` |
| `/api/qa` | 问答 | `POST /ask` |
| `/api/learning-path` | 学习路径 | `GET /recommendations` `GET /stages` |
| `/api/progress` | 进度 | `GET` `POST /{nodeId}/mastered` `DELETE /{nodeId}/mastered` |
| `/api/tutor` | AI 讲题 | `POST /sessions` `GET /sessions/{id}/steps/{idx}/play` (SSE) `POST /sessions/{id}/interrupt` `POST /sessions/{id}/feedback` `POST /sessions/{id}/exercises` `POST /sessions/{id}/exercises/{eid}/submit` |

所有接口（除 `/auth/register` `/auth/login`）均需在请求头携带：

```
Authorization: Bearer <登录返回的 token>
```

---

## 数据模型

核心表（均按 `user_id` 隔离）：

- `users` — 用户
- `documents` — 上传文档
- `knowledge_graphs` — 图谱元数据（每份课程/文档独立一份）
- `kg_nodes` / `kg_relations` — 知识节点与关系（带 `graph_id` 关联到具体图谱）
- `user_progress` — 用户对节点的掌握度
- `tutor_sessions` / `tutor_steps` / `tutor_exercises` / `mastery_events` — AI 讲题会话与掌握度事件

节点 ID 生成时会带 `graph_id` 前缀，确保不同图谱之间节点 ID 不冲突。

---

## 常见问题

**Q: 启动后端报 `LLM_API_KEY` 相关错误？**
A: 检查 `.env` 是否已正确加载。留空 Key 会进入离线模式，属正常现象。

**Q: 前端登录后页面空白 / 接口 401？**
A: 确认后端已启动（端口 8000），且 `.env` 的 `CORS_ORIGINS` 包含前端访问的端口。

**Q: AIGC 生成图谱返回 0 节点？**
A: 离线模式（无 LLM_API_KEY）下 AIGC 主题生成不可用，需配置有效的 LLM 凭据。

**Q: 数据库想重置？**
A: 停止后端，删除 `backend/data/app.db` 后重启，会自动重建表结构并注入示例图谱。

**Q: 想修改前端端口？**
A: 编辑 `frontend/vite.config.ts` 的 `server.port`，并把新端口加入后端 `.env` 的 `CORS_ORIGINS`。

---

## 开发指南

**后端调试**
```bash
cd backend
uvicorn main:app --reload --port 8000
```
修改 `app/` 下文件会自动热重载。

**前端调试**
```bash
cd frontend
npm run dev
```
修改 `src/` 下文件会自动热更新。

**生产构建**
```bash
cd frontend
npm run build      # 产物在 dist/
npm run preview    # 本地预览构建结果
```

**接口测试**
后端启动后打开 http://localhost:8000/docs，可在 Swagger UI 直接调试所有接口（认证类接口先调 `/auth/login` 拿 token，点页面右上角 Authorize 填入即可）。
