import type { BracketRegion } from '../domain/types'

interface Shape {
  kind: 'rect' | 'poly'
  points?: string
  rect?: { x: number; y: number; w: number; h: number }
  label: { x: number; y: number }
}

const SHAPES: Record<string, Shape> = {
  R1: { kind: 'rect', rect: { x: 20, y: 20, w: 60, h: 180 }, label: { x: 50, y: 112 } },
  R2: { kind: 'rect', rect: { x: 80, y: 20, w: 180, h: 60 }, label: { x: 170, y: 54 } },
  R3: { kind: 'poly', points: '80,80 260,80 80,200', label: { x: 135, y: 118 } },
  R4: { kind: 'rect', rect: { x: 260, y: 20, w: 110, h: 60 }, label: { x: 315, y: 54 } },
  R5: { kind: 'rect', rect: { x: 370, y: 30, w: 130, h: 40 }, label: { x: 420, y: 54 } },
}

const READING_POINTS: [number, number][] = [
  [40, 50], [60, 150], [45, 185],
  [110, 40], [160, 66], [230, 40],
  [100, 110], [150, 92], [98, 165],
  [395, 42], [430, 60], [455, 42],
]

const c = (token: string) => `rgb(var(--${token}))`

interface Props {
  regions: BracketRegion[]
  /** Region revealed by the audit as having no ultrasonic readings. Undefined before the audit. */
  gapRegionId?: string
}

export function BracketSchematic({ regions, gapRegionId }: Props) {
  const revealed = Boolean(gapRegionId)
  const description = revealed
    ? `Static schematic of bracket B-17 with five regions. Ultrasonic reading points shown in ${regions
        .filter((r) => r.id !== gapRegionId)
        .map((r) => r.id)
        .join(', ')}. ${gapRegionId} is marked No readings.`
    : `Static schematic of bracket B-17 with five regions, R1 to R5. ${regions
        .filter((r) => r.note)
        .map((r) => `${r.id}: ${r.note}`)
        .join('. ')}.`

  return (
    <figure className="rounded-md border border-rule bg-sunken">
      <svg viewBox="0 0 520 220" role="img" aria-label={description} className="mx-auto h-auto max-h-[240px] w-full font-mono">
        <defs>
          <pattern id="drafting-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke={c('rule')} strokeWidth={0.75} />
          </pattern>
          <pattern id="gap-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill={c('warn-tint')} />
            <line x1="0" y1="0" x2="0" y2="8" stroke={c('warn-line')} strokeWidth="3" />
          </pattern>
        </defs>
        <rect width="520" height="220" fill="url(#drafting-grid)" />
        {regions.map((region) => {
          const shape = SHAPES[region.id]
          if (!shape) return null
          const isGap = region.id === gapRegionId
          const common = {
            fill: isGap ? 'url(#gap-stripes)' : c('surface'),
            stroke: isGap ? c('warn') : c('ink-2'),
            strokeWidth: isGap ? 2 : 1.25,
            className: isGap ? 'animate-reveal' : undefined,
          }
          return (
            <g key={region.id}>
              {shape.kind === 'rect' && shape.rect ? (
                <rect x={shape.rect.x} y={shape.rect.y} width={shape.rect.w} height={shape.rect.h} rx={1} {...common} />
              ) : (
                <polygon points={shape.points} strokeLinejoin="round" {...common} />
              )}
              <text
                x={shape.label.x}
                y={shape.label.y}
                textAnchor="middle"
                className="fill-ink text-[12px] font-semibold"
                style={isGap ? { paintOrder: 'stroke', stroke: c('warn-tint'), strokeWidth: 4 } : undefined}
              >
                {region.id}
              </text>
            </g>
          )
        })}
        {revealed &&
          READING_POINTS.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3.5} fill={c('primary')} stroke={c('surface')} strokeWidth={1.5} />
          ))}
        {revealed && gapRegionId && SHAPES[gapRegionId]?.rect && (
          <g>
            <rect
              x={SHAPES[gapRegionId].rect!.x + 12}
              y={SHAPES[gapRegionId].rect!.y + 66}
              width={86}
              height={20}
              rx={2}
              fill={c('warn')}
            />
            <text
              x={SHAPES[gapRegionId].rect!.x + 55}
              y={SHAPES[gapRegionId].rect!.y + 80}
              textAnchor="middle"
              className="fill-surface text-[11px] font-semibold"
            >
              No readings
            </text>
          </g>
        )}
        {!revealed && (
          <text x={315} y={71} textAnchor="middle" className="fill-ink-3 text-[10px]">
            restricted access
          </text>
        )}
        <text x={508} y={210} textAnchor="end" className="fill-ink-3 text-[10px]">
          B-17
        </text>
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-3 py-2 text-meta text-ink-2">
        {regions.map((r) => (
          <span key={r.id}>
            <span className="font-mono font-semibold text-ink">{r.id}</span> {r.name}
            {r.note && !revealed ? ` (${r.note.toLowerCase()})` : ''}
          </span>
        ))}
        {revealed && (
          <span className="flex items-center gap-1">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-primary" /> Ultrasonic reading point
          </span>
        )}
        <span className="text-ink-3">Visual aid only — not a physical simulation or CAD model.</span>
      </figcaption>
    </figure>
  )
}
