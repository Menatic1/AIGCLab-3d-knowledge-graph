"""LLM 客户端：用于"知识抽取"和"问答 RAG"。
两个调用点都有完整的 Mock 离线回退，保证 **不填 API Key 也能完成基本流程**，
只是质量取决于回退规则（关键词 / 示例图谱）。
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any

import httpx

from .config import settings


# 常见中文 IT/网络 分类词典（用来离线识别知识点类别）
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "协议": ["协议", "TCP", "UDP", "IP", "HTTP", "HTTPS", "FTP", "SMTP", "POP", "IMAP", "DNS", "ARP", "ICMP",
             "SSL", "TLS", "MAC", "以太网", "路由"],
    "算法": ["算法", "加密", "校验", "CRC", "MD5", "SHA", "RSA", "AES", "DES", "哈希", "对称", "非对称",
             "数字签名", "认证"],
    "设备": ["设备", "路由器", "交换机", "集线器", "中继器", "网桥", "网关", "网卡", "防火墙", "负载均衡",
             "调制解调器", "光猫"],
    "应用": ["应用", "服务", "万维网", "邮件", "文件传输", "远程登录", "DNS 解析", "CDN", "VPN"],
    "基础概念": ["概念", "定义", "简介", "概述", "历史", "发展", "特征", "原理", "基础"],
    "核心概念": ["分层", "体系结构", "OSI", "七层", "四层", "五层", "封装", "解封装", "分段", "复用",
                "端到端", "面向连接", "无连接"],
}

RELATION_KEYWORDS: list[tuple[str, str]] = [
    (r"(.+?)是(.+?)的(基础|前提|先修|前置)", "先修"),
    (r"(.+?)依赖(.+)", "依赖"),
    (r"(.+?)属于(.+)", "属于"),
    (r"(.+?)包含(.+)", "包含"),
    (r"(.+?)基于(.+)", "基于"),
    (r"(.+?)和(.+?)协同工作", "协同"),
    (r"(.+?)位于(.+)之上", "上层"),
    (r"(.+?)为(.+)提供服务", "服务于"),
]


@dataclass
class ExtractResult:
    nodes: list[dict[str, Any]]
    relations: list[dict[str, Any]]
    used_llm: bool
    raw_summary: str = ""


# ---------------- 基础工具 ----------------
def _stable_id(name: str) -> str:
    """根据名称生成稳定的短 id，类似 n8F3a。"""
    h = hashlib.md5(name.encode("utf-8")).hexdigest()
    return "n" + h[:8]


def _guess_category(name: str, desc: str = "") -> str:
    bucket = (name + " " + desc)
    score: dict[str, int] = {c: 0 for c in CATEGORY_KEYWORDS}
    for c, kws in CATEGORY_KEYWORDS.items():
        for kw in kws:
            if kw.lower() in bucket.lower():
                score[c] += 1
    best = max(score.items(), key=lambda x: x[1])
    if best[1] > 0:
        return best[0]
    return "核心概念"


# ---------------- 离线抽取（Mock / 关键词规则）----------------
def _extract_offline(text: str) -> ExtractResult:
    """基于章节标题 / 句号切分 / 关键词库做抽取，保证零配置可用。"""
    # 1) 切段落，优先按 markdown/数字编号标题
    lines = [ln.strip() for ln in re.split(r"[\n\r]+", text) if ln.strip()]
    candidates: list[str] = []
    heading_re = re.compile(r"^(#{1,6}\s+|\d+(?:\.\d+)*[\.、\s]+|第[一二三四五六七八九十百千0-9]+[章节部分篇讲]\s*)?(.+?)$")
    for ln in lines:
        m = heading_re.match(ln)
        if not m:
            continue
        title = m.group(2).strip(" :：-—")
        # 丢弃太短或太长的
        if 1 < len(title) <= 40:
            candidates.append(title)

    # 段落首句：每 5 行取一次首句
    for i in range(0, len(lines), 5):
        chunk = " ".join(lines[i:i + 5])
        first_sentences = re.split(r"[。！？!?\n]", chunk)
        for s in first_sentences[:2]:
            s = s.strip()
            if 2 <= len(s) <= 40 and "：" not in s[:2]:
                candidates.append(s)

    # 2) 归一化 + 去重
    seen: dict[str, dict] = {}
    for c in candidates:
        # 取名词短语：去尾助词
        clean = re.sub(r"[的了是和与及或等为在从对]$", "", c).strip(" .,:;：；，。")
        if len(clean) < 2 or len(clean) > 40:
            continue
        if re.search(r"[\d%,（）\(\)\"'“”‘’/\\<>]", clean) and len(clean) < 4:
            continue
        cat = _guess_category(clean)
        nid = _stable_id(clean)
        if nid not in seen:
            seen[nid] = {
                "id": nid,
                "name": clean,
                "category": cat,
                "description": clean + "（从文档中识别的关键词，建议配合 LLM 进一步润色）",
                "difficulty": 3.0,
            }

    # 3) 关系抽取：用正则匹配句子
    rels: dict[str, dict] = {}
    sentences = re.split(r"[。！？!?\n]", text)
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        for pat, rtype in RELATION_KEYWORDS:
            m = re.search(pat, s)
            if not m:
                continue
            a, b = m.group(1).strip(), m.group(2).strip()
            # 只对已存在节点建关系
            a_id = _stable_id(a) if a in [n["name"] for n in seen.values()] else None
            b_id = _stable_id(b) if b in [n["name"] for n in seen.values()] else None
            if a_id and b_id and a_id != b_id:
                # a -> b：先修关系方向是 b 的先修 = a，所以 a 是 source，b 是 target
                rid = "r" + hashlib.md5(f"{a_id}_{b_id}_{rtype}".encode()).hexdigest()[:8]
                if rid not in rels:
                    rels[rid] = {
                        "id": rid,
                        "source": a_id,
                        "target": b_id,
                        "type": rtype,
                        "label": rtype,
                    }

    nodes_list = list(seen.values())

    # 兜底：节点太少时，按文本邻近创建关系
    if len(nodes_list) >= 2 and len(rels) == 0:
        for i in range(len(nodes_list) - 1):
            a, b = nodes_list[i], nodes_list[i + 1]
            rid = "r" + hashlib.md5(f"{a['id']}_{b['id']}_关联".encode()).hexdigest()[:8]
            rels[rid] = {"id": rid, "source": a["id"], "target": b["id"], "type": "关联", "label": "相邻出现"}

    return ExtractResult(
        nodes=nodes_list,
        relations=list(rels.values()),
        used_llm=False,
        raw_summary=f"离线抽取：识别 {len(nodes_list)} 个候选知识点，{len(rels)} 条关系。",
    )


# ---------------- LLM 调用 ----------------
def _llm_available() -> bool:
    return bool(settings.LLM_API_KEY and settings.LLM_API_KEY.strip())


# —— 代理自动探测（提为模块级函数，避免每次请求重复定义）——
def _resolve_proxy() -> str | None:
    """优先使用 HTTPS_PROXY/HTTP_PROXY 环境变量；如未配置但检测到本机 7897/7890
    的 Clash 本地代理端口正在监听，则自动走该端口，绕过本地 ISP 的 SNI 阻断。"""
    import os, socket
    env = (os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or
           os.environ.get("HTTP_PROXY")  or os.environ.get("http_proxy"))
    if env:
        return env
    for port in (7897, 7890):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                return f"http://127.0.0.1:{port}"
        except OSError:
            continue
    return None


# 火山方舟 Doubao-seed 系列（2.0+）官方推荐使用 /responses API，
# 但翻译模型（doubao-seed-translation-*）等不支持 /responses。
# 策略：优先 /chat/completions（兼容性最广），400 "does not support" 时自动回退 /responses。
def _use_responses_api(model: str) -> bool:
    """仅对明确需要 /responses 的对话/推理模型返回 True（排除翻译模型）。"""
    m = (model or "").lower()
    if "translation" in m:
        return False
    return "doubao-seed-2" in m or "doubao-seed-1-6" in m or "doubao-seed-1-8" in m


def _extract_responses_text(data: dict) -> str:
    """从 /v1/responses 的响应里提取 assistant 输出的纯文本（所有 output_text 拼接）。"""
    texts: list[str] = []
    for item in data.get("output") or []:
        if item.get("type") != "message":
            continue
        for c in item.get("content") or []:
            if c.get("type") == "output_text":
                texts.append(c.get("text") or "")
    if texts:
        return "\n".join(t for t in texts if t is not None)
    # 回退：Doubao-seed 非 messages 格式时 content 直接是字符串（极少见）
    raise KeyError("choices[0].message.content  占位，见外层 except 捕获")


async def _chat_completion(
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    *,
    model: str | None = None,
    want_json: bool = True,
) -> str:
    chosen_model = model or settings.LLM_MODEL
    base = settings.LLM_BASE_URL.rstrip("/")
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    proxy = _resolve_proxy()

    # —— 两种 API 路径的 payload 构造器 & 响应解析器 ——
    def _chat_payload(with_rf: bool) -> dict:
        p: dict[str, Any] = {"model": chosen_model, "temperature": temperature, "messages": messages}
        if with_rf and want_json:
            p["response_format"] = {"type": "json_object"}
        return p

    def _responses_payload(with_rf: bool) -> dict:
        p: dict[str, Any] = {"model": chosen_model, "temperature": temperature, "stream": False,
                             "input": [{"role": m["role"], "content": [{"type": "input_text", "text": m["content"]}]}
                                       for m in messages]}
        if want_json and p["input"]:
            first_text = p["input"][0]["content"][0]["text"]
            p["input"][0]["content"][0]["text"] = (
                "【重要】你必须严格输出合法的 JSON，禁止输出任何 JSON 之外的说明文字。\n" + first_text
            )
        return p

    def _chat_extract(d: dict) -> str:
        return d["choices"][0]["message"]["content"]

    # —— 决定尝试顺序：默认先 chat/completions，回退 /responses ——
    apis = [
        (base + "/chat/completions", _chat_payload, _chat_extract),
        (base + "/responses",        _responses_payload, _extract_responses_text),
    ]
    # 若模型明确需要 /responses（doubao-seed-2-* 等），调换顺序
    if _use_responses_api(chosen_model):
        apis.reverse()

    last_err = ""
    try:
        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT, proxy=proxy) as client:
            for url, payload_fn, extract_fn in apis:
                # 第一次尝试（带 JSON 约束）
                resp = await client.post(url, headers=headers, json=payload_fn(True))
                if resp.status_code >= 400 and want_json:
                    # 去掉 response_format / JSON 强约束再试一次
                    resp = await client.post(url, headers=headers, json=payload_fn(False))
                if resp.status_code < 400:
                    data = resp.json()
                    try:
                        return extract_fn(data)
                    except (KeyError, IndexError, TypeError):
                        last_err = f"响应格式异常：{str(data)[:200]}"
                        continue
                # 400/404 + "does not support" → 尝试下一个 API
                body = (resp.text or "")[:300]
                if resp.status_code in (400, 404) and "does not support" in body.lower():
                    last_err = f"HTTP {resp.status_code}：{body}"
                    continue
                # 其他 4xx/5xx 直接报错
                resp.raise_for_status()
    except httpx.ConnectError as e:
        msg = str(e).strip() or "无法连接到 LLM 服务"
        raise RuntimeError(
            f"LLM 网络连接失败：{msg}。"
            f"请检查：① 网络/DNS 能否访问 {settings.LLM_BASE_URL}；"
            f"② 是否被系统代理(如 Clash)拦截，可在代理软件中把该域名走代理节点或直连规则；"
            f"③ .env 中 LLM_BASE_URL/LLM_API_KEY 是否正确。"
        ) from e
    except httpx.TimeoutException as e:
        raise RuntimeError(
            f"LLM 请求超时（{settings.LLM_TIMEOUT}s）：{e}。"
            f"可在 .env 调大 LLM_TIMEOUT，或检查网络/代理。"
        ) from e
    except httpx.HTTPStatusError as e:
        body = (e.response.text or "")[:300] if e.response else ""
        raise RuntimeError(f"LLM 返回 HTTP {e.response.status_code}：{body}") from e
    except httpx.HTTPError as e:
        raise RuntimeError(f"LLM 请求失败：{type(e).__name__}: {e}") from e

    raise RuntimeError(
        f"LLM 调用失败：已尝试 /chat/completions 和 /responses 两个路径均失败。"
        f"最后错误：{last_err}。"
        f"请检查 .env 中 LLM_MODEL（当前={chosen_model}）是否为有效的推理接入点 ID（ep-xxx）或模型名。"
    )


_EXTRACT_PROMPT = """你是一名专业的知识图谱构建助手。请根据给定的课程文档文本，抽取课程知识图谱的"节点"和"关系"。
要求：
1. 节点必须有 name（知识点名称）、category（类别：从 [基础概念,核心概念,协议,算法,设备,应用] 中选一个最贴近的）、description（1-2 句话简介）、difficulty（1-5 数字，越大越难）。
2. 关系必须说明关系类型 type（例如：先修 / 属于 / 包含 / 基于 / 依赖 / 协同 / 服务于 / 上层 / 关联，若都不合适则"关联"）和 label（对人类可读的简短描述）。
3. 关系的方向：先修关系中，source 是被依赖的（先修）知识点，target 是后续知识点；包含关系中 source 是父节点，target 是子节点。
4. 只输出 JSON，不要任何解释。JSON 结构严格为：
{
  "nodes": [{"id": "请省略此字段，后端会自动生成稳定id", "name": "...", "category": "...", "description": "...", "difficulty": 3}],
  "relations": [{"id": "同样省略", "source_node_name": "...", "target_node_name": "...", "type": "...", "label": "..."}],
  "summary": "一句话说明抽取出的规模"
}
请不要在 nodes/relations 中写 id 字段；在 relations 里请写 source_node_name / target_node_name（即节点名）而不是编号。
如果文本很短或信息不足，也请至少抽取出 3 个节点、1 条关系作为最小可用图谱。"""


async def extract_knowledge_graph(text: str, max_chars: int = 12000) -> ExtractResult:
    if not _llm_available():
        return _extract_offline(text)

    trunk = text[:max_chars]
    messages = [
        {"role": "system", "content": _EXTRACT_PROMPT},
        {"role": "user", "content": trunk},
    ]
    try:
        raw = await _chat_completion(messages, temperature=0.1)
    except Exception as e:
        # LLM 失败不阻断流程：回退离线
        fallback = _extract_offline(text)
        fallback.raw_summary = f"LLM 调用失败（{e}），已回退离线抽取。" + fallback.raw_summary
        return fallback

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        fallback = _extract_offline(text)
        fallback.raw_summary = f"LLM JSON 解析失败，已回退离线抽取。LLM 原始输出：{raw[:200]}"
        return fallback

    nodes_raw = data.get("nodes") or []
    rels_raw = data.get("relations") or []
    name_to_id: dict[str, str] = {}
    nodes: list[dict[str, Any]] = []
    for n in nodes_raw:
        name = (n.get("name") or "").strip()
        if not name:
            continue
        nid = _stable_id(name)
        name_to_id[name] = nid
        nodes.append({
            "id": nid,
            "name": name,
            "category": (n.get("category") or _guess_category(name)).strip() or "核心概念",
            "description": (n.get("description") or name).strip(),
            "difficulty": float(n.get("difficulty") or 3.0),
        })

    rels: list[dict[str, Any]] = []
    for r in rels_raw:
        src = (r.get("source_node_name") or r.get("source") or "").strip()
        tgt = (r.get("target_node_name") or r.get("target") or "").strip()
        if not src or not tgt:
            continue
        if src not in name_to_id:
            nid = _stable_id(src)
            name_to_id[src] = nid
            nodes.append({
                "id": nid, "name": src,
                "category": _guess_category(src),
                "description": src, "difficulty": 3.0,
            })
        if tgt not in name_to_id:
            nid = _stable_id(tgt)
            name_to_id[tgt] = nid
            nodes.append({
                "id": nid, "name": tgt,
                "category": _guess_category(tgt),
                "description": tgt, "difficulty": 3.0,
            })
        sid, tid = name_to_id[src], name_to_id[tgt]
        if sid == tid:
            continue
        rtype = (r.get("type") or "关联").strip()
        label = (r.get("label") or rtype).strip()
        rid = "r" + hashlib.md5(f"{sid}_{tid}_{rtype}".encode()).hexdigest()[:8]
        rels.append({
            "id": rid, "source": sid, "target": tid,
            "type": rtype, "label": label,
        })

    return ExtractResult(
        nodes=nodes,
        relations=rels,
        used_llm=True,
        raw_summary=str(data.get("summary") or f"LLM 抽取 {len(nodes)} 个节点，{len(rels)} 条关系。"),
    )


# ---------------- RAG 问答 ----------------
_QA_PROMPT = """你是《计算机网络》或相关 AIGC 课程的助教，回答需要基于给定的"知识点上下文"。
上下文（JSON）：
__CONTEXT__

用户问题：
__QUESTION__

要求：
1. 回答要分三段：① 直接答案（2-3 句）② 知识点依据（引用上下文中的节点名和类别）③ 建议进一步学习的 1-3 个相关知识点。
2. 如果上下文完全无关，诚实说明"当前知识库未覆盖该问题"。
3. 只输出 JSON：{"answer": "三段合并成 Markdown 字符串"}。"""


def _tokenize_chinese(text: str) -> list[str]:
    """中文优先走 jieba（如安装），否则 2-gram + 长度≥2 的标点/符号切分兜底。"""
    text = text or ""
    tokens: set[str] = set()
    # 1) jieba
    try:
        import jieba  # type: ignore

        for w in jieba.cut(text):
            w = w.strip()
            if len(w) >= 1:
                tokens.add(w)
                if len(w) >= 3:
                    # 再切出 2-gram 作为模糊兜底
                    for i in range(len(w) - 1):
                        tokens.add(w[i : i + 2])
    except Exception:
        pass

    # 2) 标点/空白切分（原行为兜底，保留英文完整词）
    import re as _re

    segs = [s.strip() for s in _re.split(r"[\s,，。.？！!?;:：；、（）()《》\"'“”‘’\-/\\]+", text) if s.strip()]
    for seg in segs:
        tokens.add(seg)
        # 2-gram 中文检索
        if all("\u4e00" <= ch <= "\u9fff" or ch.isdigit() for ch in seg) and len(seg) >= 2:
            for i in range(len(seg) - 1):
                tokens.add(seg[i : i + 2])

    return [t for t in tokens if t]


def _retrieve_context(question: str, nodes: list[Any]) -> list[Any]:
    """关键词检索：结合 jieba + 2-gram 中文切分，Top-K 命中节点。"""
    q_tokens = _tokenize_chinese(question)
    if not q_tokens:
        return []
    scored: list[tuple[float, Any]] = []
    for n in nodes:
        text = (n.name + " " + (n.description or "") + " " + (n.category or "")).lower()
        name_lower = n.name.lower()
        score = 0.0
        for kw in q_tokens:
            if not kw:
                continue
            kw_low = kw.lower()
            if kw_low not in text:
                continue
            # name 命中权重远高于 description
            if kw_low in name_lower:
                weight = 8 if len(kw) >= 2 else 2
            else:
                weight = 2 if len(kw) >= 2 else 0.3
            score += weight
        if score > 0:
            scored.append((score, n))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [n for _, n in scored[:8]]


async def answer_question(
    question: str,
    all_nodes: list[Any],  # ORM KGNode list
    use_llm: bool | None = None,
) -> tuple[str, list[Any], bool]:
    """返回 (answer_text, related_nodes, used_llm)"""
    related = _retrieve_context(question, all_nodes)

    # 如果没有 LLM key 或用户强制关闭，走本地拼接
    if use_llm is False or not _llm_available():
        answer = _answer_offline(question, related)
        return answer, related, False

    # 构造上下文
    ctx = [
        {"id": n.id, "name": n.name, "category": n.category,
         "description": (n.description or "")[:300], "difficulty": n.difficulty}
        for n in related
    ]
    if not ctx:
        return (
            "当前知识库暂未收录与该问题相关的内容，建议先上传课程文档进行解析以扩展知识图谱。",
            [],
            False,
        )

    user_msg = (_QA_PROMPT
                .replace("__CONTEXT__", json.dumps(ctx, ensure_ascii=False))
                .replace("__QUESTION__", question))
    messages = [
        {"role": "system", "content": "你是一名有耐心的课程助教，仅以 JSON 格式回答。"},
        {"role": "user", "content": user_msg},
    ]
    try:
        raw = await _chat_completion(messages, temperature=0.4)
        data = json.loads(raw)
        ans = data.get("answer") or raw
    except Exception as e:
        ans = _answer_offline(question, related) + f"\n\n> （LLM 调用失败：{e}，已回退本地摘要）"
        return ans, related, False
    return ans, related, True


def _answer_offline(question: str, related: list[Any]) -> str:
    if not related:
        return "当前知识库暂未收录与该问题相关的内容，建议先上传课程文档进行解析以扩展知识图谱。"
    head = related[:3]
    lines = [
        f"### 直接答案\n根据当前知识图谱，与「{question}」最相关的知识点是："
        + "、".join(f"**{n.name}**（{n.category}）" for n in head) + "。\n",
        "### 知识点依据",
    ]
    for n in head:
        lines.append(f"- **{n.name}** [{n.category}]：{n.description or '暂无描述'}")
    rest = related[3:6]
    if rest:
        lines.append("\n### 建议进一步学习")
        lines.append("、".join(f"**{n.name}**" for n in rest))
    return "\n".join(lines)


# ---------------- AIGC 主题生成图谱 ----------------
_GENERATE_PROMPT = """你是一名专业的课程知识图谱设计师。请围绕用户给定的「课程主题」，生成一份结构完整、层次清晰的知识图谱（节点 + 关系），用于驱动可视化与学习导航。

主题：__TOPIC__

要求：
1. 节点：覆盖该主题的核心概念、子主题、关键方法/算法、典型应用等，规模在 15~40 个之间。
2. 每个节点必须有 name（知识点名称）、category（从 [基础概念,核心概念,协议,算法,设备,应用] 中选最贴近的一个）、description（1-2 句简介）、difficulty（1-5 数字，越大越难）。
3. 关系：节点间至少建立 15 条关系，类型从 [先修,属于,包含,基于,依赖,协同,服务于,关联] 中选择最合适的，并给出 label（人类可读的简短说明）。
4. 方向：先修关系中 source 是被依赖的前置知识，target 是后续知识；包含关系中 source 是父节点，target 是子节点。
5. 只输出 JSON，不要解释。结构严格为：
{
  "nodes": [{"name": "...", "category": "...", "description": "...", "difficulty": 3}],
  "relations": [{"source_node_name": "...", "target_node_name": "...", "type": "...", "label": "..."}],
  "summary": "一句话说明生成规模"
}
不要在 nodes/relations 中写 id 字段；relations 用 source_node_name / target_node_name。"""


def _normalize_llm_graph(data: dict) -> ExtractResult:
    """把 LLM 返回的图谱 JSON 规整成 ExtractResult（自动生成稳定 id）。

    兼容两种典型输出风格：
    A) 官方推荐：nodes 不带 id、relations 用 source_node_name / target_node_name（按 name 关联）
    B) Doubao-seed 风格：nodes 自带 id（形如 nXXXX）、relations 用 source/target（按 id 关联）
    """
    nodes_raw = data.get("nodes") or []
    rels_raw = data.get("relations") or []
    name_to_id: dict[str, str] = {}
    id_to_name: dict[str, str] = {}
    nodes: list[dict[str, Any]] = []
    for n in nodes_raw:
        name = (n.get("name") or "").strip()
        if not name:
            continue
        # 若 LLM 已经给了节点 id，优先沿用（保证与 relations 的 source/target 一致）；
        # 否则按 name 生成稳定 id
        given_id = (n.get("id") or "").strip()
        nid = given_id if given_id else _stable_id(name)
        if name in name_to_id:
            continue
        name_to_id[name] = nid
        if nid:
            id_to_name[nid] = name
        nodes.append({
            "id": nid,
            "name": name,
            "category": (n.get("category") or _guess_category(name)).strip() or "核心概念",
            "description": (n.get("description") or name).strip(),
            "difficulty": float(n.get("difficulty") or 3.0),
        })

    def _resolve(node_ref: str) -> tuple[str, str] | None:
        """把 relation 里的节点引用（可能是 name，也可能是 id）解析成 (id, name)。
        找不到时自动创建一个新的「裸节点」保底，避免整条边丢失。"""
        node_ref = (node_ref or "").strip()
        if not node_ref:
            return None
        # 1) 引用恰好是某节点 id（Doubao-seed 风格）
        if node_ref in id_to_name:
            return node_ref, id_to_name[node_ref]
        # 2) 引用恰好是某节点 name
        if node_ref in name_to_id:
            return name_to_id[node_ref], node_ref
        # 3) 引用像 id 形式但找不到节点 → 把它当 name 生成裸节点
        nid = _stable_id(node_ref)
        name_to_id[node_ref] = nid
        id_to_name[nid] = node_ref
        nodes.append({
            "id": nid, "name": node_ref, "category": _guess_category(node_ref),
            "description": node_ref, "difficulty": 3.0,
        })
        return nid, node_ref

    rels: list[dict[str, Any]] = []
    for r in rels_raw:
        src_ref = (r.get("source_node_name") or r.get("source") or "").strip()
        tgt_ref = (r.get("target_node_name") or r.get("target") or "").strip()
        s = _resolve(src_ref)
        t = _resolve(tgt_ref)
        if not s or not t:
            continue
        sid, _sname = s
        tid, _tname = t
        if sid == tid:
            continue
        rtype = (r.get("type") or "关联").strip()
        label = (r.get("label") or rtype).strip()
        rid = "r" + hashlib.md5(f"{sid}_{tid}_{rtype}".encode()).hexdigest()[:8]
        rels.append({"id": rid, "source": sid, "target": tid, "type": rtype, "label": label})

    return ExtractResult(
        nodes=nodes,
        relations=rels,
        used_llm=True,
        raw_summary=str(data.get("summary") or f"生成 {len(nodes)} 个节点，{len(rels)} 条关系。"),
    )


async def generate_graph_by_topic(topic: str, model: str | None = None) -> ExtractResult:
    """围绕课程主题，调用 LLM 直接生成知识图谱（不依赖文档文本）。"""
    topic = (topic or "").strip()
    if not topic:
        return ExtractResult(nodes=[], relations=[], used_llm=False, raw_summary="主题为空。")
    if not _llm_available():
        return ExtractResult(
            nodes=[], relations=[], used_llm=False,
            raw_summary="未配置 LLM_API_KEY，无法进行 AIGC 主题生成。请在后端 .env 填入有效 key。",
        )

    messages = [
        {"role": "system", "content": _GENERATE_PROMPT.replace("__TOPIC__", topic)},
        {"role": "user", "content": f"请围绕课程主题「{topic}」生成知识图谱。"},
    ]
    try:
        raw = await _chat_completion(messages, temperature=0.4, model=model)
    except Exception as e:
        return ExtractResult(
            nodes=[], relations=[], used_llm=False,
            raw_summary=f"LLM 调用失败：{e}",
        )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # 兜底：尝试抽取 JSON 片段
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            return ExtractResult(
                nodes=[], relations=[], used_llm=False,
                raw_summary=f"LLM 返回非 JSON，已中止。原始输出：{raw[:300]}",
            )
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return ExtractResult(
                nodes=[], relations=[], used_llm=False,
                raw_summary=f"LLM JSON 解析失败。原始输出：{raw[:300]}",
            )
    result = _normalize_llm_graph(data)
    result.raw_summary = (data.get("summary") or result.raw_summary)
    return result


# ---------------- AIGC 学习资源建议 ----------------
_RESOURCE_PROMPT = """你是课程学习顾问。请针对给定的知识点，生成一份「相关学习资源」建议清单，帮助学生高效学习。

知识点：__NAME__
类别：__CATEGORY__
简介：__DESC__

要求：输出 5~8 条资源建议，覆盖不同学习形态。每条包含：
- type：资源类型，从 [教材章节, 视频课程, 图文教程, 练习实践, 拓展阅读, 工具/平台] 中选一个
- title：资源标题（具体可执行，如「《xxx》第 N 章：小节名」「B站搜索关键词：xxx」）
- reason：为什么推荐这条资源来学这个知识点（1 句话）
- url：若有公网入口给一个搜索链接（如 https://www.bilibili.com/search?keyword=xxx 的形式），否则留空字符串

只输出 JSON：{"items": [{"type":"...","title":"...","reason":"...","url":"..."}], "summary":"一句话总览"}"""


async def suggest_learning_resources(
    node_name: str,
    category: str = "",
    description: str = "",
    model: str | None = None,
) -> dict:
    """调用 LLM 为单个知识点生成学习资源建议，返回 {"items": [...], "summary": "...", "used_llm": bool}。"""
    node_name = (node_name or "").strip()
    if not node_name:
        return {"items": [], "summary": "知识点名称为空。", "used_llm": False}
    if not _llm_available():
        return {
            "items": [],
            "summary": "未配置 LLM_API_KEY，无法生成学习资源建议。",
            "used_llm": False,
        }

    user_msg = (
        _RESOURCE_PROMPT
        .replace("__NAME__", node_name)
        .replace("__CATEGORY__", category or "未分类")
        .replace("__DESC__", (description or "").strip() or "暂无简介")
    )
    messages = [
        {"role": "system", "content": "你是一名有耐心的课程学习顾问，仅以 JSON 格式回答。"},
        {"role": "user", "content": user_msg},
    ]
    try:
        raw = await _chat_completion(messages, temperature=0.5, model=model)
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", raw)
        try:
            data = json.loads(m.group(0)) if m else {}
        except Exception:
            data = {}
    except Exception as e:
        return {"items": [], "summary": f"LLM 调用失败：{e}", "used_llm": False}

    items = data.get("items") or []
    return {
        "items": items,
        "summary": str(data.get("summary") or ""),
        "used_llm": True,
    }
