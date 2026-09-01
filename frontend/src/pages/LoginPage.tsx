import { useState } from 'react';
import { Network, User, Lock, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-paper-100 via-paper-50 to-sketch-blue/10">
      <div className="w-full max-w-md p-8 bg-paper-50/80 backdrop-blur-md rounded-sketch-lg border-2 border-ink/15 shadow-[4px_4px_0_rgba(59,51,43,0.1)]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-sketch-lg bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink shadow-sketch flex items-center justify-center border-2 border-ink/20 rotate-[-3deg]">
              <Network size={32} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-sketch-yellow border-2 border-white shadow-sketch-sm flex items-center justify-center text-[9px] handwritten font-bold">
              AI
            </div>
          </div>
          <h1 className="text-2xl font-bold text-ink handwritten tracking-wide">
            AIGC 知识图谱
          </h1>
          <p className="text-[12px] text-ink-light mt-1">智能导航系统 · 登录以保存学习进度</p>
        </div>

        {/* 切换 Tab */}
        <div className="flex gap-1 mb-5 p-1 bg-paper-100 rounded-sketch-sm border-2 border-ink/10">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sketch-xs text-[13px] font-medium transition-colors ${
              mode === 'login' ? 'bg-paper-50 text-ink shadow-sketch-sm' : 'text-ink-light hover:text-ink'
            }`}
          >
            <LogIn size={14} /> 登录
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sketch-xs text-[13px] font-medium transition-colors ${
              mode === 'register' ? 'bg-paper-50 text-ink shadow-sketch-sm' : 'text-ink-light hover:text-ink'
            }`}
          >
            <UserPlus size={14} /> 注册
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-ink-light mb-1.5 block">用户名</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2-32 个字符"
                minLength={2}
                maxLength={32}
                required
                className="w-full pl-10 pr-3 py-2.5 text-[14px] bg-paper-100 border-2 border-ink/15 rounded-sketch-sm focus:outline-none focus:border-sketch-blue/50 focus:bg-paper-50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-ink-light mb-1.5 block">密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                minLength={6}
                maxLength={64}
                required
                className="w-full pl-10 pr-3 py-2.5 text-[14px] bg-paper-100 border-2 border-ink/15 rounded-sketch-sm focus:outline-none focus:border-sketch-blue/50 focus:bg-paper-50 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="text-[12px] text-sketch-red bg-sketch-red/8 rounded-sketch-sm px-3 py-2 border border-sketch-red/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[14px] font-bold text-white bg-gradient-to-r from-sketch-blue to-sketch-purple rounded-sketch-sm border-2 border-ink/15 shadow-sketch-sm hover:shadow-sketch transition-all disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> 处理中…</>
            ) : mode === 'login' ? (
              <><LogIn size={16} /> 登录</>
            ) : (
              <><UserPlus size={16} /> 注册</>
            )}
          </button>
        </form>

        <p className="text-[11px] text-ink-light text-center mt-4 opacity-75">
          {mode === 'login' ? '还没有账号？点上方「注册」' : '已有账号？点上方「登录」'}
        </p>
      </div>
    </div>
  );
}
