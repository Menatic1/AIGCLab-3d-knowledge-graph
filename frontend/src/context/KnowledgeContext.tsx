import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  KnowledgeGraph,
  UploadedDocument,
  ChatMessage,
  PathRecommendation,
  PathStage,
} from '../types';
import { sampleKnowledgeGraph, qaKnowledgeBase, initialMessages } from '../mock/sampleKnowledgeGraph';
import { mapBackendGraph, API_BASE } from '../lib/graphMap';
import { authedFetch } from './AuthContext';

// ==================== 推荐算法 ====================
/**
 * 基于"前置关系"的简单图遍历推荐算法
 * 1. 收集已掌握节点集合 M
 * 2. 对每个未掌握节点 N：
 *    a. 找出所有直接指向 N 的 prerequisite 源节点集合 P（即 N 的前置）
 *    b. 统计 P ∩ M 的数量 (satisfiedCount) 和 |P| (totalCount)
 *    c. 若 satisfiedCount === totalCount 且 totalCount > 0，属于"可立即学习"
 *       否则若 satisfiedCount > 0，属于"部分前置满足"
 * 3. 排序：先按 (satisfiedCount/totalCount) 降序，再按 importance 降序
 * 4. 进一步分阶段构建时间线
 */
function buildRecommendations(
  graph: KnowledgeGraph,
  masteredIds: Set<string>
): { recommendations: PathRecommendation[]; stages: PathStage[] } {
  const prereqMap = new Map<string, string[]>(); // nodeId -> list of prerequisite nodeIds
  graph.relations.forEach((r) => {
    if (r.type === 'prerequisite') {
      // source 前置 -> target
      const arr = prereqMap.get(r.target) ?? [];
      if (!arr.includes(r.source)) arr.push(r.source);
      prereqMap.set(r.target, arr);
    }
  });

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const scored: PathRecommendation[] = [];
  graph.nodes.forEach((n) => {
    if (masteredIds.has(n.id)) return; // 已掌握不推荐
    const pres = prereqMap.get(n.id) ?? [];
    const satisfied = pres.filter((p) => masteredIds.has(p));
    const missing = pres.filter((p) => !masteredIds.has(p));
    const ratio = pres.length === 0 ? 0.5 : satisfied.length / pres.length; // 无前序也有推荐价值
    scored.push({
      nodeId: n.id,
      nodeName: n.name,
      priority: -1,
      satisfiedPrerequisites: satisfied,
      missingPrerequisites: missing,
      learningOrder: 0,
    });
    // 内部字段用于排序
    (scored[scored.length - 1] as any)._ratio = ratio;
    (scored[scored.length - 1] as any)._importance = n.importance;
    (scored[scored.length - 1] as any)._missingCount = missing.length;
  });

  scored.sort((a, b) => {
    const A = a as any, B = b as any;
    if (B._ratio !== A._ratio) return B._ratio - A._ratio;
    if (B._importance !== A._importance) return B._importance - A._importance;
    return A._missingCount - B._missingCount;
  });

  // 分配优先级和学习顺序
  scored.forEach((s, i) => {
    s.priority = i + 1;
    s.learningOrder = i + 1;
  });

  // 分阶段：前 1/3 阶段1（强烈推荐），中 1/3 阶段2（推荐），其余阶段3（进阶）
  const total = scored.length;
  const s1 = Math.ceil(total / 3);
  const s2 = s1 + Math.ceil(total / 3);
  const stages: PathStage[] = [
    { stage: 1, title: '今日可学 · 前置已满足', nodeIds: scored.slice(0, s1).map((x) => x.nodeId) },
    { stage: 2, title: '建议后续 · 部分前置满足', nodeIds: scored.slice(s1, s2).map((x) => x.nodeId) },
    { stage: 3, title: '进阶深入 · 需先补前置', nodeIds: scored.slice(s2).map((x) => x.nodeId) },
  ].filter((s) => s.nodeIds.length > 0);

  return { recommendations: scored, stages };
}

// ==================== Mock 问答检索 ====================
function mockAnswer(question: string, graph: KnowledgeGraph): { answer: string; refs: string[] } {
  const q = question.toLowerCase();
  // 优先关键词匹配
  for (const item of qaKnowledgeBase) {
    const hit = item.keywords.some((kw) => q.includes(kw.toLowerCase()));
    if (hit) return { answer: item.answer, refs: item.refs };
  }
  // 退化为：在节点描述/定义中做简单子串匹配，取前 3 个节点
  const matched = graph.nodes
    .map((n) => {
      const hay = (n.name + n.description + n.definition).toLowerCase();
      let count = 0;
      // 简单字符 bigram 命中
      for (let i = 0; i < question.length - 1; i++) {
        const g = question.slice(i, i + 2);
        if (hay.includes(g)) count++;
      }
      return { n, count };
    })
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (matched.length > 0) {
    const refs = matched.map((m) => m.n.id);
    const refsText = matched
      .map((m, i) => `${i + 1}. **${m.n.name}**：${m.n.description}`)
      .join('\n');
    const answer = `根据你提到的"${question}"，我在知识图谱中找到了以下相关知识点供参考：\n\n${refsText}\n\n你可以点击上方引用节点查看详细内容，或告诉我你具体想了解哪一个点，我再为你深入讲解 📖。`;
    return { answer, refs };
  }

  return {
    answer:
      '抱歉，我暂时没在当前章节的知识图谱中找到与你问题高度相关的内容。你可以尝试换个问法，比如：\n• 直接问某个概念的定义，如"什么是 CRC？"\n• 对比两个知识点，如"交换机和集线器有什么区别？"\n• 询问某个协议的工作过程，如"CSMA/CD 的流程是什么？"',
    refs: [],
  };
}

// ==================== Context 定义 ====================

// 图谱列表项（对应后端 KnowledgeGraphMetaOut）
export interface GraphMeta {
  id: string;
  user_id: string;
  title: string;
  source: string; // aigc / document / sample / default
  source_ref: string | null;
  description: string | null;
  nodes_count: number;
  relations_count: number;
  created_at: string;
  updated_at: string;
}

interface KnowledgeContextValue {
  // 图谱
  graph: KnowledgeGraph | null;
  hasGraph: boolean;
  currentGraphId: string | null;
  // 图谱列表
  graphs: GraphMeta[];
  refreshGraphList: () => Promise<void>;
  loadGraphById: (graphId: string) => Promise<void>;
  deleteGraph: (graphId: string) => Promise<void>;
  renameGraph: (graphId: string, title: string, description?: string) => Promise<void>;
  // 文档
  documents: UploadedDocument[];
  addDocument: (file: File) => void;
  triggerParse: (docId: string) => Promise<void>;
  loadSampleGraph: () => Promise<void>;
  // 掌握状态
  masteredIds: Set<string>;
  markAsMastered: (id: string) => void;
  markAsNotMastered: (id: string) => void;
  toggleMastered: (id: string) => void;
  // 推荐
  recommendations: PathRecommendation[];
  pathStages: PathStage[];
  regenerateRecommendations: () => void;
  // 问答
  messages: ChatMessage[];
  sendQuestion: (question: string) => Promise<void>;
  clearChat: () => void;
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  // 图谱列表 + 当前查看的图谱 id
  const [graphs, setGraphs] = useState<GraphMeta[]>([]);
  const [currentGraphId, setCurrentGraphId] = useState<string | null>(null);
  // 保存尚未真正上传的 File 引用（key = docId）
  const fileRefs = useRef<Map<string, File>>(new Map());

  const hasGraph = graph !== null;

  // ---------------- 图谱列表：刷新 / 按 id 加载 / 删除 / 改名 ----------------
  const refreshGraphList = useCallback(async () => {
    try {
      const resp = await authedFetch(`${API_BASE}/api/graphs`);
      if (!resp.ok) return;
      setGraphs(await resp.json());
    } catch {
      /* 静默失败：列表页会显示空态 */
    }
  }, []);

  const loadGraphById = useCallback(async (graphId: string) => {
    try {
      const resp = await authedFetch(`${API_BASE}/api/graphs/${graphId}`);
      if (!resp.ok) throw new Error(`加载图谱失败 (${resp.status})`);
      const data = await resp.json();
      const kg = mapBackendGraph(
        { nodes: data.nodes || [], relations: data.relations || [], topic: data.title },
        {
          courseName: data.title,
          chapterName: data.source === 'aigc' ? 'AIGC 生成' : data.source === 'document' ? '文档抽取' : '示例图谱',
          documentName: data.description || data.title,
        },
      );
      setGraph(kg);
      setCurrentGraphId(graphId);
      setMasteredIds(new Set());
      setMessages(initialMessages);
    } catch (e) {
      console.error('loadGraphById error:', e);
    }
  }, []);

  const deleteGraph = useCallback(async (graphId: string) => {
    const resp = await authedFetch(`${API_BASE}/api/graphs/${graphId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`删除失败 (${resp.status})`);
    setGraphs((prev) => prev.filter((g) => g.id !== graphId));
    // 如果删的是当前图谱，清空 graph
    setCurrentGraphId((cur) => {
      if (cur === graphId) {
        setGraph(null);
        return null;
      }
      return cur;
    });
  }, []);

  const renameGraph = useCallback(async (graphId: string, title: string, description?: string) => {
    const body: any = { title };
    if (description !== undefined) body.description = description;
    const resp = await authedFetch(`${API_BASE}/api/graphs/${graphId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`改名失败 (${resp.status})`);
    const updated = await resp.json();
    setGraphs((prev) => prev.map((g) => (g.id === graphId ? { ...g, ...updated } : g)));
  }, []);

  // 开发辅助：允许浏览器端通过自定义事件注入后端拉取的真实图谱（用于端到端验收）
  useEffect(() => {
    function onInject(evt: Event) {
      const kg = (evt as CustomEvent).detail as KnowledgeGraph;
      if (kg && Array.isArray(kg.nodes) && Array.isArray(kg.relations)) {
        setGraph(kg);
        setMasteredIds(new Set());
        setMessages(initialMessages);
      }
    }
    window.addEventListener('__inject_kg__', onInject as EventListener);
    return () => window.removeEventListener('__inject_kg__', onInject as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- 文档上传：本地进度模拟 + 保存 File 引用 ----------------
  const addDocument = useCallback((file: File) => {
    const typeMap: Record<string, UploadedDocument['type']> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'text/markdown': 'md',
    };
    const ext = file.name.split('.').pop()?.toLowerCase();
    let docType: UploadedDocument['type'] = 'txt';
    if (typeMap[file.type]) docType = typeMap[file.type];
    else if (ext === 'pdf') docType = 'pdf';
    else if (ext === 'docx') docType = 'docx';
    else if (ext === 'md') docType = 'md';
    else if (ext === 'pptx' || ext === 'ppt') docType = 'txt'; // 后端已支持 pptx，前端统一占位

    const doc: UploadedDocument = {
      id: 'doc_' + Math.random().toString(36).slice(2, 9),
      name: file.name,
      size: file.size,
      type: docType,
      uploadAt: new Date().toISOString(),
      status: 'uploading',
      progress: 0,
    };
    fileRefs.current.set(doc.id, file);
    setDocuments((prev) => [doc, ...prev]);

    // 模拟上传进度（真实上传/解析在 triggerParse 里做）
    let p = 0;
    const timer = setInterval(() => {
      p += 25 + Math.random() * 30;
      if (p >= 100) {
        p = 100;
        clearInterval(timer);
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: 'uploaded', progress: 100 } : d)),
        );
      } else {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, progress: Math.round(p) } : d)),
        );
      }
    }, 350);
  }, []);

  // ---------------- 触发解析：真实调后端 /api/documents/upload ----------------
  const triggerParse = useCallback(async (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: 'parsing', progress: 10 } : d)),
    );
    const file = fileRefs.current.get(docId);
    const docName = documents.find((d) => d.id === docId)?.name ?? 'uploaded_file';

    const stages: Array<{ at: number; s: string }> = [
      { at: 20, s: '文档结构化解析...' },
      { at: 45, s: 'AIGC 知识点实体抽取...' },
      { at: 70, s: '关系识别与图谱构建...' },
      { at: 95, s: '后处理与质量校验...' },
    ];
    let curStep = 0;
    const stepTimer = setInterval(() => {
      if (curStep < stages.length) {
        const { at } = stages[curStep++];
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, progress: at } : d)),
        );
      }
    }, 700);

    try {
      let newGraphId: string | null = null;

      if (file) {
        // 真实上传 + 解析
        const fd = new FormData();
        fd.append('file', file, file.name);
        const resp = await authedFetch(`${API_BASE}/api/documents/upload`, {
          method: 'POST',
          body: fd,
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(body?.detail || `上传失败 (${resp.status})`);
        }
        // 解析完成：后端为该文档创建了一份独立图谱，用 graph_id 加载
        newGraphId = body?.graph_id || null;
        if (newGraphId) {
          await loadGraphById(newGraphId);
          refreshGraphList();
        } else {
          // 兜底：后端未返回 graph_id 时拉取合并视图
          const gResp = await authedFetch(`${API_BASE}/api/graph`);
          if (!gResp.ok) throw new Error(`获取图谱失败 (${gResp.status})`);
          const graphRespData = await gResp.json();
          const kg = mapBackendGraph(
            graphRespData ?? { nodes: [], relations: [] },
            {
              courseName: docName.replace(/\.[^.]+$/, ''),
              chapterName: '上传解析',
              documentName: docName,
            },
          );
          setGraph(kg);
          setMasteredIds(new Set());
          setMessages(initialMessages);
        }
      } else {
        // 如果找不到文件引用（不应该发生），回退旧 mock
        setGraph(sampleKnowledgeGraph);
        setMasteredIds(new Set());
        setMessages(initialMessages);
      }

      // 进度条到 100%
      clearInterval(stepTimer);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'parsing', progress: 90 } : d)),
      );
      await new Promise((r) => setTimeout(r, 300));
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'parsed', progress: 100 } : d)),
      );
    } catch (e: any) {
      clearInterval(stepTimer);
      const msg = e?.message || String(e);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, status: 'error', progress: 0, errorMsg: msg } : d,
        ),
      );
      // 错误也提示给 graph 吗？这里保持不变，让用户在上传卡片上看到 error
    }
  }, [documents, loadGraphById, refreshGraphList]);

  // ---------------- 加载示例图谱：真实调后端 /api/graph/seed-sample ----------------
  const loadSampleGraph = useCallback(async () => {
    try {
      const resp = await authedFetch(`${API_BASE}/api/graph/seed-sample`, { method: 'POST' });
      if (!resp.ok) throw new Error(`加载示例失败 (${resp.status})`);
      const data = await resp.json();
      const kg = mapBackendGraph(data, {
        courseName: '计算机网络原理',
        chapterName: '示例图谱',
        documentName: '示例数据集',
      });
      setGraph(kg);
      // 示例图谱的 graph_id 固定为 sample-graph
      setCurrentGraphId('sample-graph');
      // 刷新图谱列表，让列表页也显示这份示例
      refreshGraphList();
    } catch {
      // 后端不可达时回退内置 mock
      setGraph(sampleKnowledgeGraph);
    }
    setMasteredIds(new Set());
    setMessages(initialMessages);
  }, [refreshGraphList]);

  // 掌握状态
  const markAsMastered = useCallback(
    (id: string) => setMasteredIds((prev) => new Set(prev).add(id)),
    [],
  );
  const markAsNotMastered = useCallback(
    (id: string) =>
      setMasteredIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
    [],
  );
  const toggleMastered = useCallback(
    (id: string) =>
      setMasteredIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  // 推荐（在 graph/masteredIds 变化时自动计算）
  const { recommendations, stages: pathStages } = useMemo(() => {
    if (!graph) return { recommendations: [], stages: [] };
    return buildRecommendations(graph, masteredIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, masteredIds]);

  const regenerateRecommendations = useCallback(() => {
    // 目前 useMemo 自动计算，这里保留 API 占位以便后续接后端
  }, []);

  // 问答
  const sendQuestion = useCallback(
    async (question: string) => {
      const userMsg: ChatMessage = {
        id: 'u_' + Math.random().toString(36).slice(2, 9),
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      if (!graph) {
        const fallback: ChatMessage = {
          id: 'a_' + Math.random().toString(36).slice(2, 9),
          role: 'assistant',
          content: '还没有可用的知识图谱，请先在「文档上传」页上传课程文档并解析，或直接加载示例图谱。',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, fallback]);
        return;
      }
      // 模拟思考延迟
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
      const { answer, refs } = mockAnswer(question, graph);
      const aiMsg: ChatMessage = {
        id: 'a_' + Math.random().toString(36).slice(2, 9),
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString(),
        referencedNodes: refs,
      };
      setMessages((prev) => [...prev, aiMsg]);
    },
    [graph],
  );

  const clearChat = useCallback(() => setMessages(initialMessages), []);

  // 首次进入时：如无任何图谱，暂不自动加载；由上传页触发

  const value: KnowledgeContextValue = {
    graph,
    hasGraph,
    currentGraphId,
    graphs,
    refreshGraphList,
    loadGraphById,
    deleteGraph,
    renameGraph,
    documents,
    addDocument,
    triggerParse,
    loadSampleGraph,
    masteredIds,
    markAsMastered,
    markAsNotMastered,
    toggleMastered,
    recommendations,
    pathStages,
    regenerateRecommendations,
    messages,
    sendQuestion,
    clearChat,
  };

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error('useKnowledge must be used within KnowledgeProvider');
  return ctx;
}
