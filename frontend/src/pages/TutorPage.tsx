import { useEffect, useRef, useState } from 'react';
import {
  Camera, Send, Play, CheckCircle2, XCircle, Loader2, PenLine,
  HelpCircle, ChevronRight, RefreshCw, BookOpen, Sparkles, ArrowLeft, Target,
} from 'lucide-react';
import { useTutor } from '../context/TutorContext';
import BlackboardCanvas from '../components/tutor/BlackboardCanvas';
import { useKnowledge } from '../context/KnowledgeContext';

export default function TutorPage() {
  const t = useTutor();
  const { graph } = useKnowledge();
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [interruptQ, setInterruptQ] = useState('');
  const [verifyAns, setVerifyAns] = useState('');
  const [exAns, setExAns] = useState<Record<number, string>>({});
  const [exResult, setExResult] = useState<Record<number, { is_correct: boolean; explanation: string }>>({});
  const [generatingEx, setGeneratingEx] = useState(false);
  const autoPlayedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (image) { setImagePreview(URL.createObjectURL(image)); }
    else setImagePreview('');
  }, [image]);

  // 创建会话后自动播放第 0 步
  useEffect(() => {
    if (t.session && t.session.steps_count > 0 && !autoPlayedRef.current.has(0)) {
      autoPlayedRef.current.add(0);
      t.playStep(0);
    }
  }, [t.session]);

  // 进入新步自动播放
  useEffect(() => {
    if (t.session && !autoPlayedRef.current.has(t.currentStep) && t.session.status === 'teaching') {
      autoPlayedRef.current.add(t.currentStep);
      t.playStep(t.currentStep);
    }
  }, [t.currentStep, t.session]);

  async function handleCreate() {
    if (!text.trim() && !image) return;
    autoPlayedRef.current.clear();
    await t.createSession(text.trim() || null, image);
  }

  async function handleFeedback(understood: boolean) {
    const res = await t.sendFeedback(understood, verifyAns);
    setVerifyAns('');
    if (res?.has_next) {
      t.nextStep();
    }
  }

  async function handleInterrupt() {
    if (!interruptQ.trim()) return;
    await t.sendInterrupt(interruptQ.trim());
    setInterruptQ('');
  }

  async function handleGenExercises() {
    setGeneratingEx(true);
    await t.generateExercises();
    setGeneratingEx(false);
  }

  async function handleSubmitEx(exId: number) {
    const ans = exAns[exId];
    if (!ans?.trim()) return;
    const r = await t.submitExercise(exId, ans.trim());
    setExResult((prev) => ({ ...prev, [exId]: r }));
  }

  // ===== 未创建会话：题目输入界面 =====
  if (!t.session) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="sketch-card p-5 relative overflow-hidden mb-5">
          <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-sketch-blue/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-sketch-sm bg-gradient-to-br from-sketch-blue to-sketch-purple shadow-sketch flex items-center justify-center border-2 border-white/60 rotate-[-3deg]">
              <PenLine size={24} className="text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink handwritten">AI 讲题老师</h2>
              <p className="text-xs text-ink-light mt-0.5">拍照或输入题目，AI 边写板书边分步讲解，随时可打断提问</p>
            </div>
          </div>
        </div>

        <div className="sketch-card p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-ink-light mb-1.5 block">题目文本</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入题目，例如：求函数 f(x)=x^2-3x+2 在区间[0,3]上的极值"
              rows={5}
              className="w-full text-[14px] bg-paper-100 border-2 border-ink/15 rounded-sketch-sm p-3 focus:outline-none focus:border-sketch-blue/50 focus:bg-paper-50 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-ink-light mb-1.5 block">或拍照 / 上传题目图片</label>
            <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-ink/20 rounded-sketch-sm cursor-pointer hover:bg-paper-100/60 transition-colors">
              <Camera size={28} className="text-ink-light" />
              <span className="text-[12px] text-ink-light">点击拍照或选择图片（AI 视觉识别，支持公式）</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
            </label>
            {imagePreview && (
              <img src={imagePreview} alt="题目预览" className="mt-2 max-h-40 rounded-sketch-sm border-2 border-ink/15" />
            )}
          </div>

          {t.error && (
            <div className="text-[12px] text-sketch-red bg-sketch-red/8 rounded-sketch-sm px-3 py-2 border border-sketch-red/20">
              {t.error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={t.loading || (!text.trim() && !image)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[14px] font-bold text-white bg-gradient-to-r from-sketch-blue to-sketch-purple rounded-sketch-sm border-2 border-ink/15 shadow-sketch-sm hover:shadow-sketch transition-all disabled:opacity-60"
          >
            {t.loading ? <><Loader2 size={16} className="animate-spin" /> AI 正在识别题目、定位知识点、生成教学计划…</>
              : <><Sparkles size={16} /> 开始讲题</>}
          </button>

          {graph && graph.nodes.length === 0 && (
            <p className="text-[11px] text-sketch-orange text-center">提示：你的知识图谱为空，请先在「文档上传」或「AIGC 生成图谱」构建图谱，讲题老师才能定位知识点与前置链。</p>
          )}
        </div>
      </div>
    );
  }

  // ===== 已创建会话：讲题 / 练习界面 =====
  const s = t.session;
  const curStepInfo = s.steps.find((st) => st.index === t.currentStep);
  const inPracticeMode = s.status === 'practicing';

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-4">
      {/* 顶部状态条 */}
      <div className="sketch-card p-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => { t.reset(); autoPlayedRef.current.clear(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-ink-light hover:text-ink hover:bg-paper-100 rounded-sketch-xs transition-colors border-2 border-ink/10"
        >
          <ArrowLeft size={14} /> 新题目
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-ink truncate">{s.problem.text || '(图片题目)'}</div>
          {s.problem.latex && <div className="text-[11px] text-ink-light mt-0.5">{s.problem.latex}</div>}
        </div>
        {s.located_node_ids.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-light">
            <Target size={12} />
            <span>命中 {s.located_node_ids.length} 个知识点</span>
          </div>
        )}
        <div className="text-[11px] text-ink-light">
          {inPracticeMode ? '练习阶段' : `步骤 ${t.currentStep + 1}/${s.steps_count}`}
        </div>
        {s.used_llm && (
          <div className="flex items-center gap-1 text-[10px] text-sketch-green bg-sketch-green/10 px-1.5 py-0.5 rounded-sketch-xs">
            <Sparkles size={10} /> LLM
          </div>
        )}
      </div>

      {s.strategy && (
        <div className="text-[11px] text-ink-light bg-paper-100/60 px-3 py-1.5 rounded-sketch-xs border border-ink/8">
          教学策略：{s.strategy}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* 左侧：板书 + 口播 */}
        <div className="flex flex-col gap-3">
          <BlackboardCanvas commands={t.boardCommands} highlightTarget={undefined} height={440} />
          <div className="sketch-card p-3 min-h-[64px]">
            <div className="text-[10px] text-ink-light mb-1 flex items-center gap-1"><BookOpen size={11} /> 老师讲解</div>
            {t.playing && !t.narration ? (
              <div className="flex items-center gap-1.5 text-[12px] text-ink-light"><Loader2 size={13} className="animate-spin" /> 正在板书…</div>
            ) : (
              <p className="text-[13px] text-ink leading-relaxed">{t.narration || '点击步骤开始板书讲解'}</p>
            )}
          </div>
        </div>

        {/* 右侧：步骤 / 验证 / 打断 / 练习 */}
        <div className="flex flex-col gap-3">
          {/* 步骤列表 */}
          <div className="sketch-card p-3">
            <div className="text-[11px] font-medium text-ink-light mb-2">教学队列</div>
            <div className="space-y-1 max-h-[180px] overflow-auto scrollbar-thin">
              {s.steps.map((st) => {
                const active = st.index === t.currentStep && !inPracticeMode;
                const Icon = st.kind === 'prereq' ? BookOpen : PenLine;
                return (
                  <div
                    key={st.index}
                    onClick={() => { if (!t.playing) { t.playStep(st.index); } }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-sketch-xs cursor-pointer text-[12px] transition-colors ${
                      active ? 'bg-sketch-blue/15 text-ink font-medium' : 'text-ink-light hover:bg-paper-100'
                    }`}
                  >
                    <Icon size={13} />
                    <span className="flex-1 truncate">
                      <span className="text-[10px] text-ink-light/70 mr-1">{st.index + 1}.</span>
                      {st.kind === 'prereq' ? `补讲：${st.node_name || '前置'}` : `解题步骤 ${st.index + 1}`}
                    </span>
                    {st.status === 'understood' && <CheckCircle2 size={13} className="text-sketch-green" />}
                    {st.status === 'unclear' && <XCircle size={13} className="text-sketch-red" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 验证提问 + 反馈 */}
          {!inPracticeMode && t.verify && (
            <div className="sketch-card p-3 border-2 border-sketch-yellow/40">
              <div className="text-[11px] font-medium text-ink-light mb-1.5 flex items-center gap-1">
                <HelpCircle size={12} /> 验证理解
              </div>
              <p className="text-[13px] text-ink mb-2">{t.verify.question}</p>
              <input
                value={verifyAns}
                onChange={(e) => setVerifyAns(e.target.value)}
                placeholder="你的答案（可选）"
                className="w-full text-[13px] bg-paper-100 border-2 border-ink/15 rounded-sketch-xs px-2 py-1.5 mb-2 focus:outline-none focus:border-sketch-blue/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-white bg-sketch-green rounded-sketch-xs hover:opacity-90"
                >
                  <CheckCircle2 size={13} /> 懂了
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-white bg-sketch-orange rounded-sketch-xs hover:opacity-90"
                >
                  <XCircle size={13} /> 不懂
                </button>
              </div>
            </div>
          )}

          {/* 不在播放且无验证 → 下一步 */}
          {!inPracticeMode && !t.playing && !t.verify && curStepInfo && (
            <button
              onClick={() => handleFeedback(true)}
              className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-white bg-sketch-blue rounded-sketch-xs hover:opacity-90"
            >
              <ChevronRight size={14} /> 进入下一步
            </button>
          )}

          {/* 打断提问 */}
          {!inPracticeMode && (
            <div className="sketch-card p-3">
              <div className="text-[11px] font-medium text-ink-light mb-1.5 flex items-center gap-1">
                <HelpCircle size={12} /> 随时打断提问
              </div>
              <div className="flex gap-1.5">
                <input
                  value={interruptQ}
                  onChange={(e) => setInterruptQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInterrupt()}
                  placeholder="不懂的地方，问老师…"
                  className="flex-1 text-[13px] bg-paper-100 border-2 border-ink/15 rounded-sketch-xs px-2 py-1.5 focus:outline-none focus:border-sketch-blue/50"
                />
                <button
                  onClick={handleInterrupt}
                  className="px-2.5 flex items-center justify-center text-sketch-blue hover:bg-sketch-blue/10 rounded-sketch-xs border-2 border-sketch-blue/30"
                >
                  <Send size={14} />
                </button>
              </div>
              {t.dialogue && (
                <div className="mt-2 text-[12px] bg-paper-100 rounded-sketch-xs p-2 border border-ink/8">
                  <div className="text-[10px] text-ink-light mb-0.5">问：{t.dialogue.question}</div>
                  <div className="text-ink leading-relaxed">{t.dialogue.answer}</div>
                </div>
              )}
            </div>
          )}

          {/* 练习阶段 */}
          {inPracticeMode && (
            <div className="sketch-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-medium text-ink-light flex items-center gap-1">
                  <PenLine size={12} /> 巩固练习
                </div>
                <button
                  onClick={handleGenExercises}
                  disabled={generatingEx || t.loading}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-sketch-blue hover:bg-sketch-blue/10 rounded-sketch-xs border border-sketch-blue/30 disabled:opacity-60"
                >
                  {generatingEx || t.loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  {t.exercises.length ? '换一组' : '生成练习'}
                </button>
              </div>
              {t.exercises.length === 0 ? (
                <p className="text-[11px] text-ink-light py-3 text-center">点击「生成练习」让 AI 出变式题</p>
              ) : (
                <div className="space-y-2.5">
                  {t.exercises.map((ex, i) => {
                    const res = exResult[ex.id];
                    return (
                      <div key={ex.id} className="bg-paper-100 rounded-sketch-xs p-2 border border-ink/8">
                        <div className="text-[12px] text-ink mb-1.5">
                          <span className="text-ink-light text-[10px] mr-1">{i + 1}.</span>
                          {ex.question}
                        </div>
                        {ex.choices ? (
                          <div className="space-y-1">
                            {ex.choices.map((c, ci) => (
                              <button
                                key={ci}
                                onClick={() => setExAns((p) => ({ ...p, [ex.id]: c }))}
                                className={`block w-full text-left text-[12px] px-2 py-1 rounded-sketch-xs border ${
                                  exAns[ex.id] === c ? 'bg-sketch-blue/15 border-sketch-blue/40' : 'border-ink/10 hover:bg-paper-50'
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input
                            value={exAns[ex.id] || ''}
                            onChange={(e) => setExAns((p) => ({ ...p, [ex.id]: e.target.value }))}
                            placeholder="输入答案"
                            className="w-full text-[12px] bg-paper-50 border-2 border-ink/15 rounded-sketch-xs px-2 py-1 focus:outline-none focus:border-sketch-blue/50"
                          />
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <button
                            onClick={() => handleSubmitEx(ex.id)}
                            disabled={!exAns[ex.id]?.trim() || res !== undefined}
                            className="px-2 py-0.5 text-[11px] text-white bg-sketch-blue rounded-sketch-xs disabled:opacity-50"
                          >
                            提交
                          </button>
                          {res && (
                            <span className={`text-[11px] flex items-center gap-1 ${res.is_correct ? 'text-sketch-green' : 'text-sketch-red'}`}>
                              {res.is_correct ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              {res.explanation}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {t.error && (
            <div className="text-[11px] text-sketch-red bg-sketch-red/8 rounded-sketch-xs px-2 py-1.5 border border-sketch-red/20">
              {t.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
