import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { API_BASE } from '../lib/graphMap';
import { authedFetch } from './AuthContext';
import type { BoardCommand } from '../components/tutor/BlackboardCanvas';

// ==================== 类型 ====================
export interface TutorStepSummary {
  index: number;
  kind: 'prereq' | 'solve';
  node_id: string | null;
  node_name: string;
  status: 'pending' | 'teaching' | 'understood' | 'unclear' | 'skipped';
  verify_question?: string | null;
}

export interface TutorSession {
  id: string;
  status: 'planning' | 'teaching' | 'practicing' | 'done';
  current_step: number;
  problem: { text: string; latex: string; image_path: string | null };
  located_node_ids: string[];
  prereq_chain: any[];
  strategy: string;
  used_llm: boolean;
  steps: TutorStepSummary[];
  steps_count: number;
  created_at: string | null;
}

export interface Exercise {
  id: number;
  node_id: string | null;
  question: string;
  choices: string[] | null;
  answer: string;
  explanation: string;
  difficulty: number;
  user_answer?: string | null;
  is_correct?: boolean | null;
}

interface TutorContextValue {
  session: TutorSession | null;
  currentStep: number;
  playing: boolean;
  boardCommands: BoardCommand[];
  narration: string;
  verify: { question: string; answer: string } | null;
  dialogue: { question: string; answer: string } | null;
  exercises: Exercise[];
  loading: boolean;
  error: string | null;
  createSession: (text: string | null, image: File | null) => Promise<void>;
  playStep: (index: number) => Promise<void>;
  nextStep: () => void;
  sendInterrupt: (question: string) => Promise<void>;
  sendFeedback: (understood: boolean, answer?: string) => Promise<{ has_next: boolean; suggestion: string | null } | null>;
  generateExercises: (nodeId?: string) => Promise<void>;
  submitExercise: (exId: number, answer: string) => Promise<{ is_correct: boolean; explanation: string }>;
  reset: () => void;
}

const TutorContext = createContext<TutorContextValue | null>(null);

// ==================== SSE 解析（fetch streaming，带 Bearer token）====================
async function streamSSE(
  url: string,
  onEvent: (event: string, data: any) => void,
  signal?: AbortSignal,
) {
  const resp = await authedFetch(url, { headers: { Accept: 'text/event-stream' }, signal });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    throw new Error(txt || `SSE 连接失败 (${resp.status})`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let curEvent = 'message';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 帧以 \n\n 分隔
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      if (!frame.trim()) continue;
      let dataStr = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) curEvent = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      let data: any = dataStr;
      try { data = JSON.parse(dataStr); } catch { /* 纯文本 */ }
      onEvent(curEvent, data);
    }
  }
}

export function TutorProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TutorSession | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [boardCommands, setBoardCommands] = useState<BoardCommand[]>([]);
  const [narration, setNarration] = useState('');
  const [verify, setVerify] = useState<{ question: string; answer: string } | null>(null);
  const [dialogue, setDialogue] = useState<{ question: string; answer: string } | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSession(null); setCurrentStep(0); setPlaying(false);
    setBoardCommands([]); setNarration(''); setVerify(null);
    setDialogue(null); setExercises([]); setError(null);
  }, []);

  const createSession = useCallback(async (text: string | null, image: File | null) => {
    setLoading(true); setError(null); setSession(null);
    try {
      const fd = new FormData();
      if (text) fd.append('text', text);
      if (image) fd.append('image', image);
      const resp = await authedFetch(`${API_BASE}/api/tutor/sessions`, { method: 'POST', body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || '创建会话失败');
      setSession(data);
      setCurrentStep(0);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const playStep = useCallback(async (index: number) => {
    if (!session) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPlaying(true);
    setBoardCommands([]);
    setNarration('');
    setVerify(null);
    setDialogue(null);
    try {
      await streamSSE(
        `${API_BASE}/api/tutor/sessions/${session.id}/steps/${index}/play`,
        (event, data) => {
          if (event === 'board' && data) {
            setBoardCommands((prev) => {
              // 去掉 highlight 指令（它不参与绘制，而是控制 highlightTarget）
              if (data.type === 'highlight') return prev;
              return [...prev, data as BoardCommand];
            });
          } else if (event === 'narration' && data?.text) {
            setNarration(data.text);
          } else if (event === 'verify' && data?.question) {
            setVerify({ question: data.question, answer: data.answer || '' });
          } else if (event === 'done') {
            setPlaying(false);
          }
        },
        ctrl.signal,
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e));
      }
    } finally {
      setPlaying(false);
    }
  }, [session]);

  const nextStep = useCallback(() => {
    if (!session) return;
    setCurrentStep((cur) => cur + 1);
  }, [session]);

  const sendInterrupt = useCallback(async (question: string) => {
    if (!session) return;
    setError(null);
    try {
      const resp = await authedFetch(`${API_BASE}/api/tutor/sessions/${session.id}/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, step_index: currentStep }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || '提问失败');
      setDialogue({ question, answer: data.answer });
      // 同步步骤状态（被打断提问后该步可能标记 unclear）
      setSession((s) => s ? { ...s } : s);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [session, currentStep]);

  const sendFeedback = useCallback(async (understood: boolean, answer?: string) => {
    if (!session) return null;
    setError(null);
    try {
      const resp = await authedFetch(`${API_BASE}/api/tutor/sessions/${session.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_index: currentStep, understood, answer: answer || null }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || '反馈失败');
      // 更新步骤状态
      setSession((s) => {
        if (!s) return s;
        return {
          ...s,
          status: data.session_status || s.status,
          steps: s.steps.map((st) => st.index === currentStep ? { ...st, status: data.step_status } : st),
        };
      });
      return { has_next: !!data.has_next, suggestion: data.suggestion || null };
    } catch (e: any) {
      setError(e?.message || String(e));
      return null;
    }
  }, [session, currentStep]);

  const generateExercises = useCallback(async (nodeId?: string) => {
    if (!session) return;
    setLoading(true); setError(null);
    try {
      const url = `${API_BASE}/api/tutor/sessions/${session.id}/exercises?n=3${nodeId ? `&node_id=${nodeId}` : ''}`;
      const resp = await authedFetch(url, { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || '练习生成失败');
      setExercises(data.items || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const submitExercise = useCallback(async (exId: number, answer: string) => {
    if (!session) return { is_correct: false, explanation: '会话不存在' };
    const resp = await authedFetch(`${API_BASE}/api/tutor/sessions/${session.id}/exercises/${exId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_answer: answer }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.detail || '批改失败');
    setExercises((prev) => prev.map((ex) => ex.id === exId
      ? { ...ex, user_answer: answer, is_correct: data.is_correct } : ex));
    return { is_correct: data.is_correct, explanation: data.explanation };
  }, [session]);

  const value: TutorContextValue = {
    session, currentStep, playing, boardCommands, narration, verify,
    dialogue, exercises, loading, error,
    createSession, playStep, nextStep, sendInterrupt, sendFeedback,
    generateExercises, submitExercise, reset,
  };

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}

export function useTutor() {
  const ctx = useContext(TutorContext);
  if (!ctx) throw new Error('useTutor must be used within TutorProvider');
  return ctx;
}
