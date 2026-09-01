// 知识点分类
export type NodeCategory = 'foundation' | 'concept' | 'protocol' | 'algorithm' | 'device' | 'application';

// 关系类型 - 至少3种
export type RelationType = 'contains' | 'prerequisite' | 'related';

// 知识点节点
export interface KnowledgeNode {
  id: string;
  name: string;
  category: NodeCategory;
  description: string;
  definition: string;
  examples: string[];
  resources: { title: string; url: string }[];
  importance: number; // 1-5，影响节点大小
  // 力导向图用
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

// 知识点关系
export interface KnowledgeRelation {
  id: string;
  source: string; // source node id
  target: string; // target node id
  type: RelationType;
  label: string;
}

// 知识图谱
export interface KnowledgeGraph {
  courseName: string;
  chapterName: string;
  nodes: KnowledgeNode[];
  relations: KnowledgeRelation[];
  extractedAt: string;
  documentName: string;
}

// 上传的文档
export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'docx' | 'txt' | 'md';
  uploadAt: string;
  status: 'uploading' | 'uploaded' | 'parsing' | 'parsed' | 'failed' | 'error';
  progress: number; // 0-100
  errorMsg?: string;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  referencedNodes?: string[]; // 引用的知识点 id
}

// 学习路径推荐项
export interface PathRecommendation {
  nodeId: string;
  nodeName: string;
  priority: number; // 数值越小越优先
  satisfiedPrerequisites: string[];
  missingPrerequisites: string[];
  learningOrder: number; // 建议学习顺序
}

// 路径阶段
export interface PathStage {
  stage: number;
  title: string;
  nodeIds: string[];
}
