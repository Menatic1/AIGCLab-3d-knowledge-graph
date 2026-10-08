"""图谱 CRUD + 统计 + 示例导入。"""
from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_teacher
from ..database import get_db

router = APIRouter(prefix="/api/graph", tags=["graph"])


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


def _upsert_sample(db: Session):
    for n in SAMPLE_NODES:
        row = db.query(models.KGNode).filter(models.KGNode.id == n["id"]).first()
        if row:
            row.name = n["name"]; row.category = n["category"]
            row.description = n["description"]; row.difficulty = n["difficulty"]
        else:
            db.add(models.KGNode(**n))
    for r in SAMPLE_RELATIONS:
        row = db.query(models.KGRelation).filter(models.KGRelation.id == r[0]).first()
        if row:
            row.source = r[1]; row.target = r[2]; row.type = r[3]; row.label = r[4]
        else:
            db.add(models.KGRelation(
                id=r[0], source=r[1], target=r[2], type=r[3], label=r[4],
            ))
    db.commit()


def _get_graph(db: Session, category: str | None = None, q: str | None = None, course_id: int | None = None) -> schemas.KnowledgeGraphOut:
    qy = db.query(models.KGNode)
    if course_id is not None:
        qy = qy.filter(models.KGNode.course_id == course_id)
    if category:
        qy = qy.filter(models.KGNode.category == category)
    nodes = qy.all()
    if q:
        kw = q.strip().lower()
        nodes = [n for n in nodes if kw in n.name.lower() or kw in (n.description or "").lower()]

    node_ids = {n.id for n in nodes}
    rels_qy = db.query(models.KGRelation).filter(
        models.KGRelation.source.in_(node_ids),
        models.KGRelation.target.in_(node_ids),
    )
    if course_id is not None:
        rels_qy = rels_qy.filter(models.KGRelation.course_id == course_id)
    rels = rels_qy.all()
    return schemas.KnowledgeGraphOut(
        nodes=[schemas.KGNodeOut.model_validate(n) for n in nodes],
        relations=[schemas.KGRelationOut.model_validate(r) for r in rels],
    )


@router.get("", response_model=schemas.KnowledgeGraphOut)
def get_graph(
    category: str | None = Query(None, description="按类别过滤"),
    q: str | None = Query(None, description="按名称/描述搜索"),
    course_id: int | None = Query(None, description="按课程 ID 过滤"),
    db: Session = Depends(get_db),
):
    return _get_graph(db=db, category=category, q=q, course_id=course_id)


@router.get("/stats/categories", response_model=list[schemas.CategoryStat])
def get_category_stats(db: Session = Depends(get_db)):
    rows = db.query(models.KGNode.category).all()
    counter: Counter = Counter([r[0] for r in rows])
    return [{"category": c, "count": cnt} for c, cnt in counter.most_common()]


@router.post("/nodes", response_model=schemas.KGNodeOut)
def upsert_node(payload: schemas.KGNodeOut, db: Session = Depends(get_db), _=Depends(require_teacher)):
    row = db.query(models.KGNode).filter(models.KGNode.id == payload.id).first()
    if row:
        row.name = payload.name
        row.category = payload.category
        row.description = payload.description
        row.difficulty = payload.difficulty
        row.x = payload.x
        row.y = payload.y
    else:
        row = models.KGNode(**payload.model_dump())
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/nodes/{node_id}")
def delete_node(node_id: str, db: Session = Depends(get_db), _=Depends(require_teacher)):
    """删除指定节点，同时清理相关关系。"""
    row = db.query(models.KGNode).filter(models.KGNode.id == node_id).first()
    if not row:
        raise HTTPException(404, f"节点 {node_id} 不存在")
    # 删除关联关系
    db.query(models.KGRelation).filter(
        (models.KGRelation.source == node_id) | (models.KGRelation.target == node_id)
    ).delete(synchronize_session=False)
    db.delete(row)
    db.commit()
    return {"ok": True, "deleted": node_id}


@router.post("/relations", response_model=schemas.KGRelationOut)
def upsert_relation(payload: schemas.KGRelationOut, db: Session = Depends(get_db), _=Depends(require_teacher)):
    # 检查两端节点是否存在
    for nid in (payload.source, payload.target):
        if not db.query(models.KGNode).filter(models.KGNode.id == nid).first():
            raise HTTPException(400, f"节点 {nid} 不存在，请先创建该节点")
    row = db.query(models.KGRelation).filter(models.KGRelation.id == payload.id).first()
    if row:
        row.source = payload.source; row.target = payload.target
        row.type = payload.type; row.label = payload.label
    else:
        row = models.KGRelation(**payload.model_dump())
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/relations/{relation_id}")
def delete_relation(relation_id: str, db: Session = Depends(get_db), _=Depends(require_teacher)):
    """删除指定关系。"""
    row = db.query(models.KGRelation).filter(models.KGRelation.id == relation_id).first()
    if not row:
        raise HTTPException(404, f"关系 {relation_id} 不存在")
    db.delete(row)
    db.commit()
    return {"ok": True, "deleted": relation_id}


@router.post("/seed-sample", response_model=schemas.KnowledgeGraphOut)
def seed_sample(db: Session = Depends(get_db)):
    """方便前端「加载示例」按钮调用：写入一份完整的示例图谱。"""
    _upsert_sample(db)
    return _get_graph(db=db)


@router.delete("/wipe")
def wipe_graph(db: Session = Depends(get_db)):
    """清空图谱（测试用）。"""
    db.query(models.KGRelation).delete()
    db.query(models.KGNode).delete()
    db.commit()
    return {"ok": True}
