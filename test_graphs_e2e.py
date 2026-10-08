"""端到端测试：图谱独立存储 + 列表 + 节点ID不冲突。放在 backend 外避免触发 reload。"""
import urllib.request, json, uuid

base = 'http://localhost:8000'

def post(path, body=None, token=None):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data, headers=headers, method='POST')
    raw = urllib.request.urlopen(req).read().decode()
    return json.loads(raw)

def get(path, token=None):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base + path, headers=headers)
    raw = urllib.request.urlopen(req).read().decode()
    return json.loads(raw)

# 1) 注册+登录
u = 'test_' + uuid.uuid4().hex[:6]
creds = {'username': u, 'password': '123456'}
post('/api/auth/register', creds)
token = post('/api/auth/login', creds)['token']
print('用户:', u)

# 2) 初始图谱列表应为空
gl = get('/api/graphs', token)
print('初始图谱数:', len(gl))

# 3) 加载示例图谱
sample = post('/api/graph/seed-sample', token=token)
print('示例图谱加载: nodes=%d rels=%d' % (len(sample['nodes']), len(sample['relations'])))

# 4) AIGC生成（离线兜底，LLM_API_KEY为空）
aigc = post('/api/aigc/generate', {'topic': '高等数学'}, token=token)
print('AIGC生成: graph_id=%s nodes=%d rels=%d used_llm=%s' % (
    aigc.get('graph_id', '')[:12], aigc.get('nodes_count', 0),
    aigc.get('relations_count', 0), aigc.get('used_llm')))

# 5) 查图谱列表
gl = get('/api/graphs', token)
print('\n图谱列表 (%d 份):' % len(gl))
for g in gl:
    print('  - %s | %s | nodes=%d rels=%d | source=%s' % (
        g['id'][:16], g['title'], g['nodes_count'], g['relations_count'], g['source']))

# 6) 节点ID冲突检查（核心bug验证）
if len(gl) >= 2:
    d1 = get('/api/graphs/' + gl[0]['id'], token)
    d2 = get('/api/graphs/' + gl[1]['id'], token)
    ids1 = {n['id'] for n in d1['nodes']}
    ids2 = {n['id'] for n in d2['nodes']}
    common = ids1 & ids2
    print('\n节点ID冲突检查: A=%d B=%d 冲突=%d' % (len(ids1), len(ids2), len(common)))
    print('结果:', 'OK 无冲突（节点ID独立）' if len(common) == 0 else 'FAIL 有冲突')
    print('图谱A节点ID样本:', list(ids1)[:3])
    print('图谱B节点ID样本:', list(ids2)[:3])
