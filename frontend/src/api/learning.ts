import { API_BASE } from '../lib/graphMap';

export interface QuizSubmitResponse {
  id: number;
  node_id: string;
  correct_count: number;
  total_count: number;
  accuracy: number;
  passed: boolean;
  completed_at: string;
}

export interface LearningReportResponse {
  user_id: string;
  learning_preference: 'reinforce' | 'balanced' | 'challenge';
  total_nodes: number;
  mastered_nodes: number;
  mastery_rate: number;
  mastered_node_ids: string[];
  quiz_count: number;
  average_accuracy: number | null;
  weak_node_ids: string[];
  recent_attempts: QuizSubmitResponse[];
}

function authHeaders() {
  const token = localStorage.getItem('aigc_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 后端未启动时返回 null，调用方继续使用前端演示数据。 */
async function request<T>(path: string, options: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers ?? {}) },
    });
    return response.ok ? await response.json() as T : null;
  } catch {
    return null;
  }
}

export function persistQuizResult(nodeId: string, correct: number, total: number) {
  return request<QuizSubmitResponse>('/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify({ node_id: nodeId, correct_count: correct, total_count: total }),
  });
}

export function persistLearningPreference(preference: 'reinforce' | 'balanced' | 'challenge') {
  return request('/api/learning/preference', {
    method: 'PUT',
    body: JSON.stringify({ preference }),
  });
}

export function fetchLearningReport() {
  return request<LearningReportResponse>('/api/learning/report', { method: 'GET' });
}
