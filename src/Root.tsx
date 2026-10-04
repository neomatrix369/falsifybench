import { useCallback, useState } from 'react'
import App from './App'
import { Landing } from './components/Landing'
import type { View } from './components/Header'

export const INTRO_DISMISSED_KEY = 'falsifybench-intro-dismissed'

function initialView(): View {
  if (window.location.hash === '#about') return 'about'
  try {
    return window.sessionStorage.getItem(INTRO_DISMISSED_KEY) ? 'benchmark' : 'about'
  } catch {
    return 'about'
  }
}

/** Switches between the About (landing) view and the benchmark. The benchmark stays mounted so a run survives a visit to About. */
export default function Root() {
  const [view, setView] = useState<View>(initialView)

  const switchView = useCallback((next: View) => {
    if (next === 'benchmark') {
      try {
        window.sessionStorage.setItem(INTRO_DISMISSED_KEY, '1')
      } catch {
        // Storage unavailable: the switch still works for this page view.
      }
    }
    if (window.location.hash === '#about') history.replaceState(null, '', window.location.pathname + window.location.search)
    setView(next)
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-view="${next}"] header [data-view-switch="${next}"]`)?.focus()
    })
  }, [])

  return (
    <>
      {view === 'about' && (
        <div data-view="about">
          <Landing onSwitchView={switchView} />
        </div>
      )}
      <div data-view="benchmark" hidden={view !== 'benchmark'}>
        <App onSwitchView={switchView} />
      </div>
    </>
  )
}
