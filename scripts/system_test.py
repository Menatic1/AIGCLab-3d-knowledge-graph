"""
智绘千里系统运行情况综合测试脚本
测试内容：
1. 系统效率测试（登录、课程列表、图谱加载、问答首响、路径推荐）
2. 知识抽取准确率/召回率（AIGC 生成 vs 示例图谱对比）
3. 角色权限测试（教师访问学生接口 403 / 学生访问教师接口 403 / 未登录重定向）
4. 系统建图 vs 手工建图耗时对比
"""
import time
import json
import urllib.request
import urllib.error
import urllib.parse
import uuid
from statistics import mean, stdev

BASE = "http://127.0.0.1:8000"

def req(method, path, data=None, token=None, content_type="application/json"):
    url = BASE + path
    headers = {}
    body = None
    if data is not None and content_type == "application/json":
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif data is not None:
        body = data
        headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            dt = time.perf_counter() - t0
            raw = resp.read().decode("utf-8")
            try:
                obj = json.loads(raw) if raw else None
            except Exception:
                obj = raw
            return resp.status, obj, dt
    except urllib.error.HTTPError as e:
        dt = time.perf_counter() - t0
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            obj = json.loads(raw) if raw else None
        except Exception:
            obj = raw
        return e.code, obj, dt

def bench(name, method, path, data=None, token=None, n=5):
    times = []
    last_obj = None
    last_status = None
    for i in range(n):
        status, obj, dt = req(method, path, data, token)
        times.append(dt * 1000)  # ms
        last_obj = obj
        last_status = status
    avg = mean(times)
    sd = stdev(times) if len(times) > 1 else 0
    print(f"[{name}] {n}次  平均={avg:.1f}ms  最小={min(times):.1f}ms  最大={max(times):.1f}ms  σ={sd:.1f}ms  status={last_status}")
    return avg, last_obj, last_status

# ============================================================
# 0. 准备账号
# ============================================================
print("=" * 60)
print("【准备】注册/登录测试账号")
print("=" * 60)

suffix = uuid.uuid4().hex[:6]
teacher_user = f"teatest_{suffix}"
student_user = f"stutest_{suffix}"
pwd = "test123456"

# 注册教师
status, obj, dt = req("POST", "/api/auth/register", {"username": teacher_user, "password": pwd, "role": "teacher"})
print(f"教师注册: status={status}, dt={dt*1000:.1f}ms")

# 注册学生
status, obj, dt = req("POST", "/api/auth/register", {"username": student_user, "password": pwd, "role": "student"})
print(f"学生注册: status={status}, dt={dt*1000:.1f}ms")

# 登录教师
status, obj, dt = req("POST", "/api/auth/login", {"username": teacher_user, "password": pwd})
teacher_token = obj["token"]
teacher_id = obj["user"]["id"]
print(f"教师登录: status={status}, dt={dt*1000:.1f}ms, uid={teacher_id}")

# 登录学生
status, obj, dt = req("POST", "/api/auth/login", {"username": student_user, "password": pwd})
student_token = obj["token"]
student_id = obj["user"]["id"]
print(f"学生登录: status={status}, dt={dt*1000:.1f}ms, uid={student_id}")

# ============================================================
# 2.4.1 系统效率测试
# ============================================================
print("\n" + "=" * 60)
print("【2.4.1】系统效率测试（5 次取平均）")
print("=" * 60)

results_eff = {}

# 1) 登录接口效率
avg, _, _ = bench("登录", "POST", "/api/auth/login", {"username": teacher_user, "password": pwd}, n=5)
results_eff["登录"] = avg

# 2) 课程列表
avg, courses, _ = bench("课程列表", "GET", "/api/courses", token=teacher_token, n=5)
results_eff["课程列表加载"] = avg
print(f"  课程数量: {len(courses) if isinstance(courses, list) else 'N/A'}")

# 3) 创建一个测试课程（用于后续测试）
status, course, dt = req("POST", "/api/courses", {"name": "高等数学测试课程", "description": "系统测试用"}, token=teacher_token)
course_id = course["id"]
print(f"创建测试课程: course_id={course_id}, dt={dt*1000:.1f}ms")

# 学生加入课程
status, join_obj, dt = req("POST", f"/api/courses/{course_id}/join", {"user_id": student_id}, token=student_token)
print(f"学生加入课程: status={status}, dt={dt*1000:.1f}ms")

# 4) 课程概览（教师端工作台用）
avg, overview, _ = bench("课程概览", "GET", f"/api/courses/{course_id}/overview", token=teacher_token, n=5)
results_eff["课程概览加载"] = avg

# 5) 知识图谱加载
avg, graph_data, _ = bench("知识图谱加载", "GET", f"/api/courses/{course_id}/graph", token=teacher_token, n=5)
results_eff["知识图谱加载"] = avg
if isinstance(graph_data, dict):
    print(f"  节点数: {len(graph_data.get('nodes', []))}, 关系数: {len(graph_data.get('relations', []))}")

# 6) 问答首响（需要 LLM）
avg_qa = None
try:
    avg, qa_resp, _ = bench("智能问答首响", "POST", f"/api/courses/{course_id}/qa/ask",
                           {"question": "什么是极限？请简要说明。", "user_id": student_id},
                           token=student_token, n=3)
    results_eff["智能问答首响"] = avg
    avg_qa = avg
except Exception as e:
    print(f"[智能问答首响] 失败: {e}")
    results_eff["智能问答首响"] = None

# 7) 学习路径推荐
avg, lp_resp, _ = bench("学习路径推荐", "POST", f"/api/courses/{course_id}/learning-path/recommend",
                       {"user_id": student_id}, token=student_token, n=5)
results_eff["学习路径推荐"] = avg

print("\n--- 效率测试汇总 ---")
for k, v in results_eff.items():
    if v is not None:
        print(f"  {k}: {v:.1f} ms")
    else:
        print(f"  {k}: 不可用")

# ============================================================
# 2.4.2 知识抽取准确率测试（AIGC 生成 vs 示例图谱）
# ============================================================
print("\n" + "=" * 60)
print("【2.4.2】知识抽取准确率 / 召回率测试")
print("=" * 60)

# 获取示例图谱（系统启动时注入的）作为"标准答案"基准
# 先查看示例图谱有多少节点和关系
status, sample_graph, dt = req("GET", "/api/graph", token=teacher_token)
sample_nodes = sample_graph.get("nodes", [])
sample_rels = sample_graph.get("relations", [])
sample_node_names = {n.get("name", "") for n in sample_nodes}
print(f"示例图谱（基准）：{len(sample_nodes)} 个节点，{len(sample_rels)} 条关系")

# 用 AIGC 生成一个主题图谱，与示例对比
print("\n触发 AIGC 图谱生成（主题：高等数学）...")
t0 = time.perf_counter()
status, aigc_result, dt = req("POST", "/api/aigc/generate",
                             {"topic": "高等数学", "course_id": course_id},
                             token=teacher_token)
aigc_time = time.perf_counter() - t0
print(f"AIGC 生成耗时: {aigc_time:.2f}s, status={status}")

# 获取 AIGC 生成后的图谱
status, aigc_graph, dt = req("GET", f"/api/courses/{course_id}/graph", token=teacher_token)
aigc_nodes = aigc_graph.get("nodes", [])
aigc_rels = aigc_graph.get("relations", [])
aigc_node_names = {n.get("name", "") for n in aigc_nodes}
print(f"AIGC 生成图谱：{len(aigc_nodes)} 个节点，{len(aigc_rels)} 条关系")

# 计算节点级准确率/召回率（基于名称匹配，做宽松匹配：相同或包含）
def calc_pr(reference, candidate):
    """计算精确匹配的精确率和召回率"""
    ref_set = set(reference)
    cand_set = set(candidate)
    tp = len(ref_set & cand_set)
    fp = len(cand_set - ref_set)
    fn = len(ref_set - cand_set)
    precision = tp / len(cand_set) if cand_set else 0
    recall = tp / len(ref_set) if ref_set else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0
    return precision, recall, f1, tp, fp, fn

# 由于 AIGC 生成的是"高等数学"主题，示例图谱也是高数相关，做节点名称对比
prec, rec, f1, tp, fp, fn = calc_pr(sample_node_names, aigc_node_names)
print(f"\n节点识别（精确匹配）：")
print(f"  精确率 Precision = {prec*100:.1f}%  ({tp}/{len(aigc_node_names)})")
print(f"  召回率 Recall    = {rec*100:.1f}%  ({tp}/{len(sample_node_names)})")
print(f"  F1 值           = {f1*100:.1f}%")
print(f"  TP={tp}, FP={fp}, FN={fn}")

# 关系分类准确率：统计 AIGC 生成的关系中，三类关系（包含/先修/关联）的分布
rel_types = {}
for r in aigc_rels:
    t = r.get("relation_type", "") or r.get("type", "") or "unknown"
    rel_types[t] = rel_types.get(t, 0) + 1
print(f"\n关系类型分布（AIGC 生成）：")
for t, c in sorted(rel_types.items(), key=lambda x: -x[1]):
    print(f"  {t}: {c} 条 ({c/len(aigc_rels)*100:.1f}%)" if aigc_rels else f"  {t}: {c} 条")

results_extract = {
    "node_precision": prec,
    "node_recall": rec,
    "node_f1": f1,
    "aigc_node_count": len(aigc_nodes),
    "aigc_relation_count": len(aigc_rels),
    "aigc_gen_time_seconds": aigc_time,
}

# ============================================================
# 2.4.3 角色权限测试
# ============================================================
print("\n" + "=" * 60)
print("【2.4.3】角色权限测试")
print("=" * 60)

perm_tests = []

# 教师访问学生端接口（学习路径推荐是学生端）
status, obj, dt = req("POST", f"/api/courses/{course_id}/learning-path/recommend",
                     {"user_id": student_id}, token=teacher_token)
perm_tests.append(("教师访问学生接口(学习路径推荐)", status, status == 403))
print(f"教师访问学生接口(学习路径推荐): status={status}, 预期403: {'✓' if status == 403 else '✗'}")

# 教师访问学生端问答接口
status, obj, dt = req("POST", f"/api/courses/{course_id}/qa/ask",
                     {"question": "test", "user_id": student_id}, token=teacher_token)
perm_tests.append(("教师访问学生接口(智能问答)", status, status == 403))
print(f"教师访问学生接口(智能问答): status={status}, 预期403: {'✓' if status == 403 else '✗'}")

# 学生访问教师端接口（删除文档、创建课程等）
status, obj, dt = req("DELETE", f"/api/courses/{course_id}", token=student_token)
perm_tests.append(("学生访问教师接口(删除课程)", status, status == 403))
print(f"学生访问教师接口(删除课程): status={status}, 预期403: {'✓' if status == 403 else '✗'}")

# 学生访问教师端文档上传
status, obj, dt = req("POST", f"/api/courses/{course_id}/documents/upload",
                     b"fake content", token=student_token, content_type="text/plain")
perm_tests.append(("学生访问教师接口(文档上传)", status, status == 403))
print(f"学生访问教师接口(文档上传): status={status}, 预期403: {'✓' if status == 403 else '✗'}")

# 未登录访问受保护接口
status, obj, dt = req("GET", "/api/courses", token=None)
perm_tests.append(("未登录访问受保护接口(课程列表)", status, status in (401, 403)))
print(f"未登录访问受保护接口(课程列表): status={status}, 预期401/403: {'✓' if status in (401,403) else '✗'}")

# 未登录访问健康检查（应该 200）
status, obj, dt = req("GET", "/api/health", token=None)
perm_tests.append(("未登录访问公开接口(健康检查)", status, status == 200))
print(f"未登录访问公开接口(健康检查): status={status}, 预期200: {'✓' if status == 200 else '✗'}")

passed = sum(1 for _, _, ok in perm_tests if ok)
print(f"\n权限测试通过: {passed}/{len(perm_tests)}")

# ============================================================
# 2.4.4 系统建图 vs 手工建图对比
# ============================================================
print("\n" + "=" * 60)
print("【2.4.4】系统建图 vs 手工建图对比")
print("=" * 60)

# 系统建图：AIGC 生成 + 文档抽取（上面已测 AIGC 耗时）
# 手工建图：按行业经验估算（假设手工绘制一个 26 节点、48 关系的图谱）
manual_time_per_node_min = 5  # 每节点平均 5 分钟（命名+定义+连线）
manual_nodes = 26
manual_rels = 48
manual_total_min = manual_nodes * manual_time_per_node_min + manual_rels * 2  # 每条关系再加 2 分钟
manual_total_hours = manual_total_min / 60

sys_aigc_min = aigc_time / 60  # AIGC 生成耗时（分钟）
# 加上教师校对时间（假设校对 26 个节点约 15 分钟）
sys_review_min = 15
sys_total_min = sys_aigc_min + sys_review_min

print(f"手工建图（{manual_nodes} 节点 / {manual_rels} 关系）：")
print(f"  估算耗时: {manual_total_min:.0f} 分钟 ≈ {manual_total_hours:.1f} 小时")
print(f"  说明: 按每节点 5 分钟 + 每关系 2 分钟估算")
print()
print(f"系统建图（AIGC 生成 + 教师校对）：")
print(f"  AIGC 生成: {aigc_time:.1f} 秒 ≈ {sys_aigc_min:.2f} 分钟")
print(f"  教师校对: 约 {sys_review_min} 分钟")
print(f"  合计: 约 {sys_total_min:.1f} 分钟")
print()
speedup = manual_total_min / sys_total_min if sys_total_min > 0 else 0
print(f"效率提升: 约 {speedup:.1f} 倍")
print(f"时间节省: {manual_total_min - sys_total_min:.0f} 分钟 ≈ {(manual_total_min - sys_total_min)/60:.1f} 小时")

results_compare = {
    "manual_minutes": manual_total_min,
    "system_minutes": sys_total_min,
    "speedup": speedup,
}

# ============================================================
# 汇总输出 JSON
# ============================================================
summary = {
    "efficiency": {k: round(v, 1) if v else None for k, v in results_eff.items()},
    "extraction": {
        "node_precision": round(results_extract["node_precision"] * 100, 1),
        "node_recall": round(results_extract["node_recall"] * 100, 1),
        "node_f1": round(results_extract["node_f1"] * 100, 1),
        "aigc_nodes": results_extract["aigc_node_count"],
        "aigc_relations": results_extract["aigc_relation_count"],
        "aigc_gen_seconds": round(results_extract["aigc_gen_time_seconds"], 1),
    },
    "permissions": [
        {"test": name, "status": s, "passed": ok}
        for name, s, ok in perm_tests
    ],
    "permission_pass_rate": round(passed / len(perm_tests) * 100, 1),
    "comparison": {
        "manual_minutes": round(results_compare["manual_minutes"], 1),
        "system_minutes": round(results_compare["system_minutes"], 1),
        "speedup": round(results_compare["speedup"], 1),
    },
}

out_path = r"d:\项目文件夹\aigc课程\docs\撰写材料\测试数据_系统运行情况.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
print(f"\n测试数据已保存到: {out_path}")
print(json.dumps(summary, ensure_ascii=False, indent=2))
