import { useState, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown, Plus, Loader2, Check } from 'lucide-react';
import { useCourse } from '../../context/CourseContext';
import { useAuth } from '../../context/AuthContext';
import { createCourse } from '../../api/courses';

export default function CourseSelector() {
  const { courses, currentCourse, currentCourseId, setCurrentCourseId, refreshCourses, loading } = useCourse();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const course = await createCourse({ name });
      await refreshCourses();
      setCurrentCourseId(course.id);
      setNewName('');
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || '创建失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sketch-sm border-2 border-ink/15 bg-paper-100 hover:bg-paper-50 hover:border-sketch-blue/40 transition-colors text-left max-w-[180px]"
        title="切换课程"
      >
        <BookOpen size={14} className="text-sketch-blueDeep shrink-0" />
        <span className="text-[12px] font-medium text-ink truncate">
          {currentCourse?.name ?? (loading ? '加载中...' : '全部课程')}
        </span>
        <ChevronDown size={13} className="text-ink-light shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 sketch-card !p-2 bg-white z-50 animate-pencil-in">
          {/* 全部课程 */}
          <button
            onClick={() => { setCurrentCourseId(null); setOpen(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-sketch-sm hover:bg-paper-100 text-left text-sm"
          >
            <span className="text-ink-light">全部课程</span>
            {currentCourseId === null && <Check size={14} className="text-sketch-greenDeep" />}
          </button>

          <div className="h-px bg-ink/10 my-1" />

          {/* 课程列表 */}
          <div className="max-h-56 overflow-y-auto">
            {courses.length === 0 && (
              <div className="px-3 py-2 text-xs text-ink-light">暂无课程</div>
            )}
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCurrentCourseId(c.id); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-sketch-sm hover:bg-paper-100 text-left text-sm"
              >
                <span className="truncate">
                  {c.name}
                  <span className="ml-1.5 text-[10px] text-ink-light">
                    {c.role === 'owner' ? '教师' : '学生'}
                  </span>
                </span>
                {currentCourseId === c.id && <Check size={14} className="text-sketch-greenDeep shrink-0" />}
              </button>
            ))}
          </div>

          {/* 教师创建课程 */}
          {isTeacher && (
            <>
              <div className="h-px bg-ink/10 my-1" />
              <div className="px-2 py-1.5">
                <div className="flex gap-1.5">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                    placeholder="新课程名称"
                    className="flex-1 px-2 py-1 text-xs rounded-sketch-sm border border-ink/15 bg-paper-50 focus:outline-none focus:border-sketch-blue/50"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="px-2 py-1 rounded-sketch-sm bg-sketch-blue/15 text-sketch-blueDeep hover:bg-sketch-blue/25 disabled:opacity-40 transition-colors"
                  >
                    {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  </button>
                </div>
                {error && <div className="text-[11px] text-sketch-red mt-1">{error}</div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
