import requests, json
B='http://127.0.0.1:8000/api'
qs=[
  ('Q1 洛必达+柯西','洛必达法则和柯西中值定理有什么关系？为什么能用洛必达算 0/0 型极限？'),
  ('Q2 微积分基本定理+牛顿莱布尼茨','如何理解微积分基本定理？它和牛顿莱布尼茨公式有什么关系？定积分和不定积分是怎么联系起来的？'),
  ('Q3 偏导数基础','学习偏导数之前需要掌握什么基础？和一元函数求导/链式法则的关系是什么？')
]
for t,q in qs:
    a=requests.post(f'{B}/qa/ask', json={'question':q,'user_id':'u1','use_llm':False}, timeout=180).json()
    print('\n===', t, ' use_llm=', a['used_llm'], ' related=', len(a.get('related_nodes',[])), ' ===')
    for n in a.get('related_nodes',[])[:6]: print(' -', (n.get('name') or '')[:80])
    print('--- Answer 前 600 字 ---')
    print(a['answer'][:600])
