"""Manual Ark connection check. Set LLM_API_KEY in .env before running it."""
import os

import httpx

url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
api_key = os.environ.get("LLM_API_KEY", "")
if not api_key:
    raise SystemExit("LLM_API_KEY is not set. Copy .env.example to .env and configure it first.")
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}
payload = {
    "model": "doubao-1-5-pro-32k-250115",
    "messages": [{"role": "user", "content": "回复一个字：好"}],
    "temperature": 0.2,
}
try:
    r = httpx.post(url, headers=headers, json=payload, timeout=60)
    print("STATUS", r.status_code)
    print("BODY", r.text[:1200])
except Exception as e:
    print("EXC", type(e).__name__, str(e))
