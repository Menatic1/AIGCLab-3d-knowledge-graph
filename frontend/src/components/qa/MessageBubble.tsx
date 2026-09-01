import type { ChatMessage } from '../../types';
import { CATEGORY_META } from '../../mock/sampleKnowledgeGraph';

interface Props {
  message: ChatMessage;
  nodeById: Map<string, { name: string; category: string }>;
  onNodeClick?: (id: string) => void;
}

function renderContentWithRefs(
  content: string,
  refs: string[] | undefined,
  nodeById: Map<string, { name: string; category: string }>,
  onNodeClick?: (id: string) => void,
) {
  // 简单换行
  const paragraphs = content.split('\n');
  return (
    <div className="space-y-1.5">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap leading-relaxed">
          {renderInline(p)}
        </p>
      ))}
      {refs && refs.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-ink/15">
          <div className="text-[11px] text-ink-light mb-1.5 flex items-center gap-1">
            <span>📎</span> 引用的相关知识点（点击跳转）：
          </div>
          <div className="flex flex-wrap gap-1.5">
            {refs.map((id) => {
              const n = nodeById.get(id);
              if (!n) return null;
              const meta = CATEGORY_META[n.category];
              return (
                <button
                  key={id}
                  onClick={() => onNodeClick?.(id)}
                  className="sketch-tag gap-1 hover:scale-[1.03] active:scale-95 transition-transform"
                  style={{ background: meta.bgColor, color: meta.color, borderColor: meta.color + '55' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                  {n.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 简易 markdown: **bold**
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={key++} className="font-bold text-sketch-blueDeep">{m[1]}</strong>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MessageBubble({ message, nodeById, onNodeClick }: Props) {
  const isUser = message.role === 'user';
  const t = new Date(message.timestamp);
  const timeText = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  return (
    <div className={'flex gap-2.5 ' + (isUser ? 'flex-row-reverse' : '')}>
      {/* 头像 */}
      <div
        className={
          'w-9 h-9 shrink-0 rounded-sketch-sm border-2 shadow-sm flex items-center justify-center text-white font-bold ' +
          (isUser
            ? 'bg-gradient-to-br from-sketch-orange to-sketch-red border-white rotate-[4deg]'
            : 'bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink border-white -rotate-[3deg]')
        }
      >
        {isUser ? '我' : 'AI'}
      </div>

      {/* 气泡正文 */}
      <div className={'flex flex-col max-w-[78%] ' + (isUser ? 'items-end' : 'items-start')}>
        <div
          className={
            'rounded-sketch-sm px-4 py-3 shadow-sketch-sm border-2 text-[14px] ' +
            (isUser
              ? 'bg-gradient-to-br from-sketch-orange to-sketch-orangeDeep/90 text-white border-sketch-orangeDeep'
              : 'bg-paper-50 text-ink border-ink/15')
          }
        >
          {isUser ? (
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          ) : (
            renderContentWithRefs(message.content, message.referencedNodes, nodeById, onNodeClick)
          )}
        </div>
        <div className="text-[10px] text-ink-soft mt-1 px-1 flex items-center gap-2">
          <span>{timeText}</span>
          {!isUser && <span>· 基于 RAG + 课程知识图谱回答</span>}
        </div>
      </div>
    </div>
  );
}
