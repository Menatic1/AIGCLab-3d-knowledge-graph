import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import ChatInterface from './ChatInterface';

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed right-5 bottom-20 z-40 w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-7rem))] animate-pencil-in">
          <div className="relative h-full">
            <button onClick={() => setOpen(false)} className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-paper-50 border-2 border-ink/20 shadow-sketch-sm flex items-center justify-center text-ink-light hover:text-ink" title="关闭 AI 助教" aria-label="关闭 AI 助教"><X size={15} /></button>
            <ChatInterface />
          </div>
        </div>
      )}
      <button onClick={() => setOpen((value) => !value)} className="fixed right-5 bottom-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-sketch-blue via-sketch-purple to-sketch-pink text-white border-2 border-white shadow-sketch-lg flex items-center justify-center hover:scale-105 transition-transform" title="打开 AI 答疑助手" aria-label="打开 AI 答疑助手">
        <Bot size={27} strokeWidth={2.2} />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sketch-green border-2 border-white" />
      </button>
    </>
  );
}
