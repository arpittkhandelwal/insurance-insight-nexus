/**
 * useLiveAlerts — simulates real-time fraud threshold breach alerts.
 * Fires toast notifications when a high-risk claim is detected.
 */
import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

const CLAIM_TYPES = ['Motor', 'Health', 'Crop', 'Property', 'Marine']
const STATES = ['Maharashtra', 'Kerala', 'Rajasthan', 'Gujarat', 'Delhi']
const GARAGES = ['SunShine Auto Works', 'City Motors', 'Speed Auto Centre', 'Fast Fix Garage']

function generateHighRiskClaim() {
  return {
    id: `CLM-${Math.floor(Math.random() * 90000) + 10000}`,
    type: CLAIM_TYPES[Math.floor(Math.random() * CLAIM_TYPES.length)],
    state: STATES[Math.floor(Math.random() * STATES.length)],
    amount: Math.floor(Math.random() * 800000) + 200000,
    fraudScore: Math.floor(Math.random() * 20) + 80, // 80–99
    garage: GARAGES[Math.floor(Math.random() * GARAGES.length)],
  }
}

export function useLiveAlerts(enabled = true, intervalMs = 18000) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const fire = () => {
      const claim = generateHighRiskClaim()
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex items-start gap-3 bg-white dark:bg-navy-800 border border-danger-200 dark:border-danger-500/40 rounded-2xl shadow-xl px-4 py-3 max-w-sm`}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div className="flex-shrink-0 mt-0.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-danger-500" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-danger-700 dark:text-danger-300">🚨 High-Fraud Alert</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              <span className="font-mono">{claim.id}</span> · {claim.type} · {claim.state}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ₹{claim.amount.toLocaleString('en-IN')} · Fraud Score: <span className="text-danger-600 font-bold">{claim.fraudScore}</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">via {claim.garage}</p>
          </div>
        </div>
      ), { duration: 6000, position: 'top-right' })
    }

    // First alert after short delay
    timerRef.current = setTimeout(() => {
      fire()
      timerRef.current = setInterval(fire, intervalMs)
    }, 4000)

    return () => {
      clearTimeout(timerRef.current)
      clearInterval(timerRef.current)
    }
  }, [enabled, intervalMs])
}
