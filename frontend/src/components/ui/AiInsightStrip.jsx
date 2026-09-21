/**
 * AI Insights Strip — "Today's top 5 AI insights", auto-generated on load.
 * Shows the persistent AI badge on every insight.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const INSIGHTS = [
  {
    id: 1,
    title: '🌊 Monsoon Spike Alert',
    text: 'Motor + Home claims in Kerala, Maharashtra & Assam surged +183% in Jul 2022 window (WX001). Reserve gap estimated ₹28 Cr.',
    action: '/anomaly',
    actionLabel: 'View anomalies',
    severity: 'high',
  },
  {
    id: 2,
    title: '🕵️ Fraud Ring Detected',
    text: '847 Motor claims linked to 5 garages + 3 surveyors with shared customer identifiers. Estimated exposure: ₹12.4 Cr.',
    action: '/fraud',
    actionLabel: 'Investigate',
    severity: 'critical',
  },
  {
    id: 3,
    title: '🏥 Hospital Billing Anomaly',
    text: 'HSP0001–HSP0003 billing 2.4× peer average for standard procedures. 1,027 claims flagged for desk audit.',
    action: '/claims',
    actionLabel: 'View providers',
    severity: 'high',
  },
  {
    id: 4,
    title: '📈 Crop/Rajasthan Deterioration',
    text: 'Crop insurance loss ratio in Rajasthan reached 91.2% — above the 85% escalation threshold. Slow-burn trend since Q2 2022.',
    action: '/policies',
    actionLabel: 'Analyse portfolio',
    severity: 'medium',
  },
  {
    id: 5,
    title: '📊 Loss Ratio Forecast',
    text: 'Portfolio loss ratio projected at 72.1% in 12 weeks if Rajasthan reserve not topped up. Premium adequacy review recommended.',
    action: '/simulate',
    actionLabel: 'Run simulation',
    severity: 'medium',
  },
]

const SEVERITY_CLASSES = {
  critical: 'border-danger-500/40 bg-gradient-alert',
  high: 'border-orange-500/40 bg-orange-500/5',
  medium: 'border-warn-500/40 bg-warn-500/5',
}

export default function AiInsightStrip() {
  const [idx, setIdx] = useState(0)
  const navigate = useNavigate()
  const insight = INSIGHTS[idx]

  return (
    <div className={`relative rounded-2xl border p-4 ${SEVERITY_CLASSES[insight.severity] || 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'}`}>
      {/* AI badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="ai-insight-badge">
          <Bot size={12} />
          AI Insight — Not a Final Decision
        </div>
        <span className="text-slate-500 text-xs ml-auto">
          {idx + 1} / {INSIGHTS.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-slate-900 dark:text-white font-semibold text-sm mb-1">{insight.title}</h4>
              <p className="text-slate-600 dark:text-slate-300 text-sm">{insight.text}</p>
            </div>
            <button
              onClick={() => navigate(insight.action)}
              className="btn-secondary text-xs whitespace-nowrap flex-shrink-0"
            >
              {insight.actionLabel}
              <ExternalLink size={12} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          className="btn-ghost p-1"
          disabled={idx === 0}
          aria-label="Previous insight"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1 items-center">
          {INSIGHTS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === idx ? 'bg-nexus-400 w-4' : 'bg-slate-200 dark:bg-white/20'
              }`}
              aria-label={`Go to insight ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(INSIGHTS.length - 1, i + 1))}
          className="btn-ghost p-1"
          disabled={idx === INSIGHTS.length - 1}
          aria-label="Next insight"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
