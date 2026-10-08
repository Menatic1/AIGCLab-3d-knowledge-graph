"""smoke_test.py: 快速端到端测试核心模块。
Run with: backend\\.venv\\Scripts\\python.exe scripts\\smoke_test.py
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import io
import uuid

BASE = "http://127.0.0.1:8000"


def request(method, path, body=None, files=None, headers=None):
    url = BASE + path
    h = {"Accept": "application/json"}
    if headers:
        h.update(headers)
    data = None
    if files:
        # multipart/form-data
        boundary = "----TestBoundary" + uuid.uuid4().hex
        h["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        buf = io.BytesIO()
        for fname, (filename, content_bytes, ctype) in files.items():
            buf.write(f"--{boundary}\r\n".encode())
            buf.write(
                f'Content-Disposition: form-data; name="{fname}"; filename="{filename}"\r\n'.encode()
            )
            buf.write(f"Content-Type: {ctype}\r\n\r\n".encode())
            buf.write(content_bytes)
            buf.write(b"\r\n")
        if body and isinstance(body, dict):
            for k, v in body.items():
                buf.write(f"--{boundary}\r\n".encode())
                buf.write(f'Content-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        buf.write(f"--{boundary}--\r\n".encode())
        data = buf.getvalue()
    elif body is not None:
        h["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            ct = resp.headers.get("Content-Type", "")
            code = resp.getcode()
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        code = e.code
        ct = ""
    parsed = None
    try:
        if raw and "json" in ct.lower() or raw.lstrip().startswith(("{", "[")):
            parsed = json.loads(raw)
    except Exception:
        parsed = None
    return code, parsed, raw


checks = []


def check(name, cond, detail=""):
    ok = "OK " if cond else "FAIL"
    checks.append((ok, name, detail))
    print(f"[{ok}] {name}  {detail}")


# 1. Health
code, body, _ = request("GET", "/api/health")
check("1. Health", code == 200 and body and body.get("ok") is True, str(body))

# 2. Graph GET（首次启动时启动阶段的 seed-sample 已注入 26 节点 48 关系）
code, body, _ = request("GET", "/api/graph")
check("2.1 GET /api/graph nodes>=26", code == 200 and isinstance(body, dict) and len(body.get("nodes", [])) >= 26,
      f"nodes={len(body.get('nodes', [])) if isinstance(body, dict) else 'n/a'}")
check("2.2 GET /api/graph relations>=40", isinstance(body, dict) and len(body.get("relations", [])) >= 40,
      f"relations={len(body.get('relations', [])) if isinstance(body, dict) else 'n/a'}")

# 3. stats
code, body, _ = request("GET", "/api/graph/stats/categories")
check("3. GET category stats", code == 200 and isinstance(body, list) and len(body) >= 4, f"count={len(body) if isinstance(body, list) else 'n/a'}")

# 4. Document upload + extract（上传一个中文 txt，看是否抽取到节点）
sample_text = """
第1章 绪论
1.1 什么是计算机网络
计算机网络就是把分布在不同地理区域的计算机与专门的外部设备用通信线路互连成一个规模大、功能强的网络系统。
1.2 计算机网络的发展
ARPANET 是互联网的前身。
第2章 物理层
2.1 通信基础
奈奎斯特准则与香农定理是计算信道极限数据传输率的理论基础。
2.2 传输介质
双绞线、同轴电缆、光纤、无线。
第3章 数据链路层
3.1 CRC 循环冗余校验
CRC校验是一种常用的检错方法，基于多项式除法。
3.2 以太网
以太网使用 CSMA/CD 协议进行介质访问控制。
第4章 网络层
4.1 IP 协议
IP 协议提供无连接、尽力而为的交付。
4.2 子网划分
子网划分通过借用主机位实现。
"""
files = {"file": ("chapter_demo.txt", sample_text.encode("utf-8"), "text/plain")}
code, body, raw = request("POST", "/api/documents/upload", files=files)
check("4.1 POST /documents/upload status 200", code == 200, f"code={code} body={raw[:200]}")
if isinstance(body, dict):
    check("4.2 抽取 nodes_count > 0", body.get("nodes_count", 0) > 0,
          f"nodes={body.get('nodes_count')} rels={body.get('relations_count')} status={body.get('extract_status')}")

# 5. Progress upsert
code, body, _ = request("PUT", "/api/progress", body={
    "user_id": "smoke",
    "items": [
        {"node_id": "n1", "mastered": True, "score": 90},
        {"node_id": "n2", "mastered": True, "score": 85},
        {"node_id": "n7", "mastered": False, "score": 50},
    ],
})
check("5.1 PUT /api/progress 200", code == 200)
if isinstance(body, dict):
    check("5.2 mastered=2 in snapshot", body.get("mastered") == 2, f"body.mastered={body.get('mastered')} total={body.get('total')}")

# 6. Learning-path recommend（smoke 用户，已知 n1/n2 掌握）
code, body, _ = request("POST", "/api/learning-path/recommend", body={
    "user_id": "smoke",
    "max_items": 20,
    "prerequisite_relation_types": ["先修", "前置", "prerequisite", "依赖"],
})
check("6.1 POST learning-path 200", code == 200)
if isinstance(body, dict):
    steps = body.get("steps") or []
    # 拓扑合法性：所有「先修」边，source 节点在 steps 中的下标必须 < target 的下标
    code_g, graph_body, _ = request("GET", "/api/graph")
    pos = {s["node_id"]: i for i, s in enumerate(steps)}
    violations = 0
    if isinstance(graph_body, dict):
        for r in graph_body.get("relations", []):
            if r.get("type") in {"先修", "前置", "依赖", "prerequisite"}:
                s, t = r["source"], r["target"]
                if s in pos and t in pos and pos[s] > pos[t]:
                    violations += 1
    check("6.2 steps 符合拓扑顺序（先修边 source 排前）",
          len(steps) >= 5 and violations == 0,
          f"steps={len(steps)} violations={violations}")
    check("6.3 mastered 已计入进度（至少两个已掌握）",
          sum(1 for s in steps if s["mastered"]) >= 2,
          f"mastered_in_path={sum(1 for s in steps if s['mastered'])}")
    check("6.4 remaining 合理（>0）", 0 < body.get("remaining", -1) <= 30, f"remaining={body.get('remaining')}")

# 7. QA ask（不带 LLM）
code, body, _ = request("POST", "/api/qa/ask", body={
    "question": "TCP 和 UDP 有什么区别？",
    "user_id": "smoke",
    "use_llm": False,
})
check("7.1 POST /qa/ask 200", code == 200)
if isinstance(body, dict):
    check("7.2 answer 含 TCP/UDP",
          isinstance(body.get("answer"), str) and "TCP" in body["answer"] and "UDP" in body["answer"],
          f"used_llm={body.get('used_llm')} related={len(body.get('related_nodes') or [])} ans.len={len(body.get('answer',''))}")

# 8. history
code, body, _ = request("GET", "/api/qa/history?user_id=smoke")
check("8. GET /qa/history", code == 200 and isinstance(body, list) and len(body) >= 1,
      f"hist={len(body) if isinstance(body, list) else 'n/a'}")

# 9. Graph seed-sample（幂等：再次写入不会报错，示例节点全部保留）
code, body, _ = request("POST", "/api/graph/seed-sample")
check("9. POST seed-sample 幂等（返回示例 26 节点）",
      code == 200 and isinstance(body, dict) and len(body.get("nodes", [])) >= 26,
      f"code={code} nodes={len(body.get('nodes', [])) if isinstance(body, dict) else 'n/a'}")

# 10. Adaptive learning loop
code, body, _ = request("POST", "/api/quiz/submit", body={
    "node_id": "n1", "correct_count": 2, "total_count": 3,
})
check("10.1 POST quiz submit", code == 200 and isinstance(body, dict) and body.get("passed") is True,
      f"code={code} accuracy={body.get('accuracy') if isinstance(body, dict) else 'n/a'}")
code, body, _ = request("PUT", "/api/learning/preference", body={"preference": "reinforce"})
check("10.2 PUT learning preference", code == 200 and isinstance(body, dict) and body.get("learning_preference") == "reinforce",
      f"code={code} preference={body.get('learning_preference') if isinstance(body, dict) else 'n/a'}")
code, body, _ = request("GET", "/api/learning/report")
check("10.3 GET learning report", code == 200 and isinstance(body, dict) and body.get("quiz_count", 0) >= 1,
      f"code={code} quizzes={body.get('quiz_count') if isinstance(body, dict) else 'n/a'}")
code, body, _ = request("GET", "/api/learning/recommendations?limit=5")
check("10.4 GET dynamic recommendations", code == 200 and isinstance(body, list) and len(body) > 0,
      f"code={code} recommendations={len(body) if isinstance(body, list) else 'n/a'}")

print()
total = len(checks)
ok_cnt = sum(1 for c in checks if c[0] == "OK ")
print(f"===== SMOKE TEST: {ok_cnt}/{total} PASSED =====")
if ok_cnt != total:
    for c in checks:
        if c[0] != "OK ":
            print(" -", c)
    sys.exit(1)
