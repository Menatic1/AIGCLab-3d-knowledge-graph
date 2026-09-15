import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  KnowledgeGraph,
  KnowledgeNode,
  UploadedDocument,
  ChatMessage,
  PathRecommendation,
  PathStage,
  LearningPreference,
  QuizAttempt,
} from '../types';
import { sampleKnowledgeGraph, qaKnowledgeBase, initialMessages } from '../mock/sampleKnowledgeGraph';
import { mapBackendGraph, API_BASE } from '../lib/graphMap';
import { authedFetch, useAuth } from './AuthContext';
import { fetchLearningReport, persistLearningPreference, persistQuizResult } from '../api/learning';

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
  masteredIds: Set<string>,
  quizAttempts: QuizAttempt[],
  preference: LearningPreference,
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
  const latestAttemptByNode = new Map<string, QuizAttempt>();
  quizAttempts.forEach((attempt) => latestAttemptByNode.set(attempt.nodeId, attempt));
  const weakNodeIds = new Set(
    [...latestAttemptByNode.values()]
      .filter((attempt) => attempt.accuracy < 67)
      .map((attempt) => attempt.nodeId),
  );
  const prerequisiteForWeakNodes = new Set<string>();
  weakNodeIds.forEach((id) => (prereqMap.get(id) ?? []).forEach((pre) => prerequisiteForWeakNodes.add(pre)));

  const scored: PathRecommendation[] = [];
  graph.nodes.forEach((n) => {
    if (masteredIds.has(n.id)) return; // 已掌握不推荐
    const pres = prereqMap.get(n.id) ?? [];
    const satisfied = pres.filter((p) => masteredIds.has(p));
    const missing = pres.filter((p) => !masteredIds.has(p));
    const ratio = pres.length === 0 ? 0.5 : satisfied.length / pres.length; // 无前序也有推荐价值
    const latestAttempt = latestAttemptByNode.get(n.id);
    const isWeak = !!latestAttempt && latestAttempt.accuracy < 67;
    const isWeakPrerequisite = prerequisiteForWeakNodes.has(n.id);
    const preferenceBoost = preference === 'reinforce'
      ? (isWeak ? 28 : isWeakPrerequisite ? 18 : 0)
      : preference === 'challenge'
        ? (n.importance >= 4 && ratio >= 0.5 ? 12 : 0)
        : 0;
    const score = ratio * 50 + n.importance * 7 + preferenceBoost + (isWeak ? 10 : 0);
    const reason = isWeak
      ? `上次测试正确率 ${latestAttempt!.accuracy}% ，建议优先巩固`
      : isWeakPrerequisite
        ? '是薄弱知识点的前置基础，建议先补齐'
        : preference === 'challenge' && n.importance >= 4
          ? '符合你的挑战进阶偏好，且属于重点知识'
          : missing.length === 0
            ? '前置知识已满足，可以开始学习'
            : `已满足 ${satisfied.length}/${pres.length} 个前置知识`;
    scored.push({
      nodeId: n.id,
      nodeName: n.name,
      priority: -1,
      satisfiedPrerequisites: satisfied,
      missingPrerequisites: missing,
      learningOrder: 0,
      reason,
      latestAccuracy: latestAttempt?.accuracy,
    });
    // 内部字段用于排序
    (scored[scored.length - 1] as any)._score = score;
    (scored[scored.length - 1] as any)._missingCount = missing.length;
  });

  scored.sort((a, b) => {
    const A = a as any, B = b as any;
    if (B._score !== A._score) return B._score - A._score;
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
interface KnowledgeContextValue {
  // 图谱
  graph: KnowledgeGraph | null;
  hasGraph: boolean;
  // 文档
  documents: UploadedDocument[];
  addDocument: (file: File) => void;
  triggerParse: (docId: string) => Promise<void>;
  loadSampleGraph: () => void;
  // 掌握状态
  masteredIds: Set<string>;
  markAsMastered: (id: string) => void;
  markAsNotMastered: (id: string) => void;
  toggleMastered: (id: string) => void;
  // 测试与学习画像
  quizAttempts: QuizAttempt[];
  weakNodeIds: Set<string>;
  submitQuiz: (nodeId: string, correct: number, total: number) => QuizAttempt;
  learningPreference: LearningPreference;
  setLearningPreference: (preference: LearningPreference) => void;
  // 推荐
  recommendations: PathRecommendation[];
  pathStages: PathStage[];
  regenerateRecommendations: () => void;
  // 问答
  messages: ChatMessage[];
  sendQuestion: (question: string) => Promise<void>;
  clearChat: () => void;
  // 当前正在详细学习的节点
  learningNode: KnowledgeNode | null;
  setLearningNode: (node: KnowledgeNode | null) => void;
  updateNode: (id: string, patch: Partial<KnowledgeNode>) => void;
  addNode: (node: Omit<KnowledgeNode, 'id'> & { id?: string }) => string;
  deleteNode: (id: string) => void;
  addRelation: (relation: Omit<import('../types').KnowledgeRelation, 'id'> & { id?: string }) => string;
  deleteRelation: (id: string) => void;
}

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);
const LEARNING_PROFILE_KEY = 'aigc_learning_profile_v1';

function readLearningProfile(): { masteredIds: string[]; quizAttempts: QuizAttempt[]; preference: LearningPreference } {
  try {
    const raw = localStorage.getItem(LEARNING_PROFILE_KEY);
    if (!raw) return { masteredIds: [], quizAttempts: [], preference: 'balanced' };
    const saved = JSON.parse(raw) as Partial<{ masteredIds: string[]; quizAttempts: QuizAttempt[]; preference: LearningPreference }>;
    return {
      masteredIds: Array.isArray(saved.masteredIds) ? saved.masteredIds : [],
      quizAttempts: Array.isArray(saved.quizAttempts) ? saved.quizAttempts : [],
      preference: saved.preference === 'reinforce' || saved.preference === 'challenge' ? saved.preference : 'balanced',
    };
  } catch {
    return { masteredIds: [], quizAttempts: [], preference: 'balanced' };
  }
}

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // 直接进入工作台时展示内置示例图谱，便于无需账号即可浏览完整功能。
  const [graph, setGraph] = useState<KnowledgeGraph | null>(sampleKnowledgeGraph);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => new Set(readLearningProfile().masteredIds));
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(() => readLearningProfile().quizAttempts);
  const [learningPreference, setLearningPreferenceState] = useState<LearningPreference>(() => readLearningProfile().preference);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [learningNode, setLearningNode] = useState<KnowledgeNode | null>(null);
  // 保存尚未真正上传的 File 引用（key = docId）
  const fileRefs = useRef<Map<string, File>>(new Map());

  const hasGraph = graph !== null;

  useEffect(() => {
    localStorage.setItem(LEARNING_PROFILE_KEY, JSON.stringify({
      masteredIds: [...masteredIds], quizAttempts, preference: learningPreference,
    }));
  }, [masteredIds, quizAttempts, learningPreference]);

  // 后端可用时，以服务端学习档案恢复本次账号的记录；离线时继续使用本地演示状态。
  useEffect(() => {
    let active = true;
    void fetchLearningReport().then((report) => {
      if (!active || !report) return;
      setMasteredIds(new Set(report.mastered_node_ids));
      setQuizAttempts(report.recent_attempts.slice().reverse().map((attempt) => ({
        id: `api_${attempt.id}`,
        nodeId: attempt.node_id,
        correct: attempt.correct_count,
        total: attempt.total_count,
        accuracy: attempt.accuracy,
        completedAt: attempt.completed_at,
      })));
      setLearningPreferenceState(report.learning_preference);
    });
    return () => { active = false; };
  }, [user?.id]);

  // 开发辅助：允许浏览器端通过自定义事件注入后端拉取的真实图谱（用于端到端验收）
  useEffect(() => {
    function onInject(evt: Event) {
      const kg = (evt as CustomEvent).detail as KnowledgeGraph;
      if (kg && Array.isArray(kg.nodes) && Array.isArray(kg.relations)) {
        setGraph(kg);
        setMasteredIds(new Set());
        setQuizAttempts([]);
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
      let graphRespData: { nodes: any[]; relations: any[] } | null = null;

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
        // 解析完成：拉取当前图谱（包含所有节点关系）
        const gResp = await authedFetch(`${API_BASE}/api/graph`);
        if (!gResp.ok) throw new Error(`获取图谱失败 (${gResp.status})`);
        graphRespData = await gResp.json();
      } else {
        // 如果找不到文件引用（不应该发生），回退旧 mock
        graphRespData = sampleKnowledgeGraph;
      }

      // 进度条到 100%
      clearInterval(stepTimer);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'parsing', progress: 90 } : d)),
      );
      await new Promise((r) => setTimeout(r, 300));

      // 映射并设置图谱
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
      setQuizAttempts([]);
      setMessages(initialMessages);
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
  }, [documents]);

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
    } catch {
      // 后端不可达时回退内置 mock
      setGraph(sampleKnowledgeGraph);
    }
    setMasteredIds(new Set());
    setQuizAttempts([]);
    setMessages(initialMessages);
  }, []);

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

  const submitQuiz = useCallback((nodeId: string, correct: number, total: number) => {
    const safeTotal = Math.max(1, total);
    const safeCorrect = Math.max(0, Math.min(correct, safeTotal));
    const attempt: QuizAttempt = {
      id: `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nodeId,
      correct: safeCorrect,
      total: safeTotal,
      accuracy: Math.round((safeCorrect / safeTotal) * 100),
      completedAt: new Date().toISOString(),
    };
    setQuizAttempts((previous) => [...previous, attempt]);
    setMasteredIds((previous) => {
      const next = new Set(previous);
      if (attempt.accuracy >= 67) next.add(nodeId);
      else next.delete(nodeId);
      return next;
    });
    void persistQuizResult(nodeId, safeCorrect, safeTotal).then((remote) => {
      if (!remote) return;
      setQuizAttempts((previous) => previous.map((item) => item.id === attempt.id ? {
        id: `api_${remote.id}`,
        nodeId: remote.node_id,
        correct: remote.correct_count,
        total: remote.total_count,
        accuracy: remote.accuracy,
        completedAt: remote.completed_at,
      } : item));
    });
    return attempt;
  }, []);

  const setLearningPreference = useCallback((preference: LearningPreference) => {
    setLearningPreferenceState(preference);
    void persistLearningPreference(preference);
  }, []);

  const weakNodeIds = useMemo(() => {
    const latest = new Map<string, QuizAttempt>();
    quizAttempts.forEach((attempt) => latest.set(attempt.nodeId, attempt));
    return new Set([...latest.values()].filter((attempt) => attempt.accuracy < 67).map((attempt) => attempt.nodeId));
  }, [quizAttempts]);

  // 推荐（在 graph/masteredIds 变化时自动计算）
  const { recommendations, stages: pathStages } = useMemo(() => {
    if (!graph) return { recommendations: [], stages: [] };
    return buildRecommendations(graph, masteredIds, quizAttempts, learningPreference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, masteredIds, quizAttempts, learningPreference]);

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

  const updateNode = useCallback((id: string, patch: Partial<KnowledgeNode>) => {
    setGraph((current) => current ? { ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, ...patch, id } : node) } : current);
  }, []);

  const addNode = useCallback((node: Omit<KnowledgeNode, 'id'> & { id?: string }) => {
    const id = node.id?.trim() || `custom_${Math.random().toString(36).slice(2, 9)}`;
    setGraph((current) => current ? { ...current, nodes: [...current.nodes, { ...node, id }] } : current);
    return id;
  }, []);

  const deleteNode = useCallback((id: string) => {
    setGraph((current) => current ? { ...current, nodes: current.nodes.filter((node) => node.id !== id), relations: current.relations.filter((relation) => relation.source !== id && relation.target !== id) } : current);
    setMasteredIds((current) => { const next = new Set(current); next.delete(id); return next; });
  }, []);

  const addRelation = useCallback((relation: Omit<import('../types').KnowledgeRelation, 'id'> & { id?: string }) => {
    const id = relation.id?.trim() || `custom_rel_${Math.random().toString(36).slice(2, 9)}`;
    setGraph((current) => current ? { ...current, relations: [...current.relations, { ...relation, id }] } : current);
    return id;
  }, []);

  const deleteRelation = useCallback((id: string) => {
    setGraph((current) => current ? { ...current, relations: current.relations.filter((relation) => relation.id !== id) } : current);
  }, []);

  // 首次进入时：如无任何图谱，暂不自动加载；由上传页触发

  const value: KnowledgeContextValue = {
    graph,
    hasGraph,
    documents,
    addDocument,
    triggerParse,
    loadSampleGraph,
    masteredIds,
    markAsMastered,
    markAsNotMastered,
    toggleMastered,
    quizAttempts,
    weakNodeIds,
    submitQuiz,
    learningPreference,
    setLearningPreference,
    recommendations,
    pathStages,
    regenerateRecommendations,
    messages,
    sendQuestion,
    clearChat,
    learningNode,
    setLearningNode,
    updateNode,
    addNode,
    deleteNode,
    addRelation,
    deleteRelation,
  };

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (!ctx) throw new Error('useKnowledge must be used within KnowledgeProvider');
  return ctx;
}
