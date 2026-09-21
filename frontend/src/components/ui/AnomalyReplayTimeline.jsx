/**
 * AnomalyReplayTimeline — scrubber for replaying anomaly patterns month-by-month.
 * Shows evolving fraud network density and claim spikes over time.
 */
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const MONTHS = [
  'Jul 22','Aug 22','Sep 22','Oct 22','Nov 22','Dec 22',
  'Jan 23','Feb 23','Mar 23','Apr 23','May 23','Jun 23',
  'Jul 23','Aug 23','Sep 23','Oct 23','Nov 23','Dec 23',
  'Jan 24','Feb 24','Mar 24','Apr 24','May 24','Jun 24',
]

function generateTimelineData() {
  return MONTHS.map((month, i) => {
    const isMonsoon = i % 12 >= 0 && i % 12 <= 2 // Jul-Sep spikes
    const base = 40 + Math.sin(i * 0.5) * 15
    return {
      month,
      fraud_cases: Math.round((isMonsoon ? base * 1.8 : base) + Math.random() * 10),
      anomaly_score: Math.round((isMonsoon ? 72 : 52) + Math.random() * 12),
      ring_size: Math.round((isMonsoon ? 8 : 4) + Math.random() * 3),
    }
  })
}

const DATA = generateTimelineData()

export default function AnomalyReplayTimeline() {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const rafRef = useRef(null)
  const lastTickRef = useRef(null)

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    const tick = (ts) => {
      if (!lastTickRef.current) lastTickRef.current = ts
      if (ts - lastTickRef.current > 800) {
        lastTickRef.current = ts
        setCurrentFrame(f => {
          if (f >= DATA.length - 1) { setPlaying(false); return f }
          return f + 1
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  const visibleData = DATA.slice(0, currentFrame + 1)
  const current = DATA[currentFrame]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title mb-0">Anomaly Replay Timeline</h3>
          <p className="text-xs text-slate-400 mt-0.5">Scrub through time to see fraud pattern evolution</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className="px-2 py-1 rounded-lg bg-nexus-500/10 border border-nexus-500/20 text-xs font-mono text-nexus-400"
            key={current.month}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {current.month}
          </motion.div>
          <button onClick={() => { setCurrentFrame(0); setPlaying(false) }} className="btn-ghost p-1"><RotateCcw size={14} /></button>
          <button onClick={() => setPlaying(p => !p)} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>

      {/* Animated stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Fraud Cases', value: current.fraud_cases, color: 'text-danger-400' },
          { label: 'Avg Anomaly Score', value: current.anomaly_score, color: 'text-amber-400' },
          { label: 'Active Fraud Rings', value: current.ring_size, color: 'text-nexus-400' },
        ].map(s => (
          <motion.div key={s.label} layout className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
            <motion.p className={`text-2xl font-bold tabular-nums ${s.color}`} key={s.value} initial={{ scale: 0.8 }} animate={{ scale: 1 }}>{s.value}</motion.p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Timeline scrubber */}
      <input
        type="range" min={0} max={DATA.length - 1} value={currentFrame}
        onChange={e => { setPlaying(false); setCurrentFrame(+e.target.value) }}
        className="w-full accent-nexus-500 mb-4"
      />

      {/* Area chart showing up to current frame */}
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={visibleData}>
          <defs>
            <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11 }} />
          <Area type="monotone" dataKey="fraud_cases" stroke="#ef4444" fill="url(#fraudGrad)" strokeWidth={2} dot={false} name="Fraud Cases" />
          <Area type="monotone" dataKey="anomaly_score" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Anomaly Score" />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-400 mt-2">🔴 Fraud Cases &nbsp;🟡 Anomaly Score · Monsoon spikes visible in Jul–Sep</p>
    </div>
  )
}
