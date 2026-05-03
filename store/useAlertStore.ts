import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { Alert, AlertRule } from "@prisma/client"

interface AlertState {
  alerts: Alert[]
  rules: AlertRule[]
  unreadCount: number
  isScanning: boolean
  lastScanAt: number | null
  popoverOpen: boolean
}

interface AlertActions {
  setAlerts: (alerts: Alert[]) => void
  addAlerts: (alerts: Alert[]) => void
  setRules: (rules: AlertRule[]) => void
  setUnreadCount: (count: number) => void
  setScanning: (scanning: boolean) => void
  setLastScanAt: (ts: number) => void
  setPopoverOpen: (open: boolean) => void
  markAsRead: (ids: string[]) => void
  markAllRead: () => void
}

export const useAlertStore = create<AlertState & AlertActions>()(
  immer((set) => ({
    alerts: [],
    rules: [],
    unreadCount: 0,
    isScanning: false,
    lastScanAt: null,
    popoverOpen: false,

    setAlerts: (alerts) =>
      set((state) => {
        state.alerts = alerts
        state.unreadCount = alerts.filter((a) => !a.read).length
      }),

    addAlerts: (newAlerts) =>
      set((state) => {
        state.alerts = [...newAlerts, ...state.alerts]
        state.unreadCount += newAlerts.filter((a) => !a.read).length
      }),

    setRules: (rules) =>
      set((state) => {
        state.rules = rules
      }),

    setUnreadCount: (count) =>
      set((state) => {
        state.unreadCount = count
      }),

    setScanning: (scanning) =>
      set((state) => {
        state.isScanning = scanning
      }),

    setLastScanAt: (ts) =>
      set((state) => {
        state.lastScanAt = ts
      }),

    setPopoverOpen: (open) =>
      set((state) => {
        state.popoverOpen = open
      }),

    markAsRead: (ids) =>
      set((state) => {
        const idSet = new Set(ids)
        state.alerts = state.alerts.map((a) =>
          idSet.has(a.id) ? { ...a, read: true } : a
        )
        state.unreadCount = state.alerts.filter((a) => !a.read).length
      }),

    markAllRead: () =>
      set((state) => {
        state.alerts = state.alerts.map((a) => ({ ...a, read: true }))
        state.unreadCount = 0
      }),
  }))
)
