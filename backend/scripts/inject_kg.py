"""Inject 高数图谱 into the frontend via a tiny HTTP endpoint at :8001.
Vite frontend on :5175 will call this from the page via eval to grab the kg JSON
and dispatch __inject_kg__ event on the window.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests

BACKEND = "http://127.0.0.1:8000/api"
KWS = [
    "函数","极限","导数","积分","中值","级数","微分","幂","无穷小",
    "连续","原函数","驻点","极值","偏导","换元","不定积分","定积分",
    "反常积分","罗尔","拉格朗日","柯西","洛必达","链式","麦克劳林",
    "费马","莱布尼茨","牛顿","初等","极值","全微分","二重",
]
TYPE_MAP = {"关联": "related", "先修": "prerequisite", "前置": "prerequisite", "包含": "contains",
            "相关概念": "related", "前置知识": "prerequisite", "应用": "related", "对比": "related"}
CAT_MAP = {"基础概念": "foundation", "核心概念": "concept", "协议": "protocol",
           "算法": "algorithm", "设备": "device", "应用": "application"}

def fetch_math_kg() -> dict:
    g = requests.get(f"{BACKEND}/graph", timeout=30).json()
    def math(n):
        hay = f"{n.get('name','')}{n.get('description','')}"
        return any(k in hay for k in KWS)
    nodes = [n for n in g.get("nodes", []) if math(n)]
    ids = {n["id"] for n in nodes}
    rels = [r for r in g.get("relations", []) if r["source"] in ids and r["target"] in ids]
    def cut(s, n=40):
        return (s or "")[:n]
    kg_nodes = [
        {"id": n["id"], "name": cut(n.get("name") or n.get("label") or "未知"),
         "category": CAT_MAP.get(n.get("category") or "核心概念", "concept"),
         "description": n.get("description") or n.get("name") or "",
         "difficulty": n.get("difficulty", 3)}
        for n in nodes
    ]
    kg_rels = [
        {"id": r["id"], "source": r["source"], "target": r["target"],
         "type": TYPE_MAP.get(r.get("type"), "related"),
         "label": r.get("label") or r.get("type") or ""}
        for r in rels
    ]
    return {
        "courseId": "math-001",
        "courseName": "高等数学（上册）",
        "chapterName": "第1~7章 · 函数极限/导数/中值定理/积分/级数/多元微分",
        "documentName": "高等数学教材样例.md",
        "extractedAt": __import__("datetime").datetime.now().isoformat(),
        "nodes": kg_nodes,
        "relations": kg_rels,
    }


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/kg", "/kg.json"):
            body = json.dumps(fetch_math_kg(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def log_message(self, fmt, *args):
        return


def serve(port=8001):
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print(f"inject_kg serving on http://127.0.0.1:{port}/kg")
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv


if __name__ == "__main__":
    s = serve()
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        s.shutdown()
