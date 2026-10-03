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
    <figure className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <svg viewBox="0 0 520 220" role="img" aria-label={description} className="mx-auto h-auto max-h-[240px] w-full">
        <defs>
          <pattern id="gap-stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="#fef3c7" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#d97706" strokeWidth="4" />
          </pattern>
        </defs>
        {regions.map((region) => {
          const shape = SHAPES[region.id]
          if (!shape) return null
          const isGap = region.id === gapRegionId
          const common = {
            fill: isGap ? 'url(#gap-stripes)' : '#ffffff',
            stroke: isGap ? '#b45309' : '#94a3b8',
            strokeWidth: isGap ? 2.5 : 1.5,
          }
          return (
            <g key={region.id}>
              {shape.kind === 'rect' && shape.rect ? (
                <rect x={shape.rect.x} y={shape.rect.y} width={shape.rect.w} height={shape.rect.h} rx={4} {...common} />
              ) : (
                <polygon points={shape.points} {...common} />
              )}
              <text
                x={shape.label.x}
                y={shape.label.y}
                textAnchor="middle"
                className="fill-slate-700 text-[13px] font-semibold"
                style={isGap ? { paintOrder: 'stroke', stroke: '#fef3c7', strokeWidth: 4 } : undefined}
              >
                {region.id}
              </text>
            </g>
          )
        })}
        {revealed &&
          READING_POINTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#4f46e5" stroke="#fff" strokeWidth={1.5} />)}
        {revealed && gapRegionId && SHAPES[gapRegionId]?.rect && (
          <g>
            <rect
              x={SHAPES[gapRegionId].rect!.x + 12}
              y={SHAPES[gapRegionId].rect!.y + 66}
              width={86}
              height={22}
              rx={11}
              fill="#92400e"
            />
            <text
              x={SHAPES[gapRegionId].rect!.x + 55}
              y={SHAPES[gapRegionId].rect!.y + 81}
              textAnchor="middle"
              className="fill-white text-[11px] font-semibold"
            >
              No readings
            </text>
          </g>
        )}
        {!revealed && (
          <text x={315} y={71} textAnchor="middle" className="fill-slate-500 text-[10px]">
            restricted access
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        {regions.map((r) => (
          <span key={r.id}>
            <span className="font-semibold">{r.id}</span> {r.name}
            {r.note && !revealed ? ` (${r.note.toLowerCase()})` : ''}
          </span>
        ))}
        {revealed && (
          <span className="flex items-center gap-1">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600" /> Ultrasonic reading point
          </span>
        )}
        <span className="text-slate-400">Visual aid only — not a physical simulation or CAD model.</span>
      </figcaption>
    </figure>
  )
}
