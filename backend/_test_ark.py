import httpx

url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
headers = {
    "Authorization": "Bearer ark-f6c949d1-17c8-41c0-8446-03d7f7b7f84a-98ba9",
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
