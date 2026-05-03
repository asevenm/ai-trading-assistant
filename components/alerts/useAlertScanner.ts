"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAlertStore } from "@/store/useAlertStore"

const SCAN_INTERVAL = 30 * 1000 // 30 seconds

/** Check if current time is within A-stock or HK-stock market hours (China time UTC+8) */
function isMarketOpen(): boolean {
  const now = new Date()
  // Convert to China time (UTC+8)
  const chinaOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const chinaTime = new Date(now.getTime() + (chinaOffset + localOffset) * 60000)

  const day = chinaTime.getDay()
  // Weekend: no market
  if (day === 0 || day === 6) return false

  const hours = chinaTime.getHours()
  const minutes = chinaTime.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  // A股: 9:30-11:30, 13:00-15:00
  // 港股: 9:30-12:00, 13:00-16:00
  // 取两者的并集: 9:30-12:00, 13:00-16:00
  const morningOpen = 9 * 60 + 30
  const morningClose = 12 * 60       // HK closes at 12:00
  const afternoonOpen = 13 * 60
  const afternoonClose = 16 * 60     // HK closes at 16:00

  return (
    (timeInMinutes >= morningOpen && timeInMinutes <= morningClose) ||
    (timeInMinutes >= afternoonOpen && timeInMinutes <= afternoonClose)
  )
}

export function useAlertScanner() {
  const {
    isScanning,
    setScanning,
    setLastScanAt,
    addAlerts,
    setAlerts,
    setRules,
  } = useAlertStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isScanningRef = useRef(false)

  // Keep ref in sync with state
  useEffect(() => {
    isScanningRef.current = isScanning
  }, [isScanning])

  const scan = useCallback(async () => {
    // Skip scan outside market hours
    if (!isMarketOpen()) return
    // Use ref to avoid dependency on isScanning state
    if (isScanningRef.current) return
    setScanning(true)
    try {
      const res = await fetch("/api/alerts/scan", { method: "POST" })
      const data = await res.json()
      setLastScanAt(Date.now())

      if (data.alerts?.length > 0) {
        addAlerts(data.alerts)
        sendBrowserNotification(data.alerts)
      }
    } catch (error) {
      console.error("Alert scan error:", error)
    } finally {
      setScanning(false)
    }
  }, [setScanning, setLastScanAt, addAlerts])

  // Initialize rules + fetch existing alerts + start polling — once on mount
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function init() {
      try {
        const [rulesRes, alertsRes] = await Promise.all([
          fetch("/api/alerts/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initDefaults: true }),
          }),
          fetch("/api/alerts?limit=50"),
        ])
        const rules = await rulesRes.json()
        const { alerts } = await alertsRes.json()
        setRules(rules)
        setAlerts(alerts || [])
      } catch (error) {
        console.error("Failed to init alerts:", error)
      }
    }

    init()

    // Start polling — scan function is stable (no isScanning dependency)
    intervalId = setInterval(scan, SCAN_INTERVAL)
    intervalRef.current = intervalId

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { scan, isScanning }
}

function sendBrowserNotification(alerts: { message: string }[]) {
  if (typeof window === "undefined") return
  if (Notification.permission !== "granted") return

  const count = alerts.length
  const title = `${count} 条异动提醒`
  const body = alerts
    .slice(0, 3)
    .map((a) => a.message)
    .join("\n")

  new Notification(title, {
    body: count > 3 ? `${body}\n...还有 ${count - 3} 条` : body,
    icon: "/favicon.ico",
    tag: "stock-alert",
  })
}

export function requestNotificationPermission() {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (Notification.permission === "default") {
    Notification.requestPermission()
  }
}
