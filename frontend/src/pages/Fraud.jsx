/**
 * Fraud Risk Center — entity graph, scored claims, SHAP reasons.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Shield, Network, AlertTriangle, Bot } from 'lucide-react'
import { fetchFraudScores, fetchFraudGraph } from '../services/api'
import { fmtINR, riskBadgeClass } from '../lib/utils'
import FraudGraph from '../components/charts/FraudGraph'

export default function FraudPage() {
  const [tab, setTab] = useState('scores')

  const { data: scores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ['fraud-scores'],
    queryFn: () => fetchFraudScores({ min_score: 60 }),
  })

  const { data: graph, isLoading: graphLoading } = useQuery({
    queryKey: ['fraud-graph'],
    queryFn: fetchFraudGraph,
    enabled: tab === 'graph',
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Shield className="text-danger-400" />
            Fraud Risk Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Ensemble anomaly detection · SHAP explanations · Entity graph</p>
        </div>
        <div className="ai-insight-badge"><Bot size={14} />AI Fraud Scores — Not Final Determinations</div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'High-Risk Claims', value: scores.filter(s => s.risk_tier !== 'Low').length, color: 'text-danger-400' },
          { label: 'Total Exposure', value: fmtINR(scores.reduce((a, s) => a + s.amount_claimed, 0)), color: 'text-warn-400' },
          { label: 'Fraud Ring Size', value: '8 entities', color: 'text-nexus-400' },
        ].map(c => (
          <div key={c.label} className="card text-center">
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-0">
        {[['scores', 'Risk Scores'], ['graph', 'Entity Graph']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id ? 'border-nexus-500 text-nexus-300' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'scores' && (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Product</th>
                <th>State</th>
                <th>Amount</th>
                <th>Risk Score</th>
                <th>Tier</th>
                <th>Top Reason</th>
                <th>Garage</th>
              </tr>
            </thead>
            <tbody>
              {scores.slice(0, 50).map((s) => (
                <tr key={s.claim_id}>
                  <td className="font-mono text-xs">{s.claim_id}</td>
                  <td>{s.product_line}</td>
                  <td>{s.state}</td>
                  <td className="inr">{fmtINR(s.amount_claimed)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.risk_score >= 80 ? 'bg-danger-500' : s.risk_score >= 60 ? 'bg-orange-500' : 'bg-warn-500'}`}
                          style={{ width: `${s.risk_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{s.risk_score}</span>
                    </div>
                  </td>
                  <td><span className={riskBadgeClass(s.risk_tier)}>{s.risk_tier}</span></td>
                  <td className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{s.shap_reasons[0]}</td>
                  <td className="font-mono text-xs text-danger-400">{s.garage_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'graph' && (
        <FraudGraph />
      )}
    </div>
  )
}
