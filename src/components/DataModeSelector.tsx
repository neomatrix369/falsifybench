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
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-meta focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus ${
        checked ? 'bg-surface font-semibold text-ink shadow-sheet ring-1 ring-rule-strong/60' : 'text-ink-3'
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
        className="h-3 w-3 accent-primary focus-visible:outline-none"
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
    <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">Data mode</legend>
        <Database aria-hidden className="h-3.5 w-3.5 text-ink-3" />
        <span className="label" aria-hidden>
          Data
        </span>
        <div className="flex items-center gap-0.5 rounded bg-ground p-0.5 ring-1 ring-inset ring-rule">
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
      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">Agent execution</legend>
        <Bot aria-hidden className="h-3.5 w-3.5 text-ink-3" />
        <span className="label" aria-hidden>
          Agent
        </span>
        <div className="flex items-center gap-0.5 rounded bg-ground p-0.5 ring-1 ring-inset ring-rule">
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
    <p className="px-1 text-meta text-ink-3">
      <Lock aria-hidden className="mr-1 inline h-3 w-3 align-[-2px]" />
      Partner data: {PARTNER_UNAVAILABLE_REASON} Live agent: {LIVE_AGENT_UNAVAILABLE_REASON}
    </p>
  )
}
