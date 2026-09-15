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

// 后端中文关系类型 → 前端英文 key（前端图谱仅区分 contains / prerequisite / related 三类着色与距离）
const RELATION_ZH_EN: Record<string, RelationType> = {
  包含: 'contains',
  先修: 'prerequisite',
  前置: 'prerequisite',
  prerequisite: 'prerequisite',
  contains: 'contains',
  related: 'related',
  关联: 'related',
};

function mapCategory(zh: string): NodeCategory {
  return CATEGORY_ZH_EN[zh] ?? 'concept';
}

function mapRelationType(zh: string): RelationType {
  if (RELATION_ZH_EN[zh]) return RELATION_ZH_EN[zh];
  // 其他中文类型（属于/基于/依赖/协同/服务于/对比/升级为/承载…）统一归为 related
  return 'related';
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
  const relations: KnowledgeRelation[] = rawLinks.map((r) => ({
    id: String(r.id),
    source: String(r.source),
    target: String(r.target),
    type: mapRelationType(String(r.type ?? '关联')),
    label: String(r.label ?? r.type ?? ''),
  }));

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
