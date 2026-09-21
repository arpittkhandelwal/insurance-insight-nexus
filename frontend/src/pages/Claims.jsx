/**Claims Analytics page*/
import { useQuery } from '@tanstack/react-query'
import { FileText, TrendingDown } from 'lucide-react'
import { FunnelChart, Funnel, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { fetchClaimsFunnel, fetchProviderBenchmarks } from '../services/api'
import { fmtINR } from '../lib/utils'
import HeatCalendar from '../components/charts/HeatCalendar'

export default function ClaimsPage() {
  const { data: funnel = [] } = useQuery({ queryKey: ['claims-funnel'], queryFn: fetchClaimsFunnel })
  const { data: providers = [] } = useQuery({ queryKey: ['provider-benchmarks'], queryFn: fetchProviderBenchmarks })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="text-nexus-400" />Claims Analytics
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Funnel · Severity · Provider benchmarking · Large-loss tracker</p>
        </div>
      </div>

      {/* Funnel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="section-title">Claims Lifecycle Funnel</h3>
          <div className="space-y-3">
            {funnel.map((s) => (
              <div key={s.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-300">{s.stage}</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{s.count?.toLocaleString('en-IN')} ({s.pct_of_reported?.toFixed(1)}%)</span>
                </div>
                <div className="h-8 bg-slate-50 dark:bg-white/5 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-nexus-600 to-nexus-500 rounded-lg flex items-center justify-end pr-3 text-xs text-slate-900 dark:text-white font-semibold transition-all duration-700"
                    style={{ width: `${s.pct_of_reported || 100}%` }}
                  >
                    {fmtINR(s.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Provider anomaly */}
        <div className="card">
          <h3 className="section-title">Provider Billing Anomaly — Hospitals</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={providers.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}x`} />
              <YAxis dataKey="provider_id" type="category" tick={{ fontSize: 9 }} width={70} />
              <Tooltip formatter={(v, name) => [`${v.toFixed(2)}x peer avg`, 'Billing Ratio']}
                contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 8 }} />
              <Bar dataKey="ratio" radius={[0, 4, 4, 0]}>
                {providers.slice(0, 10).map((p, i) => (
                  <Cell key={i} fill={p.ratio >= 1.8 ? '#ef4444' : p.ratio >= 1.4 ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">🔴 Red = Anomaly (&gt;1.8x peer) · 🟡 Yellow = Elevated (&gt;1.4x)</p>
        </div>
      </div>

      {/* Heat Calendar */}
      <HeatCalendar />
    </div>
  )
}
