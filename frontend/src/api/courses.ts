import { API_BASE } from '../lib/graphMap';
import { authedFetch } from '../context/AuthContext';

export interface Course {
  id: number;
  owner_id: string;
  name: string;
  description: string | null;
  role: string | null; // owner / student
  created_at: string;
  updated_at: string;
}

export interface CourseCreateRequest {
  name: string;
  description?: string;
}

export interface DocumentStatusStat {
  pending: number;
  done: number;
  error: number;
}

export interface CategoryStat {
  category: string;
  count: number;
}

export interface CourseOverview {
  course_id: number;
  course_name: string;
  document_count: number;
  documents_status: DocumentStatusStat;
  nodes_count: number;
  relations_count: number;
  categories: CategoryStat[];
  graph_status: 'empty' | 'building' | 'ready';
  pending_review_count: number;
  extraction_progress: number;
}

export async function getCourseOverview(courseId: number): Promise<CourseOverview> {
  const resp = await authedFetch(`${API_BASE}/api/courses/${courseId}/overview`);
  if (!resp.ok) throw new Error(`获取课程概览失败 (${resp.status})`);
  return resp.json();
}

export async function listCourses(): Promise<Course[]> {
  const resp = await authedFetch(`${API_BASE}/api/courses`);
  if (!resp.ok) throw new Error(`获取课程列表失败 (${resp.status})`);
  return resp.json();
}

export async function createCourse(payload: CourseCreateRequest): Promise<Course> {
  const resp = await authedFetch(`${API_BASE}/api/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.detail || `创建课程失败 (${resp.status})`);
  }
  return resp.json();
}

export async function joinCourse(courseId: number): Promise<{ course: Course; already_member: boolean }> {
  const resp = await authedFetch(`${API_BASE}/api/courses/${courseId}/join`, { method: 'POST' });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.detail || `加入课程失败 (${resp.status})`);
  }
  return resp.json();
}

export async function deleteCourse(courseId: number): Promise<void> {
  const resp = await authedFetch(`${API_BASE}/api/courses/${courseId}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`删除课程失败 (${resp.status})`);
}
