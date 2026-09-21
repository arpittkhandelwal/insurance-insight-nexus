/**
 * Scenario Simulator — what-if Monte Carlo engine with tornado chart.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sliders, TrendingUp, Play, Loader2, Bot } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { simulate } from '../services/api'
import { fmtINR } from '../lib/utils'
import RiskScoreSimulator from '../components/ui/RiskScoreSimulator'

export default function SimulatorPage() {
  const [activeTab, setActiveTab] = useState('portfolio') // 'portfolio' | 'claim'
  const [params, setParams] = useState({
    premium_change_pct: 0,
    deductible_change_pct: 0,
    fraud_reduction_pct: 20,
    settlement_reduction_days: 5,
    catastrophe_severity: 0,
    n_simulations: 10000,
  })

  const { mutate, data: result, isPending } = useMutation({ mutationFn: simulate })

  const Slider = ({ id, label, min, max, step = 1, unit = '' }) => (
    <div>
      <label htmlFor={id} className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-2">
        <span>{label}</span>
        <span className="font-semibold text-slate-900 dark:text-white">{params[id]}{unit}</span>
      </label>
      <input
        id={id} type="range" min={min} max={max} step={step}
        value={params[id]}
        onChange={(e) => setParams((p) => ({ ...p, [id]: Number(e.target.value) }))}
        className="w-full accent-nexus-500"
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Sliders className="text-nexus-400" />Scenario Simulator
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Interactive what-if analysis and model sandbox</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab('portfolio')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'portfolio' ? 'bg-white dark:bg-navy-700 shadow-sm text-nexus-600 dark:text-nexus-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            Portfolio Monte Carlo
          </button>
          <button onClick={() => setActiveTab('claim')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'claim' ? 'bg-white dark:bg-navy-700 shadow-sm text-nexus-600 dark:text-nexus-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
            Individual Claim Risk
          </button>
        </div>
      </div>

      {activeTab === 'portfolio' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="card xl:col-span-1 space-y-6">
          <h3 className="section-title">Scenario Parameters</h3>
          <Slider id="premium_change_pct" label="Premium Change" min={-20} max={30} unit="%" />
          <Slider id="deductible_change_pct" label="Deductible Increase" min={0} max={50} unit="%" />
          <Slider id="fraud_reduction_pct" label="Fraud Reduction" min={0} max={80} unit="%" />
          <Slider id="settlement_reduction_days" label="Settlement Time Reduction" min={0} max={30} unit=" days" />
          <div>
            <label className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-2">
              <span>Catastrophe Scenario</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {['None', '1-in-10 Flood', '1-in-50 Mega Flood'][params.catastrophe_severity]}
              </span>
            </label>
            <input type="range" min={0} max={2} step={1}
              value={params.catastrophe_severity}
              onChange={(e) => setParams((p) => ({ ...p, catastrophe_severity: Number(e.target.value) }))}
              className="w-full accent-nexus-500" />
          </div>
          <button onClick={() => mutate(params)} disabled={isPending} className="btn-primary w-full justify-center">
            {isPending ? <><Loader2 size={16} className="animate-spin" />Running 10k simulations…</> : <><Play size={16} />Run Simulation</>}
          </button>
        </div>

        {/* Results */}
        <div className="xl:col-span-2 space-y-4">
          {result ? (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Mean Loss Ratio', value: `${(result.mean_loss_ratio * 100).toFixed(1)}%`, sub: `P10: ${(result.p10_loss_ratio * 100).toFixed(1)}% · P90: ${(result.p90_loss_ratio * 100).toFixed(1)}%` },
                  { label: 'Net Impact', value: fmtINR(result.net_impact_cr * 1e7), sub: result.net_impact_cr > 0 ? '💚 Savings' : '🔴 Cost' },
                  { label: 'Fraud Saved', value: fmtINR(result.fraud_leakage_saved_cr * 1e7), sub: 'Leakage recovery' },
                ].map(k => (
                  <div key={k.label} className="card text-center">
                    <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-1">{k.label}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{k.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Tornado chart */}
              <div className="card">
                <h3 className="section-title">Tornado Sensitivity Analysis</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={result.tornado_sensitivity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}Cr`} />
                    <YAxis dataKey="driver" type="category" tick={{ fontSize: 11 }} width={150} />
                    <Tooltip formatter={(v) => [`₹${v.toFixed(2)} Cr`, 'Impact']}
                      contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 8 }} />
                    <Bar dataKey="impact_cr" radius={[0, 4, 4, 0]}>
                      {result.tornado_sensitivity.map((_, i) => (
                        <Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Insight */}
              <div className="card border border-nexus-500/20">
                <div className="ai-insight-badge mb-3"><Bot size={12} />AI Simulation Insight — Not a Final Decision</div>
                <p className="text-slate-600 dark:text-slate-300 text-sm">{result.insight}</p>
              </div>
            </>
          ) : (
            <div className="card flex items-center justify-center h-64 text-slate-500">
              <div className="text-center">
                <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
                <p>Configure parameters and click Run Simulation</p>
                <p className="text-sm mt-1">10,000 Monte Carlo runs take ~500ms</p>
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <RiskScoreSimulator />
      )}
    </div>
  )
}
