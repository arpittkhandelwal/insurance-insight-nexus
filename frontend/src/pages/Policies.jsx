/**Policies Portfolio page*/
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { fetchLossRatioCohort, fetchLapseRisk } from '../services/api'
import { fmtINR, riskBadgeClass } from '../lib/utils'

export default function PoliciesPage() {
  const [dimension, setDimension] = useState('product_line')
  const { data: cohorts = [] } = useQuery({ queryKey: ['loss-ratio', dimension], queryFn: () => fetchLossRatioCohort({ dimension }) })
  const { data: lapse = [] } = useQuery({ queryKey: ['lapse-risk'], queryFn: fetchLapseRisk })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3"><TrendingUp className="text-nexus-400" />Policy Portfolio</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Loss ratio by cohort · Lapse prediction · Concentration risk</p>
        </div>
      </div>

      {/* Loss ratio by cohort */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title mb-0">Loss Ratio by Cohort</h3>
          <div className="flex gap-2">
            {['product_line', 'state', 'channel'].map((d) => (
              <button key={d} onClick={() => setDimension(d)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${dimension === d ? 'bg-nexus-500/20 border-nexus-500/40 text-nexus-300' : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                {d.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={cohorts} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} />
            <YAxis dataKey="cohort" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Loss Ratio']}
              contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 8 }} />
            <Bar dataKey="loss_ratio" radius={[0, 4, 4, 0]}>
              {cohorts.map((c, i) => (
                <Cell key={i} fill={c.loss_ratio >= 0.85 ? '#ef4444' : c.loss_ratio >= 0.75 ? '#f59e0b' : '#10b981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-500 mt-2">🔴 &gt;85% = Escalation threshold · 🟡 &gt;75% = Watch list · 🟢 &lt;75% = On target</p>
      </div>

      {/* Predictive Customer Churn (Lapse Risk) */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title mb-0">Predictive Customer Churn</h3>
          <span className="badge bg-nexus-100 text-nexus-700 border border-nexus-200 dark:bg-nexus-500/20 dark:text-nexus-300 dark:border-nexus-500/30">ML Churn Model v1.2</span>
        </div>
        <table className="data-table">
          <thead><tr>
            <th>Policy</th><th>Product</th><th>State</th>
            <th>Lapse Probability</th><th>Risk Tier</th><th>Top Driver</th>
          </tr></thead>
          <tbody>
            {lapse.slice(0, 20).map((p) => (
              <tr key={p.policy_id}>
                <td className="font-mono text-xs">{p.policy_id}</td>
                <td>{p.product_line}</td><td>{p.state}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-danger-500 rounded-full" style={{ width: `${p.lapse_probability * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono">{(p.lapse_probability * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td><span className={riskBadgeClass(p.risk_tier)}>{p.risk_tier}</span></td>
                <td className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{p.top_drivers?.[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
