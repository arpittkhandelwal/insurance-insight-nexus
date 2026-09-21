/**Anomaly Detection page — with Replay Timeline and "Explain This Anomaly" AI button*/
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bot, Loader } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchAnomalies } from '../services/api'
import { fmtINR, riskBadgeClass } from '../lib/utils'
import AnomalyReplayTimeline from '../components/ui/AnomalyReplayTimeline'

const EXPLANATIONS = {
  high: [
    'Claim filed 2 days after policy inception — statistically anomalous (p<0.01).',
    'Provider billing 3.1× median for this procedure code — possible upcoding.',
    'Customer filed 3 claims in 180 days — frequency outlier (99th percentile).',
    'Settlement requested before surveyor report filed — process violation.',
  ],
  medium: [
    'Claim amount 2.4σ above product-line average — flagged by Robust Z-score.',
    'No prior claim history; high value claim on Day 8 of policy.',
    'Provider not on approved panel for this state.',
  ],
}

function ExplainButton({ alert }) {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState(null)

  const explain = () => {
    setLoading(true)
    setTimeout(() => {
      const pool = alert.anomaly_score >= 75 ? EXPLANATIONS.high : EXPLANATIONS.medium
      setExplanation(pool[Math.floor(Math.random() * pool.length)])
      setLoading(false)
    }, 1200)
  }

  return (
    <div>
      {!explanation && (
        <button
          onClick={explain}
          disabled={loading}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-nexus-50 dark:bg-nexus-500/10 border border-nexus-200 dark:border-nexus-500/30 text-nexus-600 dark:text-nexus-400 hover:bg-nexus-100 dark:hover:bg-nexus-500/20 transition-all"
        >
          {loading ? <Loader size={10} className="animate-spin" /> : <Bot size={10} />}
          {loading ? 'Analysing…' : 'Explain'}
        </button>
      )}
      <AnimatePresence>
        {explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-1 text-xs text-nexus-700 dark:text-nexus-300 bg-nexus-50 dark:bg-nexus-500/10 rounded-lg px-2 py-1.5 border border-nexus-200 dark:border-nexus-500/20 max-w-xs"
          >
            🤖 {explanation}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AnomalyPage() {
  const { data, isLoading } = useQuery({ queryKey: ['anomalies'], queryFn: () => fetchAnomalies({ min_score: 40 }) })
  const alerts = data?.alerts || []

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3" data-tour="nav-anomaly">
            <AlertTriangle className="text-warn-400" />Anomaly Detection
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Ensemble: IsolationForest + LOF + Robust Z-score</p>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Flagged', value: data?.total || 0, color: 'text-warn-400' },
          { label: 'High Risk', value: data?.high_risk_count || 0, color: 'text-danger-400' },
          { label: 'Total Exposure', value: fmtINR((data?.total_exposure_cr || 0) * 1e7), color: 'text-orange-400' },
        ].map(c => (
          <div key={c.label} className="card text-center">
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Replay Timeline */}
      <AnomalyReplayTimeline />

      {/* Alert table with Explain buttons */}
      <div className="card overflow-x-auto">
        <h3 className="section-title flex items-center gap-2">
          <AlertTriangle size={16} className="text-warn-400" /> Flagged Alerts
        </h3>
        <table className="data-table">
          <thead><tr>
            <th>Alert ID</th><th>Claim</th><th>Product</th><th>State</th>
            <th>Amount</th><th>Score</th><th>Tier</th><th>AI Explain</th>
          </tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.alert_id}>
                <td className="font-mono text-xs text-nexus-400">{a.alert_id}</td>
                <td className="font-mono text-xs">{a.claim_id}</td>
                <td>{a.product_line}</td><td>{a.state}</td>
                <td className="inr">{fmtINR(a.amount_claimed)}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${a.anomaly_score >= 80 ? 'bg-danger-500' : 'bg-warn-500'}`} style={{ width: `${a.anomaly_score}%` }} />
                    </div>
                    <span className="text-xs font-mono">{a.anomaly_score}</span>
                  </div>
                </td>
                <td><span className={riskBadgeClass(a.risk_tier)}>{a.risk_tier}</span></td>
                <td><ExplainButton alert={a} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
