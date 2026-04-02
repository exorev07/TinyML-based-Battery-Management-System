import { useState } from 'react'
import { glassCard, fonts, colors } from '../../lib/styles'
import type { LucideIcon } from 'lucide-react'

const tipStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 10px)',
  right: 0,
  width: '210px',
  padding: '10px 13px',
  background: 'rgba(10,8,16,0.94)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(141,110,179,0.28)',
  borderRadius: '10px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(141,110,179,0.06)',
  fontFamily: fonts.body,
  fontSize: '12px',
  color: colors.text.secondary,
  lineHeight: 1.55,
  zIndex: 50,
  pointerEvents: 'none',
  textAlign: 'justify',
}

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  subtext?: string
  icon: LucideIcon
  color?: string
  tooltip?: string
}

export function StatCard({ label, value, unit, subtext, icon: Icon, color = colors.amethyst.light, tooltip }: StatCardProps) {
  const [showTip, setShowTip] = useState(false)
  return (
    <div style={{
      ...glassCard,
      display: 'flex', flexDirection: 'column', gap: '12px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: fonts.body, fontSize: '13px', fontWeight: 500,
          color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {label}
        </span>
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => tooltip && setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: tooltip ? 'default' : undefined,
          }}>
            <Icon size={16} color={colors.text.muted} />
          </div>
          {showTip && tooltip && <div style={tipStyle}>{tooltip}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
        <span style={{
          fontFamily: fonts.mono, fontSize: '24px', fontWeight: 700,
          color: colors.text.primary, lineHeight: 1,
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: fonts.mono, fontSize: '14px', color: colors.text.muted }}>
            {unit}
          </span>
        )}
      </div>
      {subtext && (
        <span style={{ fontFamily: fonts.body, fontSize: '12px', color: colors.text.muted, textAlign: 'center' }}>
          {subtext}
        </span>
      )}
    </div>
  )
}
