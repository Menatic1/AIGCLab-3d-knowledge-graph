"""
批量语音合成（edge-tts）。读取 JSON 任务文件，逐条合成 mp3。
用法: python tts.py <jobs.json>
jobs.json: {"voice": "...", "rate": "+6%", "items": [{"id": "...", "text": "...", "out": "..."}]}
"""
import asyncio
import json
import sys
import edge_tts


async def synth(voice, rate, text, out):
    for attempt in range(3):
        try:
            comm = edge_tts.Communicate(text, voice, rate=rate)
            await comm.save(out)
            return True
        except Exception as e:
            if attempt == 2:
                print(f"FAIL {out}: {e}", file=sys.stderr)
                return False
            await asyncio.sleep(1.5 * (attempt + 1))
    return False


async def main():
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        job = json.load(f)
    voice = job['voice']
    rate = job.get('rate', '+0%')
    ok, fail = 0, 0
    for item in job['items']:
        if await synth(voice, rate, item['text'], item['out']):
            ok += 1
            print(f"OK  {item['id']}")
        else:
            fail += 1
    print(f"DONE ok={ok} fail={fail}")


asyncio.run(main())