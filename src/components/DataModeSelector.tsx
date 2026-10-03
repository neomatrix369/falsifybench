import { Bot, Database, Lock } from 'lucide-react'
import { LIVE_AGENT_UNAVAILABLE_REASON, PARTNER_UNAVAILABLE_REASON } from '../domain/provenance'

function Option({
  name,
  value,
  label,
  checked,
  disabled,
  reason,
}: {
  name: string
  value: string
  label: string
  checked: boolean
  disabled?: boolean
  reason?: string
}) {
  const reasonId = reason ? `${name}-${value}-reason` : undefined
  return (
    <label
      title={reason}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs ${
        checked ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-describedby={reasonId}
        readOnly
        className="h-3 w-3 accent-indigo-600"
      />
      {disabled && <Lock aria-hidden className="h-3 w-3" />}
      {label}
      {reason && (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      )}
    </label>
  )
}

export function DataModeSelector() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <fieldset className="flex items-center gap-1.5">
        <legend className="sr-only">Data mode</legend>
        <Database aria-hidden className="h-4 w-4 text-slate-500" />
        <span className="eyebrow mr-1" aria-hidden>
          Data
        </span>
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
          <Option name="data-mode" value="synthetic" label="Synthetic / Mocked — active" checked />
          <Option
            name="data-mode"
            value="partner"
            label="Partner data — unavailable"
            checked={false}
            disabled
            reason={PARTNER_UNAVAILABLE_REASON}
          />
        </div>
      </fieldset>
      <fieldset className="flex items-center gap-1.5">
        <legend className="sr-only">Agent execution</legend>
        <Bot aria-hidden className="h-4 w-4 text-slate-500" />
        <span className="eyebrow mr-1" aria-hidden>
          Agent
        </span>
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
          <Option name="agent-execution" value="scripted" label="Scripted fixture — active" checked />
          <Option
            name="agent-execution"
            value="live"
            label="Live agent — unavailable"
            checked={false}
            disabled
            reason={LIVE_AGENT_UNAVAILABLE_REASON}
          />
        </div>
      </fieldset>
    </div>
  )
}

export function UnavailableModesNote() {
  return (
    <p className="text-xs text-slate-500">
      <Lock aria-hidden className="mr-1 inline h-3 w-3 align-[-2px]" />
      Partner data: {PARTNER_UNAVAILABLE_REASON} Live agent: {LIVE_AGENT_UNAVAILABLE_REASON}
    </p>
  )
}
