"""把 default 用户的图谱复制一份给 test_stu（用于讲题功能测试）。
节点 id 加 ts_ 前缀避免主键冲突；关系同步重映射。"""
from app.database import SessionLocal
from app import models

def main():
    db = SessionLocal()
    try:
        u = db.query(models.User).filter(models.User.username == "test_stu").first()
        if not u:
            print("test_stu 不存在")
            return
        uid = u.id
        print("test_stu id:", uid)

        # 已有节点数
        exist = db.query(models.KGNode).filter(models.KGNode.user_id == uid).count()
        print("test_stu 现有节点:", exist)
        if exist > 0:
            print("已有图谱，跳过复制")
            return

        nodes = db.query(models.KGNode).filter(models.KGNode.user_id == "default").all()
        rels = db.query(models.KGRelation).filter(models.KGRelation.user_id == "default").all()
        print(f"default 节点 {len(nodes)} 关系 {len(rels)}")

        id_map = {}
        for n in nodes:
            new_id = "ts_" + n.id
            id_map[n.id] = new_id
            db.add(models.KGNode(
                id=new_id, user_id=uid, name=n.name, category=n.category,
                description=n.description, difficulty=n.difficulty,
                x=n.x, y=n.y,
            ))
        for r in rels:
            if r.source not in id_map or r.target not in id_map:
                continue
            db.add(models.KGRelation(
                id="tsr_" + r.id, user_id=uid,
                source=id_map[r.source], target=id_map[r.target],
                type=r.type, label=r.label,
            ))
        db.commit()
        print("复制完成，test_stu 现有节点:", db.query(models.KGNode).filter(models.KGNode.user_id == uid).count())
    finally:
        db.close()

if __name__ == "__main__":
    main()
