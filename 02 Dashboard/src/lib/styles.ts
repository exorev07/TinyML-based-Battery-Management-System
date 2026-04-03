import type { CSSProperties } from 'react'

export const colors = {
  bg: '#08080a',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.07)',
  border: 'rgba(141,110,179,0.3)',
  borderHover: 'rgba(141,110,179,0.58)',
  amethyst: { light: '#b18ddd', mid: '#7947BD', dark: '#6829c1' },
  text: { primary: '#ffffff', secondary: '#9ca3af', muted: '#6b7280' },
  status: { nominal: '#34d399', warning: '#fbbf24', critical: '#f87171' },
}

export const fonts = {
  heading: "'DM Serif Display', serif",
  body: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
  logo: "'Bitcount Grid Single', monospace",
}

export const glassCard: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(141,110,179,0.3)',
  borderRadius: '16px',
  padding: '20px',
}

export const chartColors = {
  primary: '#7947BD',
  secondary: '#b18ddd',
  tertiary: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#6b7280',
}
