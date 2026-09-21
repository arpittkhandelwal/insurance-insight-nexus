/**
 * Case Management — investigation queue with human-in-the-loop signoff.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, CheckCircle, XCircle, AlertTriangle, Bot, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchCases, decideCase } from '../services/api'
import { fmtINR, riskBadgeClass } from '../lib/utils'
import DocumentOCR from '../components/ui/DocumentOCR'
import toast from 'react-hot-toast'

function CaseCard({ c, onDecide }) {
  const [expanded, setExpanded] = useState(false)
  const [decision, setDecision] = useState('')
  const [reason, setReason] = useState('')

  const handleDecide = () => {
    if (!decision || !reason) { toast.error('Select decision and provide reason'); return }
    onDecide(c.case_id, { decision, reason, decided_by: 'Demo Analyst' })
  }

  const statusColor = { open: 'text-warn-400', resolved: 'text-ok-400', escalated: 'text-nexus-400' }[c.status] || 'text-slate-500 dark:text-slate-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-slate-500">{c.case_id}</span>
            <span className={`badge ${riskBadgeClass(c.priority === 'critical' ? 'Critical' : 'High')}`}>
              {c.priority}
            </span>
            <span className={`text-xs font-medium ${statusColor}`}>{c.status}</span>
          </div>
          <h3 className="text-slate-900 dark:text-white font-semibold mb-1">{c.title}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{c.description}</p>
        </div>
        <div className="text-right">
          <p className="text-danger-400 font-bold">{c.risk_score}/100</p>
          <p className="text-xs text-slate-500">{c.assigned_to || 'Unassigned'}</p>
        </div>
      </div>

      {/* AI Recommendation */}
      <div className="mt-3 p-3 rounded-xl bg-nexus-500/10 border border-nexus-500/20">
        <div className="ai-insight-badge mb-2"><Bot size={12} />{c.ai_badge}</div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.ai_recommendation}</p>
      </div>

      {/* Decision section */}
      {c.status === 'open' && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">
            ✍️ Human Review Required — Sign Off to Proceed
          </p>
          <div className="flex gap-2">
            {['approve', 'reject', 'escalate'].map((d) => (
              <button
                key={d}
                onClick={() => setDecision(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  decision === d
                    ? d === 'approve' ? 'bg-ok-500/20 border-ok-500/40 text-ok-400'
                      : d === 'reject' ? 'bg-danger-500/20 border-danger-500/40 text-danger-400'
                      : 'bg-nexus-500/20 border-nexus-500/40 text-nexus-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-white/30'
                }`}
              >
                {d === 'approve' ? '✓ Approve' : d === 'reject' ? '✗ Reject' : '↑ Escalate'}
              </button>
            ))}
          </div>
          {decision && (
            <div className="flex gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide reason for decision…"
                className="input flex-1 text-sm"
              />
              <button onClick={handleDecide} className="btn-primary">Confirm</button>
            </div>
          )}
        </div>
      )}
      {c.decision && (
        <div className="mt-3 p-2 bg-ok-500/10 border border-ok-500/20 rounded-xl text-xs">
          <span className="text-ok-400 font-semibold">{c.decision.toUpperCase()}</span>
          <span className="text-slate-500 dark:text-slate-400"> by {c.decided_by} — {c.decision_reason}</span>
        </div>
      )}
    </motion.div>
  )
}

export default function CasesPage() {
  const qc = useQueryClient()
  const { data: cases = [], isLoading } = useQuery({ queryKey: ['cases'], queryFn: fetchCases })
  const { mutate } = useMutation({
    mutationFn: ({ caseId, decision }) => decideCase(caseId, decision),
    onSuccess: () => { toast.success('Decision recorded'); qc.invalidateQueries(['cases']) },
    onError: () => toast.error('Decision failed'),
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <ClipboardList className="text-nexus-400" />Case Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Investigation queue · Human-in-the-loop sign-off</p>
        </div>
        <div className="ai-insight-badge">
          <Bot size={14} />All AI recommendations require human decision
        </div>
      </div>

      <DocumentOCR />

      {isLoading ? (
        <div className="space-y-4">{Array(3).fill(0).map((_, i) => (
          <div key={i} className="card"><div className="skeleton h-32 rounded-xl" /></div>
        ))}</div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <CaseCard
              key={c.case_id}
              c={c}
              onDecide={(caseId, decision) => mutate({ caseId, decision })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
