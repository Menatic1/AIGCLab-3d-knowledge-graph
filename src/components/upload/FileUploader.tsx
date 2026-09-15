import React, { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';

interface Props {
  onFiles: (files: FileList) => void;
}

const ACCEPT = '.pdf,.docx,.pptx,.txt,.md';

export default function FileUploader({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={[
        'group relative cursor-pointer transition-all duration-200',
        'rounded-sketch border-2 border-dashed p-8 text-center',
        dragging
          ? 'border-sketch-blue bg-sketch-blue/10 scale-[1.01] shadow-sketch-lg'
          : 'border-ink/30 bg-paper-50 hover:border-sketch-blue/60 hover:bg-paper-100 hover:shadow-sketch',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />

      <div className="relative">
        <div className="mx-auto w-16 h-16 mb-4 rounded-sketch bg-gradient-to-br from-sketch-blue/80 via-sketch-purple/70 to-sketch-pink/80 border-2 border-white/60 shadow-sketch flex items-center justify-center group-hover:scale-105 transition-transform">
          <Upload size={32} className="text-white" strokeWidth={2.2} />
        </div>
        <h3 className="text-lg font-bold text-ink handwritten mb-2">
          拖拽或点击选择文件
        </h3>
        <div className="inline-flex flex-wrap justify-center gap-2 mb-1">
          {[
            { k: 'PDF',  c: 'bg-sketch-red/15    text-sketch-red      border-sketch-red/30' },
            { k: 'DOCX', c: 'bg-sketch-blue/15   text-sketch-blueDeep border-sketch-blue/30' },
            { k: 'PPTX', c: 'bg-sketch-orange/15 text-sketch-orangeDeep border-sketch-orange/30' },
            { k: 'TXT',  c: 'bg-sketch-green/15  text-sketch-greenDeep border-sketch-green/30' },
            { k: 'MD',   c: 'bg-sketch-purple/15 text-sketch-purple    border-sketch-purple/40' },
          ].map((t) => (
            <span key={t.k} className={'sketch-tag ' + t.c}>
              <FileText size={12} className="mr-1" />
              {t.k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
