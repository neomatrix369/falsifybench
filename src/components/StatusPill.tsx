import type { ReactNode } from 'react'

type Tone = 'neutral' | 'indigo' | 'green' | 'amber' | 'red'

const TONES: Record<Tone, string> = {
  neutral: 'border-slate-300 bg-slate-50 text-slate-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-300 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-800',
}

export function StatusPill({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}
    >
      {icon}
      {children}
    </span>
  )
}
