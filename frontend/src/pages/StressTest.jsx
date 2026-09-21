/**
 * StressTest — Portfolio stress test simulator.
 * Simulate natural disaster / systemic shock scenarios and watch KPIs recalculate.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const SCENARIOS = [
  {
    id: 'cyclone_tn',
    name: 'Category 4 Cyclone — Tamil Nadu',
    icon: '🌀',
    description: 'Sustained winds 180 km/h, coastal flooding across Chennai, Puducherry, Nagapattinam.',
    shocks: { loss_ratio: +0.31, fraud_exposure: +8.4, open_cases: +1200, reserve_gap: +340, settlement_days: +18 },
  },
  {
    id: 'flood_mumbai',
    name: 'Catastrophic Flood — Mumbai',
    icon: '🌊',
    description: '3-day torrential rains, 650mm rainfall. Motor + property claims flood in simultaneously.',
    shocks: { loss_ratio: +0.27, fraud_exposure: +6.2, open_cases: +980, reserve_gap: +280, settlement_days: +14 },
  },
  {
    id: 'fraud_ring',
    name: 'Coordinated Fraud Ring — 8 States',
    icon: '🔴',
    description: 'Organised motor fraud ring using 40+ garages across Maharashtra, Gujarat, Rajasthan.',
    shocks: { loss_ratio: +0.12, fraud_exposure: +22.1, open_cases: +430, reserve_gap: +110, settlement_days: +5 },
  },
  {
    id: 'pandemic',
    name: 'Health Pandemic — Urban Surge',
    icon: '🏥',
    description: 'Rapid hospitalisation spike. Health claims 3× normal. Hospital upcoding risk elevated.',
    shocks: { loss_ratio: +0.22, fraud_exposure: +4.8, open_cases: +2100, reserve_gap: +520, settlement_days: +22 },
  },
  {
    id: 'crop_drought',
    name: 'El Niño Drought — Kharif Failure',
    icon: '☀️',
    description: 'Monsoon deficit 38%. Crop insurance mass claim event across Vidarbha, Marathwada.',
    shocks: { loss_ratio: +0.19, fraud_exposure: +2.1, open_cases: +3400, reserve_gap: +640, settlement_days: +30 },
  },
]

const BASELINE = {
  loss_ratio: 0.76,
  fraud_exposure: 12.4,
  open_cases: 847,
  reserve_gap: 28,
  settlement_days: 34,
}

const LABELS = {
  loss_ratio: 'Loss Ratio',
  fraud_exposure: 'Fraud Exposure (₹Cr)',
  open_cases: 'Open Cases',
  reserve_gap: 'Reserve Gap (₹Cr)',
  settlement_days: 'Avg Settlement Days',
}

export default function StressTest() {
  const [active, setActive] = useState(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const runScenario = (scenario) => {
    setRunning(true)
    setResult(null)
    setActive(scenario.id)
    setTimeout(() => {
      const stressed = {}
      Object.keys(BASELINE).forEach(k => {
        stressed[k] = BASELINE[k] + (scenario.shocks[k] || 0)
      })
      setResult({ scenario, stressed })
      setRunning(false)
    }, 1800)
  }

  const chartData = result ? Object.keys(BASELINE).map(k => ({
    name: LABELS[k],
    baseline: parseFloat(BASELINE[k].toFixed(2)),
    stressed: parseFloat(result.stressed[k].toFixed(2)),
  })) : []

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="text-danger-400" size={28} /> Portfolio Stress Test
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Simulate catastrophic scenarios and watch KPIs recalculate in real-time</p>
        </div>
        {result && (
          <button onClick={() => { setResult(null); setActive(null) }} className="btn-secondary">
            <RefreshCw size={16} /> Reset
          </button>
        )}
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SCENARIOS.map(s => (
          <motion.button
            key={s.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => runScenario(s)}
            className={`card text-left transition-all border-2 ${
              active === s.id
                ? 'border-danger-400 bg-danger-50 dark:bg-danger-900/20'
                : 'border-transparent hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <div className="text-3xl mb-2">{s.icon}</div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{s.name}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {Object.entries(s.shocks).map(([k, v]) => (
                <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-danger-100 dark:bg-danger-500/20 text-danger-600 dark:text-danger-300 font-mono">
                  +{typeof v === 'number' && k === 'loss_ratio' ? (v * 100).toFixed(0) + 'pp' : v} {k.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Running indicator */}
      <AnimatePresence>
        {running && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="card flex items-center gap-4">
            <div className="w-8 h-8 border-2 border-danger-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Running stress scenario…</p>
              <p className="text-xs text-slate-400">Recalculating loss reserves, fraud exposure, and settlement queues</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && !running && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="card border-2 border-danger-400/40 bg-danger-50/50 dark:bg-danger-900/10">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="text-danger-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-bold text-danger-700 dark:text-danger-300">{result.scenario.name} — Impact Assessment</p>
                  <p className="text-xs text-slate-500 mt-0.5">{result.scenario.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.keys(BASELINE).map(k => {
                  const base = BASELINE[k]
                  const stressed = result.stressed[k]
                  const pct = ((stressed - base) / base * 100).toFixed(1)
                  return (
                    <div key={k} className="p-3 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{LABELS[k]}</p>
                      <p className="text-xs text-slate-500 line-through">{base}</p>
                      <motion.p className="text-xl font-bold text-danger-500" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                        {stressed.toFixed(k === 'loss_ratio' ? 2 : 0)}
                      </motion.p>
                      <p className="text-xs font-semibold text-danger-400">+{pct}%</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Comparison chart */}
            <div className="card">
              <h3 className="section-title flex items-center gap-2">
                <TrendingUp size={16} className="text-danger-400" /> Baseline vs Stressed Comparison
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
                  <Bar dataKey="baseline" fill="#6366f1" radius={[0, 4, 4, 0]} name="Baseline" />
                  <Bar dataKey="stressed" fill="#ef4444" radius={[0, 4, 4, 0]} name="Stressed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
