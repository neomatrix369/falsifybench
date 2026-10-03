/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

// Palette is replaced, not extended: components can only reach the tokens below
// (defined once in src/index.css and documented in DESIGN.md).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ground: token('ground'),
      surface: token('surface'),
      sunken: token('sunken'),
      ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
      rule: { DEFAULT: token('rule'), strong: token('rule-strong') },
      primary: { DEFAULT: token('primary'), hover: token('primary-hover'), tint: token('primary-tint'), on: token('on-primary') },
      focus: token('focus'),
      ok: { DEFAULT: token('ok'), tint: token('ok-tint'), line: token('ok-line') },
      warn: { DEFAULT: token('warn'), tint: token('warn-tint'), line: token('warn-line') },
      risk: { DEFAULT: token('risk'), tint: token('risk-tint'), line: token('risk-line') },
      shell: { DEFAULT: token('shell'), ink: token('shell-ink'), muted: token('shell-muted'), line: token('shell-line') },
    },
    fontFamily: {
      sans: ['"Archivo Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['"Red Hat Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    fontSize: {
      // 4-step scale + one signature size for the outcome reading.
      meta: ['0.75rem', { lineHeight: '1.1rem' }],
      body: ['0.875rem', { lineHeight: '1.4rem' }],
      lead: ['1rem', { lineHeight: '1.55rem' }],
      title: ['1.125rem', { lineHeight: '1.5rem' }],
      display: ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.012em' }],
      reading: ['2.5rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
    },
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '3px',
      md: '4px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      sheet: '0 1px 2px rgb(var(--ink) / 0.06), 0 2px 8px -2px rgb(var(--ink) / 0.06)',
      shell: '0 1px 0 rgb(var(--shell-line)), 0 4px 12px -6px rgb(var(--ink) / 0.35)',
    },
    extend: {
      transitionTimingFunction: { out: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      transitionDuration: { fast: '120ms', base: '200ms', reveal: '520ms' },
      maxWidth: { page: '1440px' },
    },
  },
  plugins: [],
}
