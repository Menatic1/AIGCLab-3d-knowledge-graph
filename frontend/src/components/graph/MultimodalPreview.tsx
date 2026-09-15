import { useState } from 'react';
import { Braces, Image, Play, Sigma, Video } from 'lucide-react';
import type { KnowledgeNode, MultimodalType } from '../../types';
import { MULTIMODAL_META } from '../../mock/sampleKnowledgeGraph';

const RESOURCE_ICON: Record<MultimodalType, typeof Image> = {
  image: Image,
  formula: Sigma,
  code: Braces,
  video: Video,
};

export default function MultimodalPreview({ node }: { node: KnowledgeNode }) {
  const [activeStep, setActiveStep] = useState(0);
  const media = node.multimodal;
  if (!media) return null;

  const meta = MULTIMODAL_META[media.type];
  const Icon = RESOURCE_ICON[media.type];
  const steps = media.content.split('|').filter(Boolean);
  const videoSteps = steps.length ? steps : ['课程讲解'];

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-sketch-sm border border-ink/15 flex items-center justify-center" style={{ background: meta.bgColor, color: meta.color }}>
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <h4 className="font-bold text-ink text-sm">{meta.label}</h4>
          {media.caption && <p className="text-[11px] text-ink-light truncate">{media.caption}</p>}
        </div>
      </div>

      {media.type === 'image' && (
        <div className="sketch-card overflow-hidden p-3" style={{ background: `${meta.bgColor}99`, borderColor: `${meta.color}66` }}>
          <div className="grid grid-cols-2 gap-2">
            {steps.map((step, index) => (
              <div key={step} className="relative min-h-12 flex items-center justify-center text-center px-2 py-2 bg-paper-50 border border-ink/15 text-[11px] text-ink leading-snug">
                <span className="absolute top-1 left-1 text-[8px] font-bold" style={{ color: meta.color }}>0{index + 1}</span>
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {media.type === 'formula' && (
        <div className="sketch-card p-4 text-center overflow-x-auto" style={{ background: `${meta.bgColor}99`, borderColor: `${meta.color}66` }}>
          <code className="text-[15px] md:text-base text-ink whitespace-nowrap" style={{ fontFamily: 'Cambria Math, Cambria, serif' }}>{media.content}</code>
        </div>
      )}

      {media.type === 'code' && (
        <div className="overflow-hidden border-2 border-ink/25 bg-[#263b43] shadow-sketch-sm">
          <div className="flex items-center justify-between px-3 py-2 bg-[#36515b] text-[10px] text-white/80 font-mono">
            <span>{media.language ?? 'Code'}</span><span>示例</span>
          </div>
          <pre className="max-h-64 overflow-auto p-3 text-[11px] leading-relaxed text-[#f4ead2] font-mono whitespace-pre">{media.content}</pre>
        </div>
      )}

      {media.type === 'video' && (
        <div className="sketch-card overflow-hidden" style={{ background: `${meta.bgColor}99`, borderColor: `${meta.color}66` }}>
          <button onClick={() => setActiveStep((activeStep + 1) % videoSteps.length)} className="relative h-32 w-full text-left overflow-hidden bg-[#3d4649] hover:bg-[#4a5659] transition-colors" aria-label="查看下一段视频分镜">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(135deg, transparent 35%, rgba(255,255,255,.38) 35% 37%, transparent 37% 63%, rgba(255,255,255,.22) 63% 65%, transparent 65%)' }} />
            <span className="absolute inset-0 flex items-center justify-center"><span className="w-11 h-11 rounded-full bg-paper-50/90 text-ink flex items-center justify-center border-2 border-white shadow-sketch-sm"><Play size={17} fill="currentColor" /></span></span>
            <span className="absolute bottom-3 left-3 right-3 text-center text-xs text-white font-bold leading-snug">{videoSteps[activeStep]}</span>
            {media.duration && <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/55 text-white text-[10px]">{media.duration}</span>}
          </button>
          <div className="flex gap-1 px-3 py-2">
            {videoSteps.map((step, index) => <button key={step} onClick={() => setActiveStep(index)} title={step} className="h-1.5 flex-1" style={{ background: index === activeStep ? meta.color : '#d8d4c9' }} aria-label={`查看第 ${index + 1} 段`} />)}
          </div>
        </div>
      )}
    </section>
  );
}
