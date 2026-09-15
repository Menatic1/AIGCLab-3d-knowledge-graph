import { useState, type FormEvent } from 'react';
import { BookOpen, GraduationCap, KeyRound, LogIn, Network, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { role: 'teacher' as const, label: '教师账号', username: 'teacher', password: 'teacher123', color: 'from-sketch-orange to-sketch-red', icon: GraduationCap },
  { role: 'student' as const, label: '学生账号', username: 'student', password: 'student123', color: 'from-sketch-blue to-sketch-purple', icon: BookOpen },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('student');
  const [password, setPassword] = useState('student123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码');
    } finally {
      setBusy(false);
    }
  };

  const fill = (account: typeof DEMO_ACCOUNTS[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-paper-50">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
        <section className="sketch-card p-7 md:p-10 flex flex-col justify-between min-h-[520px] bg-gradient-to-br from-sketch-blue/15 via-paper-50 to-sketch-purple/15">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="relative">
                <div className="w-12 h-12 rounded-sketch-sm bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink flex items-center justify-center border-2 border-white shadow-sketch rotate-[-3deg]">
                  <Network size={26} className="text-white" />
                </div>
                <span className="absolute -bottom-1 -right-2 w-5 h-5 rounded-full bg-sketch-yellow border-2 border-white text-[9px] font-bold flex items-center justify-center">AI</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink handwritten">AIGC 知识图谱</h1>
                <p className="text-xs text-ink-light">智能学习导航系统</p>
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-ink handwritten leading-tight">登录你的学习空间</h2>
            <p className="text-sm text-ink-light mt-3 max-w-md leading-relaxed">用教师身份维护课程图谱，用学生身份探索知识路径。当前为演示模式，账号仅保存在本机浏览器。</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-10">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = account.icon;
              return (
                <button key={account.role} type="button" onClick={() => fill(account)} className="text-left sketch-card p-4 hover:-translate-y-0.5 hover:shadow-sketch-lg transition-all">
                  <div className={`w-10 h-10 rounded-sketch-sm bg-gradient-to-br ${account.color} flex items-center justify-center text-white border-2 border-white shadow-sketch-sm mb-3`}><Icon size={20} /></div>
                  <div className="text-sm font-bold text-ink">{account.label}</div>
                  <div className="text-xs text-ink-light mt-1">{account.username} / {account.password}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="sketch-card p-7 md:p-9 self-center">
          <div className="flex items-center gap-2 mb-6"><ShieldCheck size={18} className="text-sketch-greenDeep" /><span className="text-sm text-ink-light">模拟登录</span></div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="text-sm font-bold text-ink">账号</span><div className="relative mt-1.5"><UserRound size={16} className="absolute left-3 top-3 text-ink-light" /><input value={username} onChange={(e) => setUsername(e.target.value)} className="sketch-input pl-9" autoComplete="username" /></div></label>
            <label className="block"><span className="text-sm font-bold text-ink">密码</span><div className="relative mt-1.5"><KeyRound size={16} className="absolute left-3 top-3 text-ink-light" /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="sketch-input pl-9" autoComplete="current-password" /></div></label>
            {error && <div className="text-sm text-sketch-red bg-sketch-red/10 border-2 border-sketch-red/20 rounded-sketch-sm px-3 py-2">{error}</div>}
            <button type="submit" disabled={busy || !username || !password} className="sketch-btn-primary w-full mt-2 disabled:opacity-50"><LogIn size={16} />{busy ? '登录中…' : '进入系统'}</button>
          </form>
          <p className="text-[11px] text-ink-light mt-5 leading-relaxed">教师可上传文档并编辑图谱；学生可浏览、学习和随时向 AI 助教提问。</p>
        </section>
      </div>
    </div>
  );
}
