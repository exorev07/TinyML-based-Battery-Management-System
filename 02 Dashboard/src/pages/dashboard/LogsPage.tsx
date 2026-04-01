import { useState } from 'react'
import { AlertTriangle, Download, Filter } from 'lucide-react'
import { useBMS } from '../../components/dashboard/DashboardLayout'
import { GlassCard } from '../../components/dashboard/GlassCard'
import { fonts, colors } from '../../lib/styles'
import { AlertSeverity } from '../../types/bms'

type SeverityFilter = 'ALL' | 'CRITICAL' | 'SEVERE' | 'ATTENTION_REQUIRED'

export default function LogsPage() {
  const { alerts } = useBMS()
  const [filter, setFilter] = useState<SeverityFilter>('ALL')
  const [search, setSearch] = useState('')

  const filtered = alerts.filter((a) => {
    if (filter !== 'ALL' && a.severity !== filter) return false
    if (search && !a.code.toLowerCase().includes(search.toLowerCase()) && !a.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const exportCSV = () => {
    const header = 'Date,Time,Code,Severity,Message,Action Taken\n'
    const rows = filtered.map((a) => {
      const d = new Date(a.timestamp)
      return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })},${d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })},${a.code},${a.severity},"${a.message}","${a.action ?? ''}"`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `cyphev-logs-${Date.now()}.csv`
    link.click(); URL.revokeObjectURL(url)
  }

  const filterBtns: { label: string; value: SeverityFilter }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'Severe', value: 'SEVERE' },
    { label: 'Attention', value: 'ATTENTION_REQUIRED' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1800px', margin: '0 auto', width: '100%' }}>
      <div>
        <h1 style={{ fontFamily: fonts.heading, fontSize: '24px', fontWeight: 600, color: colors.text.primary, margin: 0 }}>
          Event Logs
        </h1>
        <p style={{ fontFamily: fonts.body, fontSize: '13px', color: colors.text.muted, marginTop: '4px' }}>
          {alerts.length} total events captured
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Left: Severity filter */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', height: '40px', alignItems: 'center' }}>
            {filterBtns.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value)}
                style={{
                  fontFamily: fonts.body, fontSize: '12px', fontWeight: 500,
                  padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: filter === btn.value ? 'rgba(121,71,189,0.2)' : 'transparent',
                  color: filter === btn.value ? colors.amethyst.light : colors.text.muted,
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Search */}
        <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '800px' }}>
          <Filter size={14} color={colors.text.muted} />
          <input
            type="text"
            placeholder="Search by code or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, fontFamily: fonts.body, fontSize: '13px',
              padding: '0 12px', height: '40px', boxSizing: 'border-box',
              borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)', color: colors.text.primary,
              outline: 'none',
            }}
          />
        </div>

        {/* Right: Export */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: fonts.body, fontSize: '12px', fontWeight: 600,
              padding: '0 16px', height: '40px', boxSizing: 'border-box', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: 'rgba(121,71,189,0.15)', color: colors.amethyst.light,
              transition: 'background 0.2s',
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 110px 100px 160px 1fr 220px', columnGap: '16px',
          padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          {['Date', 'Time', 'Code', 'Severity', 'Message', 'Action Taken'].map((h) => (
            <span key={h} style={{
              fontFamily: fonts.body, fontSize: '11px', fontWeight: 600,
              color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
              textAlign: h === 'Action Taken' ? 'center' : 'left',
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: fonts.body, fontSize: '13px', color: colors.text.muted }}>
              No events match the current filter
            </div>
          ) : filtered.map((alert) => (
            <div key={alert.id} style={{
              display: 'grid', gridTemplateColumns: '100px 110px 100px 160px 1fr 220px', columnGap: '16px',
              padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.03)',
              transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.text.secondary }}>
                {new Date(alert.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.text.secondary }}>
                {new Date(alert.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: '12px', fontWeight: 600, color: colors.text.primary }}>
                {alert.code}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {(() => {
                  const c = alert.severity === AlertSeverity.CRITICAL ? colors.status.critical
                    : alert.severity === AlertSeverity.SEVERE ? '#f97316'
                    : colors.status.warning
                  const label = alert.severity === AlertSeverity.CRITICAL ? 'CRITICAL'
                    : alert.severity === AlertSeverity.SEVERE ? 'SEVERE'
                    : 'ATTENTION'
                  return <>
                    <AlertTriangle size={11} color={c} />
                    <span style={{ fontFamily: fonts.mono, fontSize: '10px', fontWeight: 600, color: c }}>{label}</span>
                  </>
                })()}
              </div>
              <span style={{ fontFamily: fonts.body, fontSize: '12px', color: colors.text.secondary }}>
                {alert.message}
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: '11px', fontWeight: 500, color: alert.action ? colors.amethyst.light : colors.text.muted, textAlign: 'center' }}>
                {alert.action ?? '—'}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
