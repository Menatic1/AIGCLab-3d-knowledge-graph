import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Trash2, Loader2, Sparkles } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { useKnowledge } from '../../context/KnowledgeContext';
import { useTabs } from '../../context/TabContext';

interface Props {
  onJumpToNode?: (id: string) => void;
}

const SUGGESTIONS = [
  '数据链路层的主要功能有哪些？',
  '停止等待协议和连续 ARQ 有什么区别？',
  '解释一下 CSMA/CD 的工作流程',
  '以太网交换机和集线器有什么区别？',
  '什么是 VLAN？它有什么作用？',
  '选择重传 SR 相比 GBN 的优点是什么？',
];

export default function ChatInterface({ onJumpToNode }: Props) {
  const { messages, sendQuestion, clearChat, graph, hasGraph } = useKnowledge();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { openTab } = useTabs();

  const nodeById = useMemo(() => {
    const m = new Map<string, { name: string; category: string }>();
    if (graph) graph.nodes.forEach((n) => m.set(n.id, { name: n.name, category: n.category }));
    return m;
  }, [graph]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const submit = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || isThinking) return;
    setInput('');
    setIsThinking(true);
    try {
      await sendQuestion(q);
    } finally {
      setIsThinking(false);
    }
  };

  const handleNodeClick = (id: string) => {
    if (onJumpToNode) onJumpToNode(id);
    else openTab('graph');
  };

  return (
    <div className="flex flex-col h-full min-h-0 sketch-card overflow-hidden">
      {/* 头部 */}
      <div className="px-5 py-3 border-b-2 border-ink/10 bg-gradient-to-r from-sketch-blue/10 via-paper-100 to-sketch-purple/10 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-sketch-sm bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink flex items-center justify-center border-2 border-white shadow-sketch-sm rotate-[-4deg]">
            <Sparkles size={18} className="text-white" />
          </div>
          <h3 className="font-bold text-ink handwritten text-[15px]">AI 助教</h3>
        </div>
        <button
          onClick={clearChat}
          className="sketch-btn-secondary text-xs !py-1.5 !px-3"
          title="清空聊天"
        >
          <Trash2 size={13} /> 清空
        </button>
      </div>

      {/* 消息区 */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-sketch p-5 space-y-5 bg-gradient-to-b from-paper-50 to-paper-100/40">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            nodeById={nodeById}
            onNodeClick={handleNodeClick}
          />
        ))}

        {isThinking && (
          <div className="flex gap-2.5">
            <div className="w-9 h-9 shrink-0 rounded-sketch-sm bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink text-white font-bold flex items-center justify-center border-2 border-white -rotate-[3deg] shadow-sm">
              AI
            </div>
            <div className="bg-paper-50 border-2 border-ink/15 rounded-sketch-sm shadow-sketch-sm px-4 py-3 flex items-center gap-2 text-sm text-ink-light">
              <Loader2 size={15} className="animate-spin text-sketch-purple" />
              <span className="handwritten">思考中，正在检索知识图谱…</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sketch-purple animate-bounce" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-sketch-pink animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-sketch-orange animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
              </span>
            </div>
          </div>
        )}

        {/* 推荐问题 */}
        {messages.length <= 1 && hasGraph && (
          <div className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => submit(s)}
                  className="text-left text-[13px] bg-paper-50 border-2 border-ink/10 rounded-sketch-sm px-3 py-2.5 hover:border-sketch-blue/40 hover:bg-white hover:-translate-y-0.5 hover:shadow-sketch-sm transition-all"
                >
                  <div className="text-ink leading-snug">{s}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* 输入区 */}
      <div className="px-5 py-3 border-t-2 border-ink/10 bg-paper-100/70 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-2.5"
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={hasGraph ? '输入问题（Enter 发送）' : '请先加载知识图谱…'}
            className="sketch-input resize-none !py-2.5 text-sm leading-relaxed"
            disabled={!hasGraph || isThinking}
          />
          <button
            type="submit"
            disabled={!hasGraph || !input.trim() || isThinking}
            className="sketch-btn-primary !h-auto !py-3 disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:shadow-sketch-sm shrink-0"
          >
            {isThinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            发送
          </button>
        </form>
      </div>
    </div>
  );
}
