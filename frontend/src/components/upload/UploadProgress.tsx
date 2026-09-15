import { FileText, Loader2, CheckCircle2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import type { UploadedDocument } from '../../types';

interface Props {
  documents: UploadedDocument[];
  onParse: (id: string) => void;
  parsingId?: string | null;
}

const TYPE_META: Record<UploadedDocument['type'], { label: string; cls: string }> = {
  pdf:  { label: 'PDF',  cls: 'bg-sketch-red/15 text-sketch-red border-sketch-red/30' },
  docx: { label: 'DOCX', cls: 'bg-sketch-blue/15 text-sketch-blueDeep border-sketch-blue/30' },
  txt:  { label: 'TXT',  cls: 'bg-sketch-green/15 text-sketch-greenDeep border-sketch-green/30' },
  md:   { label: 'MD',   cls: 'bg-sketch-purple/15 text-sketch-purple border-sketch-purple/40' },
};

const STATUS_META: Record<UploadedDocument['status'], { text: string; cls: string; icon?: any }> = {
  uploading: { text: '上传中...',   cls: 'text-sketch-orangeDeep', icon: Loader2 },
  uploaded:  { text: '已上传',     cls: 'text-sketch-blueDeep' },
  parsing:   { text: 'AI 解析中...', cls: 'text-sketch-purple',  icon: Loader2 },
  parsed:    { text: '解析完成',   cls: 'text-sketch-greenDeep', icon: CheckCircle2 },
  failed:    { text: '解析失败',   cls: 'text-sketch-red',       icon: AlertCircle },
  error:     { text: '解析失败',   cls: 'text-sketch-red',       icon: AlertCircle },
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export default function UploadProgress({ documents, onParse, parsingId }: Props) {
  if (documents.length === 0) return null;
  return (
    <div className="sketch-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-sketch-blue/20 flex items-center justify-center">
          <FileText size={15} className="text-sketch-blueDeep" />
        </div>
        <h4 className="font-bold text-ink">已上传文档</h4>
        <span className="sketch-tag bg-paper-200 text-ink border-ink/20">
          {documents.length} 个
        </span>
      </div>
      <div className="space-y-3">
        {documents.map((doc) => {
          const tm = TYPE_META[doc.type];
          const sm = STATUS_META[doc.status];
          const Icon = sm.icon;
          const canParse = doc.status === 'uploaded' || doc.status === 'failed' || doc.status === 'error';
          const isParsing = doc.status === 'parsing' || parsingId === doc.id;
          return (
            <div
              key={doc.id}
              className="group relative bg-paper-100/70 rounded-sketch-sm border-2 border-ink/10 p-3.5 hover:border-sketch-blue/40 hover:bg-paper-50 transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className={
                    'w-11 h-11 shrink-0 rounded-sketch-sm border-2 flex items-center justify-center handwritten font-bold text-lg shadow-sm ' +
                    tm.cls
                  }
                >
                  {tm.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink truncate max-w-[70%]">{doc.name}</span>
                    <span className="text-[11px] text-ink-light shrink-0">
                      {formatSize(doc.size)}
                    </span>
                    <span className={'text-xs font-bold ' + sm.cls + ' flex items-center gap-1'}>
                      {Icon && <Icon size={13} className={isParsing ? 'animate-spin' : ''} />}
                      {sm.text}
                    </span>
                  </div>
                  {/* 进度条 */}
                  <div className="mt-2 relative h-2 bg-paper-200 rounded-full border border-ink/10 overflow-hidden">
                    <div
                      className={
                        'absolute inset-y-0 left-0 transition-all duration-500 ' +
                        (doc.status === 'parsed'
                          ? 'bg-gradient-to-r from-sketch-green to-sketch-blue'
                          : doc.status === 'failed' || doc.status === 'error'
                            ? 'bg-sketch-red'
                            : 'bg-gradient-to-r from-sketch-orange via-sketch-yellow to-sketch-green')
                      }
                      style={{ width: `${doc.progress}%` }}
                    />
                  </div>
                  {/* 错误信息 */}
                  {(doc.status === 'error' || doc.status === 'failed') && doc.errorMsg && (
                    <div className="mt-2 text-[11px] text-sketch-red bg-sketch-red/8 rounded-sketch-sm px-2.5 py-1.5 border border-sketch-red/20 break-words">
                      {doc.errorMsg}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="text-[11px] text-ink-light">
                      上传于 {new Date(doc.uploadAt).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {canParse && (
                    <button
                      onClick={() => onParse(doc.id)}
                      className="sketch-btn-warm text-sm"
                    >
                      <Sparkles size={14} />
                      开始 AI 解析
                      <ArrowRight size={14} />
                    </button>
                  )}
                  {doc.status === 'parsed' && (
                    <span className="sketch-tag bg-sketch-green/15 text-sketch-greenDeep border-sketch-green/30 gap-1">
                      <CheckCircle2 size={12} /> 已生成图谱
                    </span>
                  )}
                  {isParsing && (
                    <span className="text-xs text-sketch-purple font-bold animate-pulse handwritten">
                      LLM 抽取知识点中…
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
