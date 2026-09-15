import { RELATION_META, CATEGORY_META } from '../../mock/sampleKnowledgeGraph';

interface Props {
  className?: string;
}

export default function RelationLegend({ className }: Props) {
  return (
    <div className={'sketch-card p-2.5 text-xs ' + (className || '')}>
      <div className="mb-2">
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm shrink-0"
                style={{ background: v.color }}
              />
              <span className="text-ink truncate">{v.label}</span>
            </div>
          ))}
        </div>
      </div>
      <hr className="sketch-divider my-1.5" />
      <div className="space-y-1.5">
        {Object.entries(RELATION_META).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <svg width="36" height="12" className="shrink-0">
              <line
                x1="2" y1="6" x2="30" y2="6"
                stroke={v.color}
                strokeWidth="2.2"
                strokeDasharray={v.dash ? '4 3' : undefined}
                markerEnd={`url(#arr_${k})`}
              />
              <defs>
                <marker
                  id={`arr_${k}`}
                  viewBox="0 0 10 10"
                  refX="8" refY="5"
                  markerWidth="6" markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={v.color} />
                </marker>
              </defs>
            </svg>
            <span className="text-ink truncate">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
