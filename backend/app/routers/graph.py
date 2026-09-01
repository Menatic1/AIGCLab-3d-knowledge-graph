"""图谱 CRUD + 统计 + 示例导入（旧版兼容路由 /api/graph）。

注意：图谱列表/详情/删除/改名请用新版 /api/graphs（见 routers/graphs.py）。
本路由主要保留给「单图谱节点/关系编辑」「示例加载」「按 user_id 兜底查询」。
"""
from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/graph", tags=["graph"])


# 示例图谱使用的固定 graph_id（便于前端「加载示例」按钮幂等）
SAMPLE_GRAPH_ID = "sample-graph"


# ---------- 示例图谱（和前端 sampleKnowledgeGraph.ts 对应，方便直接加载）----------
SAMPLE_NODES: list[dict] = [
    {"id": "n1", "name": "计算机网络", "category": "基础概念",
     "description": "利用通信设备和传输介质，将地理位置不同的自治计算机连接起来，通过功能完善的网络软件实现资源共享和信息传递的系统。", "difficulty": 1.5},
    {"id": "n2", "name": "OSI 七层模型", "category": "核心概念",
     "description": "国际标准化组织提出的开放系统互连参考模型，共7层：物理层、数据链路层、网络层、传输层、会话层、表示层、应用层。", "difficulty": 3.5},
    {"id": "n3", "name": "TCP/IP 四层模型", "category": "核心概念",
     "description": "因特网实际使用的分层体系：网络接口层、网际层(IP)、传输层(TCP/UDP)、应用层。", "difficulty": 3.2},
    {"id": "n4", "name": "封装与解封装", "category": "核心概念",
     "description": "数据在各层间传递时加上/剥去各层控制信息（首部/尾部）的过程，是分层协议协作的基础。", "difficulty": 2.8},
    {"id": "n5", "name": "TCP 协议", "category": "协议",
     "description": "面向连接的、可靠的、基于字节流的传输层协议，提供流量控制、拥塞控制、差错恢复等特性。", "difficulty": 4.0},
    {"id": "n6", "name": "UDP 协议", "category": "协议",
     "description": "无连接、不可靠的传输层协议，不保证报文顺序和到达，适合对实时性要求高的场景（直播、DNS 查询等）。", "difficulty": 2.5},
    {"id": "n7", "name": "IP 协议", "category": "协议",
     "description": "网际层核心协议，负责将数据包从源端路由到目的端，提供不可靠、无连接的尽力而为交付。", "difficulty": 3.6},
    {"id": "n8", "name": "HTTP 协议", "category": "协议",
     "description": "超文本传输协议，万维网数据通信的基础。常用方法 GET/POST/PUT/DELETE，基于 TCP 80 端口。", "difficulty": 2.6},
    {"id": "n9", "name": "HTTPS 协议", "category": "协议",
     "description": "在 HTTP 上加入 SSL/TLS 加密层后的安全版本，默认 TCP 443 端口，提供机密性、完整性、身份认证。", "difficulty": 3.8},
    {"id": "n10", "name": "DNS 协议", "category": "协议",
     "description": "域名系统，实现域名与 IP 地址之间的映射，采用 UDP 53 端口为主，递归+迭代查询。", "difficulty": 3.0},
    {"id": "n11", "name": "FTP 协议", "category": "协议",
     "description": "文件传输协议，用于在客户端和服务器之间传输文件，使用控制连接(21)和数据连接两个通道。", "difficulty": 2.0},
    {"id": "n12", "name": "ARP 协议", "category": "协议",
     "description": "地址解析协议，根据 IP 地址获取物理 MAC 地址，工作在数据链路层与网络层之间。", "difficulty": 3.0},
    {"id": "n13", "name": "ICMP 协议", "category": "协议",
     "description": "因特网控制报文协议，用于在 IP 网络中发送错误消息和操作信息（Ping、Tracert 基于它）。", "difficulty": 2.5},
    {"id": "n14", "name": "三次握手", "category": "核心概念",
     "description": "TCP 建立连接的过程：客户端 SYN → 服务器 SYN+ACK → 客户端 ACK，确保双方都具备收发能力。", "difficulty": 4.2},
    {"id": "n15", "name": "四次挥手", "category": "核心概念",
     "description": "TCP 释放连接的过程：FIN → ACK → FIN → ACK，由于 TCP 全双工需要分别关闭两个方向。", "difficulty": 4.3},
    {"id": "n16", "name": "滑动窗口", "category": "算法",
     "description": "TCP 用于流量控制和可靠传输的机制：发送方在未收到确认前可连续发送窗口内的字节。", "difficulty": 4.0},
    {"id": "n17", "name": "慢启动与拥塞避免", "category": "算法",
     "description": "TCP 拥塞控制两大阶段：慢启动指数增长窗口，拥塞避免线性增长，检测到丢包则回退。", "difficulty": 4.5},
    {"id": "n18", "name": "CRC 校验", "category": "算法",
     "description": "循环冗余校验，广泛用于数据链路层检测传输过程中产生的误码，基于多项式除法。", "difficulty": 3.0},
    {"id": "n19", "name": "RSA 算法", "category": "算法",
     "description": "经典非对称加密算法，基于大数分解难题，可用于加密与数字签名，HTTPS 证书常见算法之一。", "difficulty": 4.8},
    {"id": "n20", "name": "数字签名", "category": "算法",
     "description": "用于验证数据来源与完整性的密码学手段：发送方私钥签名，接收方公钥验证。", "difficulty": 4.0},
    {"id": "n21", "name": "路由器", "category": "设备",
     "description": "网络层设备，根据路由表选择最佳路径转发 IP 数据报，实现不同网络之间的互连。", "difficulty": 2.5},
    {"id": "n22", "name": "交换机", "category": "设备",
     "description": "数据链路层设备，根据 MAC 地址表转发以太网帧，支持 VLAN、端口速率自适应等。", "difficulty": 2.0},
    {"id": "n23", "name": "防火墙", "category": "设备",
     "description": "部署在网络边界的访问控制设备，按规则过滤进出流量，保护内网免受外部攻击。", "difficulty": 3.2},
    {"id": "n24", "name": "子网划分", "category": "算法",
     "description": "通过借用主机位作子网位，将一个大的 IP 网络划分为多个更小的子网，节约地址并便于管理。", "difficulty": 3.8},
    {"id": "n25", "name": "NAT 网络地址转换", "category": "协议",
     "description": "将内网私有 IP 与少数公网 IP 进行映射的技术，可缓解 IP 地址枯竭并隐藏内部拓扑。", "difficulty": 3.0},
    {"id": "n26", "name": "万维网 WWW", "category": "应用",
     "description": "基于 HTTP/HTML 的超文本信息系统，由文档、超链接和 URL 构成，是 Internet 最广泛的应用之一。", "difficulty": 1.5},
]

SAMPLE_RELATIONS: list[dict] = [
    ("r1", "n2", "n3", "对比", "OSI vs TCP/IP 对照"),
    ("r2", "n2", "n4", "包含", "OSI 每层封装"),
    ("r3", "n3", "n4", "包含", "TCP/IP 各层封装"),
    ("r4", "n3", "n5", "包含", "传输层协议 TCP"),
    ("r5", "n3", "n6", "包含", "传输层协议 UDP"),
    ("r6", "n3", "n7", "包含", "网际层 IP"),
    ("r7", "n3", "n8", "包含", "应用层 HTTP"),
    ("r8", "n8", "n9", "升级为", "HTTP + TLS = HTTPS"),
    ("r9", "n1", "n2", "基于", "以 OSI 为理论基础"),
    ("r10", "n1", "n3", "基于", "以 TCP/IP 为事实标准"),
    ("r11", "n5", "n14", "包含", "连接建立三次握手"),
    ("r12", "n5", "n15", "包含", "连接释放四次挥手"),
    ("r13", "n5", "n16", "包含", "流量控制-滑动窗口"),
    ("r14", "n5", "n17", "包含", "拥塞控制"),
    ("r15", "n7", "n12", "依赖", "IP 解析 MAC 用 ARP"),
    ("r16", "n7", "n13", "配套", "ICMP 用于 IP 网络诊断"),
    ("r17", "n7", "n24", "配套", "IP 地址规划子网划分"),
    ("r18", "n7", "n25", "配套", "IP 地址可通过 NAT 转换"),
    ("r19", "n8", "n26", "服务于", "HTTP 支持 WWW"),
    ("r20", "n9", "n19", "基于", "HTTPS 证书用 RSA 非对称加密"),
    ("r21", "n9", "n20", "基于", "HTTPS 使用数字签名认证身份"),
    ("r22", "n10", "n6", "依赖", "DNS 查询基于 UDP"),
    ("r23", "n11", "n5", "依赖", "FTP 数据通道基于 TCP"),
    ("r24", "n14", "n2", "属于", "属于传输层机制(OSI)"),
    ("r25", "n15", "n5", "属于", "属于 TCP 连接管理"),
    ("r26", "n16", "n5", "先修", "学滑动窗口前应了解 TCP 可靠传输"),
    ("r27", "n17", "n16", "先修", "拥塞控制建立在滑动窗口基础上"),
    ("r28", "n7", "n21", "运行于", "路由器转发 IP 数据报"),
    ("r29", "n2", "n22", "运行于", "交换机工作在数据链路层"),
    ("r30", "n1", "n23", "保护", "网络边界部署防火墙"),
    ("r31", "n4", "n5", "应用于", "TCP 分段是封装的体现"),
    ("r32", "n5", "n8", "承载", "HTTP 基于 TCP"),
    ("r33", "n5", "n9", "承载", "HTTPS 基于 TCP"),
    ("r34", "n8", "n10", "前置", "HTTP 请求前先做 DNS 解析"),
    ("r35", "n26", "n8", "依赖", "WWW 依赖 HTTP 协议"),
    ("r36", "n21", "n22", "连接", "路由器下接交换机"),
    ("r37", "n22", "n12", "使用", "交换机用 MAC 地址表 → ARP 获取 MAC"),
    ("r38", "n18", "n1", "保障", "CRC 校验检测误码"),
    ("r39", "n14", "n15", "关联", "三次握手建立，四次挥手释放"),
    ("r40", "n19", "n20", "属于", "数字签名常见由 RSA 实现"),
    ("r41", "n24", "n7", "先修", "学子网划分前应先理解 IP 编址"),
    ("r42", "n25", "n7", "先修", "NAT 建立在 IP 地址结构之上"),
    ("r43", "n18", "n2", "属于", "CRC 通常在数据链路层执行"),
    ("r44", "n23", "n9", "协同", "防火墙常放行 HTTPS 443 端口"),
    ("r45", "n3", "n10", "包含", "DNS 是应用层协议之一"),
    ("r46", "n3", "n11", "包含", "FTP 是应用层协议之一"),
    ("r47", "n1", "n26", "核心应用", "WWW 是典型应用"),
    ("r48", "n23", "n21", "部署于", "防火墙部署在路由器边界"),
]


def _upsert_sample(db: Session, *, user_id: str = "default"):
    """写入示例图谱：先建 KnowledgeGraph 记录，再写入带 graph_id 的节点/关系。

    幂等：多次调用只产生一份示例图谱（SAMPLE_GRAPH_ID 固定）。
    """
    # 1) 图谱元数据
    g = db.query(models.KnowledgeGraph).filter(
        models.KnowledgeGraph.id == SAMPLE_GRAPH_ID
    ).first()
    if not g:
        g = models.KnowledgeGraph(
            id=SAMPLE_GRAPH_ID,
            user_id=user_id,
            title="计算机网络示例图谱",
            source="sample",
            source_ref="sample",
            description="内置的计算机网络示例图谱（26 节点 / 48 关系）",
            nodes_count=len(SAMPLE_NODES),
            relations_count=len(SAMPLE_RELATIONS),
        )
        db.add(g)
        db.commit()
    else:
        g.user_id = user_id

    # 2) 节点（保持原始 id n1~n26，因为是示例图谱独占）
    for n in SAMPLE_NODES:
        row = db.query(models.KGNode).filter(models.KGNode.id == n["id"]).first()
        if row:
            row.name = n["name"]; row.category = n["category"]
            row.description = n["description"]; row.difficulty = n["difficulty"]
            row.graph_id = SAMPLE_GRAPH_ID; row.user_id = user_id
        else:
            row = models.KGNode(
                **n, graph_id=SAMPLE_GRAPH_ID, user_id=user_id,
            )
            db.add(row)
    # 3) 关系
    for r in SAMPLE_RELATIONS:
        row = db.query(models.KGRelation).filter(models.KGRelation.id == r[0]).first()
        if row:
            row.source = r[1]; row.target = r[2]; row.type = r[3]; row.label = r[4]
            row.graph_id = SAMPLE_GRAPH_ID; row.user_id = user_id
        else:
            db.add(models.KGRelation(
                id=r[0], source=r[1], target=r[2], type=r[3], label=r[4],
                graph_id=SAMPLE_GRAPH_ID, user_id=user_id,
            ))
    db.commit()

    # 4) 更新计数
    from .graphs import _refresh_counts
    _refresh_counts(db, SAMPLE_GRAPH_ID)


def _get_graph(
    db: Session,
    *,
    user_id: str | None = None,
    graph_id: str | None = None,
    category: str | None = None,
    q: str | None = None,
) -> schemas.KnowledgeGraphOut:
    """旧版兼容查询：按 user_id / graph_id 过滤；都不给则返回全部（仅限无认证场景）。"""
    qy = db.query(models.KGNode)
    if graph_id:
        qy = qy.filter(models.KGNode.graph_id == graph_id)
    elif user_id:
        qy = qy.filter(models.KGNode.user_id == user_id)
    if category:
        qy = qy.filter(models.KGNode.category == category)
    nodes = qy.all()
    if q:
        kw = q.strip().lower()
        nodes = [n for n in nodes if kw in n.name.lower() or kw in (n.description or "").lower()]

    node_ids = {n.id for n in nodes}
    rels_q = db.query(models.KGRelation).filter(
        models.KGRelation.source.in_(node_ids),
        models.KGRelation.target.in_(node_ids),
    )
    if graph_id:
        rels_q = rels_q.filter(models.KGRelation.graph_id == graph_id)
    elif user_id:
        rels_q = rels_q.filter(models.KGRelation.user_id == user_id)
    rels = rels_q.all()
    return schemas.KnowledgeGraphOut(
        nodes=[schemas.KGNodeOut.model_validate(n) for n in nodes],
        relations=[schemas.KGRelationOut.model_validate(r) for r in rels],
    )


@router.get("", response_model=schemas.KnowledgeGraphOut)
def get_graph(
    category: str | None = Query(None, description="按类别过滤"),
    q: str | None = Query(None, description="按名称/描述搜索"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """旧版兜底查询：返回当前用户的全部图谱节点（合并视图）。

    推荐：前端用 GET /api/graphs/{id} 获取单份图谱，避免不同图谱节点 id 冲突。
    """
    return _get_graph(db=db, user_id=user.id, category=category, q=q)


@router.get("/stats/categories", response_model=list[schemas.CategoryStat])
def get_category_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = db.query(models.KGNode.category).filter(models.KGNode.user_id == user.id).all()
    counter: Counter = Counter([r[0] for r in rows])
    return [{"category": c, "count": cnt} for c, cnt in counter.most_common()]


@router.post("/nodes", response_model=schemas.KGNodeOut)
def upsert_node(
    payload: schemas.KGNodeOut,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = db.query(models.KGNode).filter(models.KGNode.id == payload.id).first()
    if row:
        row.name = payload.name
        row.category = payload.category
        row.description = payload.description
        row.difficulty = payload.difficulty
        row.x = payload.x
        row.y = payload.y
    else:
        row = models.KGNode(**payload.model_dump(), user_id=user.id)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/relations", response_model=schemas.KGRelationOut)
def upsert_relation(
    payload: schemas.KGRelationOut,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # 检查两端节点是否存在
    for nid in (payload.source, payload.target):
        if not db.query(models.KGNode).filter(models.KGNode.id == nid).first():
            raise HTTPException(400, f"节点 {nid} 不存在，请先创建该节点")
    row = db.query(models.KGRelation).filter(models.KGRelation.id == payload.id).first()
    if row:
        row.source = payload.source; row.target = payload.target
        row.type = payload.type; row.label = payload.label
    else:
        row = models.KGRelation(**payload.model_dump(), user_id=user.id)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/seed-sample", response_model=schemas.KnowledgeGraphOut)
def seed_sample(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """方便前端「加载示例」按钮调用：写入一份完整的示例图谱（幂等）。"""
    _upsert_sample(db, user_id=user.id)
    return _get_graph(db=db, graph_id=SAMPLE_GRAPH_ID, user_id=user.id)


@router.delete("/wipe")
def wipe_graph(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """清空当前用户所有图谱（测试用）。"""
    # 先删该用户所有图谱（含节点/关系级联）
    user_graphs = db.query(models.KnowledgeGraph).filter(
        models.KnowledgeGraph.user_id == user.id
    ).all()
    for g in user_graphs:
        node_ids = [n.id for n in db.query(models.KGNode)
                    .filter(models.KGNode.graph_id == g.id).all()]
        if node_ids:
            db.query(models.UserProgress).filter(
                models.UserProgress.node_id.in_(node_ids)
            ).delete(synchronize_session=False)
        db.query(models.KGNode).filter(models.KGNode.graph_id == g.id).delete(synchronize_session=False)
        db.query(models.KGRelation).filter(models.KGRelation.graph_id == g.id).delete(synchronize_session=False)
        db.delete(g)
    # 兜底：删 user_id 维度的孤儿
    db.query(models.KGRelation).filter(models.KGRelation.user_id == user.id).delete(synchronize_session=False)
    db.query(models.KGNode).filter(models.KGNode.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}
