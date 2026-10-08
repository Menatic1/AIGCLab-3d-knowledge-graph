import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { listCourses, type Course } from '../api/courses';
import { useAuth } from './AuthContext';

interface CourseContextValue {
  courses: Course[];
  currentCourse: Course | null;
  currentCourseId: number | null;
  loading: boolean;
  refreshCourses: () => Promise<void>;
  setCurrentCourseId: (id: number | null) => void;
}

const CourseContext = createContext<CourseContextValue | null>(null);

const CURRENT_COURSE_KEY = 'aigc_current_course_id';

export function CourseProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourseId, setCurrentCourseIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(CURRENT_COURSE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const refreshCourses = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const list = await listCourses();
      setCourses(list);
      // 如果当前选中的课程不在列表中，重置
      if (currentCourseId !== null && !list.find((c) => c.id === currentCourseId)) {
        setCurrentCourseIdState(null);
        localStorage.removeItem(CURRENT_COURSE_KEY);
      }
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentCourseId]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshCourses();
    } else {
      setCourses([]);
    }
  }, [isAuthenticated, refreshCourses]);

  const setCurrentCourseId = useCallback((id: number | null) => {
    setCurrentCourseIdState(id);
    if (id !== null) {
      localStorage.setItem(CURRENT_COURSE_KEY, String(id));
    } else {
      localStorage.removeItem(CURRENT_COURSE_KEY);
    }
  }, []);

  const currentCourse = courses.find((c) => c.id === currentCourseId) ?? null;

  return (
    <CourseContext.Provider
      value={{
        courses,
        currentCourse,
        currentCourseId,
        loading,
        refreshCourses,
        setCurrentCourseId,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error('useCourse must be used within CourseProvider');
  return ctx;
}
