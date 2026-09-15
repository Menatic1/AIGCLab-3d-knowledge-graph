"""学习路径推荐：默认以「先修」关系构成 DAG，进行拓扑排序，再结合用户掌握状态、起点/终点过滤。"""
from __future__ import annotations

from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/learning-path", tags=["learning-path"])


def _build_dag(relations: list[models.KGRelation], prereq_types: set[str]) -> tuple[dict[str, list[str]], dict[str, int]]:
    """边方向：source 是先修 → source 完成才能学 target。
    对每个 target，记录它的前置节点（prereqs）和入度（拓扑排序用）。
    """
    # 把 "先修" 和用户指定的其它类型都视作"前置依赖"
    prereq_map: dict[str, list[str]] = defaultdict(list)
    out_edges: dict[str, list[str]] = defaultdict(list)
    in_deg: dict[str, int] = defaultdict(int)

    all_nodes: set[str] = set()
    for r in relations:
        all_nodes.add(r.source)
        all_nodes.add(r.target)
    for n in all_nodes:
        in_deg.setdefault(n, 0)
        prereq_map.setdefault(n, [])

    for r in relations:
        is_prereq = r.type in prereq_types
        if not is_prereq:
            continue
        prereq_map[r.target].append(r.source)
        out_edges[r.source].append(r.target)
        in_deg[r.target] += 1

    return prereq_map, in_deg, out_edges, all_nodes  # type: ignore[return-value]


def _topo_sort(all_nodes: set[str], in_deg: dict[str, int], out_edges: dict[str, list[str]]) -> list[str]:
    """Kahn 算法拓扑排序。存在环时，贪心取下一个最小度节点，保证输出稳定结果。"""
    deg = {n: in_deg.get(n, 0) for n in all_nodes}
    q = deque(sorted([n for n, d in deg.items() if d == 0]))
    order: list[str] = []
    while q:
        n = q.popleft()
        order.append(n)
        for nx in sorted(out_edges.get(n, [])):
            deg[nx] -= 1
            if deg[nx] == 0:
                q.append(nx)
    # 有环：剩余节点按度升序加入（退化情况）
    if len(order) < len(all_nodes):
        remaining = sorted([n for n in all_nodes if n not in order], key=lambda x: (deg.get(x, 0), x))
        order.extend(remaining)
    return order


@router.post("/recommend", response_model=schemas.LearningPathOut)
def recommend_path(payload: schemas.PathRecommendRequest, db: Session = Depends(get_db)):
    all_nodes_orm = db.query(models.KGNode).all()
    if not all_nodes_orm:
        raise HTTPException(400, "知识图谱为空，无法生成学习路径")
    node_map: dict[str, models.KGNode] = {n.id: n for n in all_nodes_orm}
    relations = db.query(models.KGRelation).all()

    # 掌握情况
    mastery_rows = (
        db.query(models.UserProgress)
        .filter(models.UserProgress.user_id == payload.user_id, models.UserProgress.mastered.is_(True))
        .all()
    )
    mastered_ids = {p.node_id for p in mastery_rows}

    prereq_types = set(t.lower() for t in (payload.prerequisite_relation_types or ["先修"]))
    # 关系 type 比较时先做小写归一
    norm_rels = []
    for r in relations:
        t_lower = (r.type or "").lower()
        nr = models.KGRelation(id=r.id, source=r.source, target=r.target, type=t_lower, label=r.label)
        norm_rels.append(nr)
    prereq_map, in_deg, out_edges, all_node_ids = _build_dag(norm_rels, prereq_types)

    # 如果图谱里没有先修边：退化为按难度升序 + 类别分组
    if not any(v for v in prereq_map.values()):
        order = sorted(
            list(node_map.keys()),
            key=lambda nid: (node_map[nid].difficulty, node_map[nid].category, node_map[nid].name),
        )
    else:
        order = _topo_sort(all_node_ids, in_deg, out_edges)

    # 过滤起点 / 终点 / 已掌握的（默认保留已掌握但标记，不跳过，便于显示全路径）
    if payload.start_node_id and payload.start_node_id in node_map:
        try:
            order = order[order.index(payload.start_node_id):]
        except ValueError:
            pass
    if payload.target_node_id and payload.target_node_id in node_map:
        try:
            order = order[: order.index(payload.target_node_id) + 1]
        except ValueError:
            pass

    order = [nid for nid in order if nid in node_map][: max(1, payload.max_items)]

    steps: list[schemas.PathStep] = []
    for nid in order:
        n = node_map[nid]
        prereqs = prereq_map.get(nid, []) or []
        # 推荐理由：根据先修未掌握情况给出定制化理由
        missing = [p for p in prereqs if p not in mastered_ids and p in node_map]
        if nid in mastered_ids:
            reason = "已掌握，可快速复习或跳过。"
        elif missing:
            names = [node_map[p].name for p in missing[:3]]
            reason = f"建议先掌握：{'、'.join(names)}。"
        elif prereqs:
            reason = "先修已全部掌握，可以进入本知识点学习。"
        else:
            reason = "基础入门知识点，无前置依赖，适合开始。"

        steps.append(schemas.PathStep(
            node_id=nid,
            name=n.name,
            category=n.category,
            description=n.description,
            mastered=nid in mastered_ids,
            prerequisites=[p for p in prereqs if p in node_map],
            reason=reason,
        ))

    remaining = sum(1 for s in steps if not s.mastered)
    return schemas.LearningPathOut(
        steps=steps,
        total_steps=len(steps),
        remaining=remaining,
    )
