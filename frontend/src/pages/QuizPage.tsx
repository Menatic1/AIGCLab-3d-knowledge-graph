import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleHelp, ClipboardCheck, RefreshCw, Sparkles, Target, XCircle } from 'lucide-react';
import type { KnowledgeNode } from '../types';
import { CATEGORY_META } from '../mock/sampleKnowledgeGraph';
import { useKnowledge } from '../context/KnowledgeContext';
import { useTabs } from '../context/TabContext';

type QuizQuestion = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

function distinctChoices(correct: string, candidates: string[], total = 4) {
  const choices = [correct, ...candidates.filter((item) => item && item !== correct)];
  return choices.slice(0, total).sort(() => Math.random() - 0.5);
}

function makeQuestions(node: KnowledgeNode, allNodes: KnowledgeNode[]): QuizQuestion[] {
  const otherNodes = allNodes.filter((item) => item.id !== node.id);
  const category = CATEGORY_META[node.category] ?? CATEGORY_META.concept;
  const categoryOptions = distinctChoices(category.label, Object.values(CATEGORY_META).map((item) => item.label));
  const descriptionOptions = distinctChoices(node.description, otherNodes.map((item) => item.description));
  const importanceOptions = distinctChoices(`重要度 ${node.importance}/5`, [1, 2, 3, 4, 5].map((value) => `重要度 ${value}/5`));

  return [
    {
      prompt: `下列哪项最符合「${node.name}」的描述？`,
      options: descriptionOptions,
      answer: descriptionOptions.indexOf(node.description),
      explanation: `知识点说明：${node.description}`,
    },
    {
      prompt: `「${node.name}」在当前图谱中属于哪一类？`,
      options: categoryOptions,
      answer: categoryOptions.indexOf(category.label),
      explanation: `它属于「${category.label}」类别。`,
    },
    {
      prompt: `根据当前课程图谱，「${node.name}」的重点程度是？`,
      options: importanceOptions,
      answer: importanceOptions.indexOf(`重要度 ${node.importance}/5`),
      explanation: `该知识点的重要度为 ${node.importance}/5，学习路径会综合重点程度、前置关系与测试表现进行推荐。`,
    },
  ];
}

export default function QuizPage() {
  const { graph, learningNode, setLearningNode, submitQuiz } = useKnowledge();
  const { setActive, openTab } = useTabs();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const questions = useMemo(
    () => learningNode && graph ? makeQuestions(learningNode, graph.nodes) : [],
    [learningNode, graph],
  );

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    setAccuracy(null);
  }, [learningNode?.id]);

  if (!learningNode || !graph) {
    return <div className="h-full min-h-[560px] flex items-center justify-center"><div className="sketch-card p-10 max-w-md text-center"><ClipboardCheck size={34} className="mx-auto mb-4 text-sketch-greenDeep" /><h2 className="text-xl font-bold text-ink handwritten mb-2">先选择一个知识点</h2><p className="text-sm text-ink-light mb-5">请先进入详细学习页面，再开始对应的小测试。</p><button onClick={() => setActive('graph')} className="sketch-btn-primary"><ArrowLeft size={16} />返回知识图谱</button></div></div>;
  }

  const correctCount = questions.reduce((sum, question, index) => sum + (answers[index] === question.answer ? 1 : 0), 0);
  const canSubmit = questions.every((_, index) => answers[index] !== undefined);
  const passed = (accuracy ?? 0) >= 67;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const result = submitQuiz(learningNode.id, correctCount, questions.length);
    setAccuracy(result.accuracy);
    setSubmitted(true);
  };

  const retry = () => {
    setAnswers({});
    setSubmitted(false);
    setAccuracy(null);
  };

  return (
    <div className="max-w-4xl mx-auto pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3"><button onClick={() => setActive('learning')} className="w-9 h-9 rounded-full border-2 border-ink/15 bg-paper-50 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="返回详细学习"><ArrowLeft size={17} /></button><div><div className="flex items-center gap-1.5 text-xs text-ink-light"><ClipboardCheck size={13} className="text-sketch-greenDeep" />知识掌握小测试</div><h2 className="text-2xl md:text-3xl font-bold text-ink handwritten mt-1">{learningNode.name}</h2></div></div>
        <div className="sketch-tag bg-sketch-green/12 text-sketch-greenDeep border-sketch-green/30 text-sm">3 题 · 达标线 67%</div>
      </div>

      {submitted ? (
        <section className="sketch-card overflow-hidden">
          <div className={`p-7 md:p-9 text-center ${passed ? 'bg-gradient-to-br from-sketch-green/15 to-paper-50' : 'bg-gradient-to-br from-sketch-orange/15 to-paper-50'}`}>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-2 ${passed ? 'bg-sketch-green/20 border-sketch-green/35 text-sketch-greenDeep' : 'bg-sketch-orange/20 border-sketch-orange/35 text-sketch-orangeDeep'}`}>{passed ? <CheckCircle2 size={34} /> : <Target size={32} />}</div>
            <p className="text-sm text-ink-light mt-4">本次测试正确率</p>
            <div className={`text-5xl font-bold handwritten mt-1 ${passed ? 'text-sketch-greenDeep' : 'text-sketch-orangeDeep'}`}>{accuracy}%</div>
            <h3 className="text-xl font-bold text-ink handwritten mt-3">{passed ? '已记录为掌握，继续向前吧' : '先巩固薄弱点，再来挑战一次'}</h3>
            <p className="text-sm text-ink-light mt-2 max-w-lg mx-auto">{passed ? '学习路径会把后续前置已满足的知识点优先排到前面。' : '个人学习报告已记录本次结果，并会优先推荐本知识点的前置基础与同类内容。'}</p>
          </div>
          <div className="p-5 md:p-6 space-y-3">
            {questions.map((question, index) => {
              const right = answers[index] === question.answer;
              return <div key={question.prompt} className={`p-3.5 rounded-sketch-sm border-2 ${right ? 'bg-sketch-green/8 border-sketch-green/25' : 'bg-sketch-orange/8 border-sketch-orange/25'}`}><div className="flex gap-2 text-sm font-bold text-ink">{right ? <CheckCircle2 size={17} className="text-sketch-greenDeep shrink-0" /> : <XCircle size={17} className="text-sketch-orangeDeep shrink-0" />}<span>第 {index + 1} 题 · {right ? '回答正确' : '需要巩固'}</span></div><p className="text-xs text-ink-light mt-2 ml-6">{question.explanation}</p></div>;
            })}
            <div className="flex flex-wrap gap-2 pt-2"><button onClick={() => setActive('learning')} className="sketch-btn-secondary text-sm"><ArrowLeft size={15} />继续学习</button><button onClick={() => { openTab('visitor'); }} className="sketch-btn-primary text-sm"><Sparkles size={15} />查看个人学习报告</button>{!passed && <button onClick={retry} className="sketch-btn-warm text-sm"><RefreshCw size={15} />重新测试</button>}</div>
          </div>
        </section>
      ) : (
        <section className="sketch-card overflow-hidden">
          <div className="px-5 py-4 bg-paper-100/70 border-b-2 border-ink/10 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-light">根据本节内容完成测试，系统将据此更新你的学习建议。</p><span className="text-xs font-bold text-sketch-blueDeep">已完成 {Object.keys(answers).length}/{questions.length}</span></div>
          <div className="p-5 md:p-6 space-y-5">
            {questions.map((question, index) => <div key={question.prompt} className="border-b-2 border-ink/10 pb-5 last:border-0 last:pb-0"><div className="flex gap-2.5"><span className="w-7 h-7 shrink-0 rounded-sketch-sm bg-sketch-blue/15 text-sketch-blueDeep text-sm font-bold flex items-center justify-center">{index + 1}</span><h3 className="text-base font-bold text-ink leading-relaxed pt-0.5">{question.prompt}</h3></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 ml-0 sm:ml-9">{question.options.map((option, optionIndex) => { const selected = answers[index] === optionIndex; return <button key={`${option}-${optionIndex}`} onClick={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} className={`min-h-12 flex items-center gap-2.5 text-left px-3 py-2.5 rounded-sketch-sm border-2 text-sm transition-all ${selected ? 'border-sketch-blueDeep bg-sketch-blue/12 text-ink shadow-sketch-sm' : 'border-ink/10 bg-paper-50 hover:border-sketch-blue/40 hover:bg-white'}`}><span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${selected ? 'border-sketch-blueDeep bg-sketch-blueDeep text-white' : 'border-ink/25 text-ink-light'}`}>{String.fromCharCode(65 + optionIndex)}</span><span className="leading-snug">{option}</span></button>; })}</div></div>)}
          </div>
          <div className="p-4 bg-paper-100/70 border-t-2 border-ink/10 flex justify-end"><button disabled={!canSubmit} onClick={handleSubmit} className="sketch-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"><CircleHelp size={16} />提交并查看结果</button></div>
        </section>
      )}
    </div>
  );
}
