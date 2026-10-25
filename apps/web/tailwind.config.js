/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Epilogue', 'system-ui', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        // Theme fonts (src/theme/tokens.css)
        ui: 'var(--font-ui)',
        display: 'var(--font-display)',
      },
      // Theme colors: bg-panel, text-ink-3, border-line, bg-ok-bg …
      colors: {
        ground: 'var(--surface-ground)',
        sidebar: 'var(--surface-sidebar)',
        panel: 'var(--surface-panel)',
        soft: 'var(--surface-soft)',
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        focus: 'var(--focus)',
        primary: { DEFAULT: 'var(--primary)', on: 'var(--on-primary)' },
        ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)', solid: 'var(--ok-solid)' },
        warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', solid: 'var(--warn-solid)' },
        bad: { bg: 'var(--bad-bg)', fg: 'var(--bad-fg)', solid: 'var(--bad-solid)' },
        idle: { bg: 'var(--idle-bg)', fg: 'var(--idle-fg)' },
      },
      borderRadius: {
        pill: 'var(--radius-pill)',
        control: 'var(--radius-control)',
        panel: 'var(--radius-panel)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
      },
      spacing: {
        touch: 'var(--touch)',
      },
    },
  },
  plugins: [],
};
