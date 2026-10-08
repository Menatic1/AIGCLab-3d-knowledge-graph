import type { KnowledgeGraph, KnowledgeNode, KnowledgeRelation, NodeCategory, RelationType } from '../types';

// 后端中文类别 → 前端英文 key
const CATEGORY_ZH_EN: Record<string, NodeCategory> = {
  基础概念: 'foundation',
  核心概念: 'concept',
  协议: 'protocol',
  算法: 'algorithm',
  设备: 'device',
  应用: 'application',
};

// 前端英文 key → 后端中文类别
const CATEGORY_EN_ZH: Record<NodeCategory, string> = {
  foundation: '基础概念',
  concept: '核心概念',
  protocol: '协议',
  algorithm: '算法',
  device: '设备',
  application: '应用',
  image: '图片资源',
  formula: '公式资源',
  code: '代码资源',
  video: '视频资源',
};

// 后端中文关系类型 → 前端英文 key
// 层级类（contains）：包含、属于、上层、承载、部署于、运行于
// 前置类（prerequisite）：先修、前置、依赖、基于、保障、保护
// 关联类（related）：其余
const RELATION_ZH_EN: Record<string, RelationType> = {
  包含: 'contains',
  属于: 'contains',   // A属于B ⟺ B包含A，方向在 mapBackendGraph 中反转
  上层: 'contains',
  承载: 'contains',
  部署于: 'contains',
  运行于: 'contains',
  先修: 'prerequisite',
  前置: 'prerequisite',
  依赖: 'prerequisite',
  基于: 'prerequisite',
  保障: 'prerequisite',
  保护: 'prerequisite',
  prerequisite: 'prerequisite',
  contains: 'contains',
  related: 'related',
  关联: 'related',
  服务于: 'related',
  协同: 'related',
  配套: 'related',
  对比: 'related',
  升级为: 'related',
  应用于: 'related',
  使用: 'related',
  连接: 'related',
  核心应用: 'related',
};

// 需要反转方向的关系类型（中文原始 type 判断）
// 例如 "A 属于 B" 实际表达 "B 包含 A"，所以 source/target 需要互换
const REVERSE_RELATIONS = new Set(['属于', '上层', '部署于', '运行于', '承载']);

// 前端英文关系类型 → 后端中文
const RELATION_EN_ZH: Record<RelationType, string> = {
  contains: '包含',
  prerequisite: '前置',
  related: '关联',
};

export function mapCategory(zh: string): NodeCategory {
  return CATEGORY_ZH_EN[zh] ?? 'concept';
}

export function mapCategoryToZh(en: NodeCategory): string {
  return CATEGORY_EN_ZH[en] ?? '核心概念';
}

export function mapRelationType(zh: string): RelationType {
  return RELATION_ZH_EN[zh] ?? 'related';
}

export function mapRelationTypeToZh(en: RelationType): string {
  return RELATION_EN_ZH[en] ?? '关联';
}

export function isReverseRelation(zh: string): boolean {
  return REVERSE_RELATIONS.has(zh);
}

/** 把后端返回的图谱（中文 category/relation）转成前端 KnowledgeGraph 格式。 */
export function mapBackendGraph(
  data: { nodes: any[]; relations?: any[]; links?: any[]; topic?: string; courseName?: string },
  meta?: { courseName?: string; chapterName?: string; documentName?: string },
): KnowledgeGraph {
  const nodes: KnowledgeNode[] = (data.nodes || []).map((n) => {
    const difficulty = Number(n.difficulty ?? 3);
    return {
      id: String(n.id),
      name: String(n.name ?? ''),
      category: mapCategory(String(n.category ?? '核心概念')),
      description: String(n.description ?? ''),
      definition: String(n.description ?? n.name ?? ''),
      examples: [],
      resources: [],
      importance: Math.max(1, Math.min(5, Math.round(difficulty))),
      x: n.x ?? undefined,
      y: n.y ?? undefined,
    };
  });

  const rawLinks = data.relations ?? data.links ?? [];
  const relations: KnowledgeRelation[] = rawLinks.map((r) => {
    const rawType = String(r.type ?? '关联');
    const mappedType = mapRelationType(rawType);
    // "属于"等反向关系：A 属于 B ⟺ B 包含 A，互换 source/target 使层级方向统一为 父→子
    const reverse = isReverseRelation(rawType);
    const source = String(reverse ? r.target : r.source);
    const target = String(reverse ? r.source : r.target);
    return {
      id: String(r.id),
      source,
      target,
      type: mappedType,
      label: String(r.label ?? r.type ?? ''),
    };
  });

  return {
    courseName: meta?.courseName ?? data.courseName ?? data.topic ?? 'AIGC 生成图谱',
    chapterName: meta?.chapterName ?? '知识图谱',
    nodes,
    relations,
    extractedAt: new Date().toISOString(),
    documentName: meta?.documentName ?? (data.topic ? `AIGC·${data.topic}` : 'AIGC 生成'),
  };
}

export const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000';
