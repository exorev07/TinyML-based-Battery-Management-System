import type { CSSProperties, ReactNode } from 'react'
import { glassCard, fonts, colors } from '../../lib/styles'

interface GlassCardProps {
  title?: string
  headerRight?: ReactNode
  children: ReactNode
  style?: CSSProperties
}

export function GlassCard({ title, headerRight, children, style }: GlassCardProps) {
  return (
    <div style={{ ...glassCard, ...style }}>
      {(title || headerRight) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          {title && (
            <h3 style={{
              fontFamily: fonts.body, fontSize: '13px', fontWeight: 600,
              color: colors.text.muted, letterSpacing: '0.06em',
              textTransform: 'uppercase', margin: 0,
            }}>
              {title}
            </h3>
          )}
          {headerRight}
        </div>
      )}
      {children}
    </div>
  )
}
