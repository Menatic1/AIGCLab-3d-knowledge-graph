import { useState, type FormEvent } from 'react';
import { KeyRound, LogIn, ShieldCheck, UserRound, GraduationCap, UserCog, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onBack?: () => void;
}

export default function LoginPage({ onBack }: LoginPageProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-paper-50 relative">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-5 left-5 flex items-center gap-1.5 px-3 py-1.5 rounded-sketch-sm border-2 border-ink/15 bg-white shadow-sketch-sm text-sm text-ink-light hover:text-ink hover:border-sketch-blue/40 transition-colors"
        >
          <ArrowLeft size={14} /> 返回首页
        </button>
      )}
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
        <section className="sketch-card p-7 md:p-10 flex flex-col justify-between min-h-[520px] bg-gradient-to-br from-sketch-blue/15 via-paper-50 to-sketch-purple/15 relative overflow-hidden">
          {/* 装饰：流动的知识路径线 */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.07] pointer-events-none" style={{ background: 'radial-gradient(circle, #3f7ba0 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="relative">
                <div className="w-14 h-14 rounded-sketch-sm bg-white shadow-sketch logo-mark flex items-center justify-center border-2 border-ink/15 rotate-[-4deg] overflow-hidden">
                  <img src="/logo.jpg" alt="智绘千里" className="w-full h-full object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-2 w-5 h-5 rounded-full bg-sketch-yellow border-2 border-white text-[9px] font-bold flex items-center justify-center">AI</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-ink handwritten tracking-wide">智绘千里</h1>
                <p className="text-xs text-ink-light mt-0.5">AIGC 知识图谱 · 智能学习导航系统</p>
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-ink handwritten leading-tight">开启你的知识探索之旅</h2>
            <p className="text-sm text-ink-light mt-3 max-w-md leading-relaxed">以画笔绘就知识网络，以智能导航千里学程。教师维护课程图谱，学生探索知识路径，AI 助教随时相伴。</p>
          </div>
          <div className="sketch-card p-4 mt-10 text-sm text-ink-light leading-relaxed bg-white/60">
            <span className="font-bold text-sketch-blueDeep">💡 首次使用</span>：切换到注册模式创建账号。教师账号可创建课程，学生通过课程加入接口进入学习空间。
          </div>
        </section>

        <section className="sketch-card p-7 md:p-9 self-center">
          <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-sketch-greenDeep" /><span className="text-sm text-ink-light">{mode === 'login' ? '账号登录' : '创建账号'}</span></div><button type="button" className="text-xs text-sketch-blue underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? '注册新账号' : '返回登录'}</button></div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="text-sm font-bold text-ink">账号</span><div className="relative mt-1.5"><UserRound size={16} className="absolute left-3 top-3 text-ink-light" /><input value={username} onChange={(e) => setUsername(e.target.value)} className="sketch-input pl-9" autoComplete="username" /></div></label>
            <label className="block"><span className="text-sm font-bold text-ink">密码</span><div className="relative mt-1.5"><KeyRound size={16} className="absolute left-3 top-3 text-ink-light" /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="sketch-input pl-9" autoComplete="current-password" /></div></label>
            {mode === 'register' && (
              <div className="block">
                <span className="text-sm font-bold text-ink">选择身份</span>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-sketch-sm border-2 transition-all ${
                      role === 'student'
                        ? 'border-sketch-blue bg-sketch-blue/10 shadow-sketch-sm'
                        : 'border-ink/15 bg-paper-50 hover:border-sketch-blue/40'
                    }`}
                  >
                    <GraduationCap size={22} className={role === 'student' ? 'text-sketch-blueDeep' : 'text-ink-light'} />
                    <span className={`text-xs font-bold ${role === 'student' ? 'text-sketch-blueDeep' : 'text-ink-light'}`}>我是同学</span>
                    <span className="text-[9px] text-ink-light">学知识 · 做题</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-sketch-sm border-2 transition-all ${
                      role === 'teacher'
                        ? 'border-sketch-greenDeep bg-sketch-green/10 shadow-sketch-sm'
                        : 'border-ink/15 bg-paper-50 hover:border-sketch-green/40'
                    }`}
                  >
                    <UserCog size={22} className={role === 'teacher' ? 'text-sketch-greenDeep' : 'text-ink-light'} />
                    <span className={`text-xs font-bold ${role === 'teacher' ? 'text-sketch-greenDeep' : 'text-ink-light'}`}>我是老师</span>
                    <span className="text-[9px] text-ink-light">建课程 · 管班级</span>
                  </button>
                </div>
              </div>
            )}
            {error && <div className="text-sm text-sketch-red bg-sketch-red/10 border-2 border-sketch-red/20 rounded-sketch-sm px-3 py-2">{error}</div>}
            <button type="submit" disabled={busy || !username || !password} className="sketch-btn-primary w-full mt-2 disabled:opacity-50"><LogIn size={16} />{busy ? '处理中…' : mode === 'login' ? '进入系统' : '创建并登录'}</button>
          </form>
          <p className="text-[11px] text-ink-light mt-5 leading-relaxed">教师可上传文档并编辑图谱；学生可浏览、学习和随时向 AI 助教提问。</p>
        </section>
      </div>
    </div>
  );
}
