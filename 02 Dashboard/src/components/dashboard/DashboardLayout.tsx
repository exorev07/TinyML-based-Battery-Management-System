import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useBMSData } from '../../services/mockBmsService'
import { AlertSeverity } from '../../types/bms'
import type { BMSData, HistoryPoint, BMSAlert, SystemStatus } from '../../types/bms'

type DisconnectCause = { code?: string; message: string; timestamp: number } | null

interface BMSContextValue {
  data: BMSData | null
  history: HistoryPoint[]
  alerts: BMSAlert[]
  addAlert: (alert: BMSAlert) => void
  updateAlertAction: (id: string, action: string) => void
  updateAlertActionsForIds: (ids: string[], action: string) => void
  relayOverride: boolean
  setRelayOverride: (v: boolean) => void
  disconnectCause: DisconnectCause
  setDisconnectCause: (v: DisconnectCause) => void
  relayLatchedRef: React.MutableRefObject<boolean>
}

const BMSContext = createContext<BMSContextValue>({
  data: null, history: [], alerts: [],
  addAlert: () => {}, updateAlertAction: () => {}, updateAlertActionsForIds: () => {},
  relayOverride: true, setRelayOverride: () => {},
  disconnectCause: null, setDisconnectCause: () => {},
  relayLatchedRef: { current: false },
})

export const useBMS = () => useContext(BMSContext)

function deriveStatus(_data: BMSData, alerts: BMSAlert[]): SystemStatus {
  const cutoff = Date.now() - 30_000
  const recent = alerts.filter(a => a.timestamp >= cutoff)

  if (recent.some(a => a.severity === AlertSeverity.CRITICAL)) return 'CRITICAL'
  if (recent.some(a => a.severity === AlertSeverity.SEVERE)) return 'SEVERE'
  if (recent.some(a => a.severity === AlertSeverity.ATTENTION_REQUIRED)) return 'WARNING'

  return 'NOMINAL'
}

export function DashboardLayout() {
  const bms = useBMSData()
  const [relayOverride, setRelayOverride] = useState(true)
  const [disconnectCause, setDisconnectCause] = useState<DisconnectCause>(null)
  const relayLatchedRef = useRef(false)

  const cutoff = Date.now() - 30_000
  const criticalAlertTriggered = bms.alerts.some(
    a => a.timestamp >= cutoff && a.severity === 'CRITICAL' && !a.code.startsWith('RLY')
  )

  useEffect(() => {
    if (!criticalAlertTriggered || relayLatchedRef.current) return
    relayLatchedRef.current = true
    const now = Date.now() - 30_000
    const causes = bms.alerts.filter(
      a => a.timestamp >= now && a.severity === 'CRITICAL' && !a.code.startsWith('RLY')
    )
    const primary = causes.sort((a, b) => b.timestamp - a.timestamp)[0]
    setRelayOverride(false)
    if (primary) {
      setDisconnectCause({ code: primary.code, message: primary.message, timestamp: primary.timestamp })
      bms.updateAlertActionsForIds(causes.map(c => c.id), 'Relay Disconnected')
    }
  }, [criticalAlertTriggered])

  const status = bms.data ? deriveStatus(bms.data, bms.alerts) : 'NOMINAL'

  return (
    <BMSContext.Provider value={{ ...bms, relayOverride, setRelayOverride, disconnectCause, setDisconnectCause, relayLatchedRef }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#08080a' }}>
        <Sidebar status={status} />
        <main style={{ flex: 1, overflow: 'auto', padding: 'clamp(16px, 2vw, 28px) clamp(16px, 2.5vw, 32px)' }}>
          <Outlet />
        </main>
      </div>
    </BMSContext.Provider>
  )
}
