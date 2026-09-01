import { useTabs } from '../context/TabContext';
import { BookOpen, Sparkles } from 'lucide-react';
import ChatInterface from '../components/qa/ChatInterface';
import { useKnowledge } from '../context/KnowledgeContext';

export default function QAPage() {
  const { hasGraph, graph, masteredIds } = useKnowledge();
  const { openTab } = useTabs();

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-140px)] min-h-[620px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-ink handwritten">智能问答</h2>
        {hasGraph && (
          <div className="flex gap-2.5">
            <div className="sketch-card px-4 py-2 flex items-center gap-2.5 border-sketch-purple/30 bg-gradient-to-br from-sketch-purple/10 to-transparent">
              <BookOpen size={15} className="text-sketch-purple" />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">教材</div>
                <div className="text-sm font-bold text-ink max-w-[280px] truncate">
                  {graph?.courseName} · {graph?.chapterName}
                </div>
              </div>
            </div>
            <div className="sketch-card px-4 py-2 flex items-center gap-2.5 border-sketch-green/30 bg-gradient-to-br from-sketch-green/10 to-transparent">
              <Sparkles size={15} className="text-sketch-greenDeep" />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">已掌握</div>
                <div className="text-sm font-bold text-ink handwritten">{masteredIds.size}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!hasGraph ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="sketch-card p-10 max-w-lg text-center">
            <h2 className="text-2xl font-bold text-ink handwritten mb-2">暂无图谱</h2>
            <p className="text-sm text-ink-light mb-6">请先上传文档或加载示例图谱</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={() => openTab('upload')} className="sketch-btn-primary">
                去上传文档
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ChatInterface />
        </div>
      )}
    </div>
  );
}
