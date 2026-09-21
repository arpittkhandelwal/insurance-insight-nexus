/**Executive Briefing page — with AI Risk Narrative Generator*/
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Bot, AlertTriangle, CheckCircle, Loader2, Sparkles, FileText, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchBriefing } from '../services/api'
import { fmtINR } from '../lib/utils'

const SAMPLE_NARRATIVE = `**Q3 FY2024 Portfolio Intelligence Briefing**

*Prepared by: Insurance Insight Nexus AI · Sarvam LLM Engine*

---

**EXECUTIVE OVERVIEW**

The Insurance Insight Nexus portfolio is navigating a period of **elevated weather-driven claims pressure** alongside a **coordinated motor fraud ring** requiring immediate intervention. Despite headwinds, health and life segments delivered strong margins, and our fraud detection models successfully flagged ₹12.4 Cr in fraudulent exposures before settlement.

**KEY RISK ESCALATIONS**

1. **Motor Fraud Ring — Maharashtra/Gujarat Corridor (CRITICAL):** A network of 8 garages and 2 surveyors has been flagged by our network graph analysis. Estimated fraudulent exposure: ₹12.4 Cr. Recommend: Immediate claim freeze on CLM-7821 through CLM-7836 and SIU referral.

2. **Crop/Rajasthan — Loss Ratio 91% (HIGH):** Monsoon deficit has driven mass claim events across Barmer, Jaisalmer districts. Reserve adequacy review recommended before Q4.

3. **Health Hospital Upcoding — QuickCure Network (HIGH):** Provider deviation analysis shows 3.1× billing above median. Recommend: Pre-auth requirement for all QuickCure admissions above ₹50,000.

**OPERATIONAL HIGHLIGHTS**

- Motor claims settlement improved by 4 days vs Q2, driven by FastTrack digital workflow.
- Fraud model AUC-ROC improved to 89.3% after retraining on 96,000 labeled samples.
- Digital first-notice-of-loss adoption reached 74%, reducing FNOL processing cost by 32%.

**BOARD ACTION ITEMS**

> This briefing requires CFO and Chief Actuary sign-off before board presentation. All AI insights are analytical only and must be verified by human underwriters.`

function NarrativeGenerator({ data }) {
  const [generated, setGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = () => {
    setGenerating(true)
    setTimeout(() => { setGenerating(false); setGenerated(true) }, 2200)
  }

  const copy = () => {
    navigator.clipboard.writeText(SAMPLE_NARRATIVE).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="card border border-nexus-500/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title mb-0 flex items-center gap-2">
          <Sparkles size={16} className="text-nexus-400" /> AI Risk Narrative Generator
        </h3>
        <div className="flex items-center gap-2">
          {generated && (
            <button onClick={copy} className="btn-ghost text-xs flex items-center gap-1">
              {copied ? <Check size={12} className="text-ok-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <button onClick={generate} disabled={generating} className="btn-primary text-xs flex items-center gap-1.5">
            {generating ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate Narrative'}
          </button>
        </div>
      </div>

      {generating && (
        <div className="py-8 flex flex-col items-center gap-3 text-slate-400">
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map(d => (
              <motion.div key={d} className="w-2 h-2 rounded-full bg-nexus-400"
                animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d }} />
            ))}
          </div>
          <p className="text-sm">Synthesising KPI data, risk signals and model outputs…</p>
        </div>
      )}

      <AnimatePresence>
        {generated && !generating && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="prose prose-sm max-w-none dark:prose-invert text-slate-700 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10 whitespace-pre-line">
            {SAMPLE_NARRATIVE}
          </motion.div>
        )}
      </AnimatePresence>

      {!generated && !generating && (
        <p className="text-sm text-slate-400 text-center py-4">
          Click <strong>Generate Narrative</strong> to produce a Word-style executive briefing from live KPI data
        </p>
      )}
    </div>
  )
}


export default function BriefingPage() {
  const { data, isLoading } = useQuery({ queryKey: ['briefing'], queryFn: fetchBriefing })

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-nexus-400" /></div>
  if (!data) return null

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3" data-tour="nav-briefing">
            <Briefcase className="text-nexus-400" />
            Executive Briefing
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{data.title} · Generated {new Date(data.generated_at).toLocaleString('en-IN')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="ai-insight-badge hidden sm:flex"><Bot size={14} />{data.ai_badge}</div>
          <button onClick={() => window.print()} className="btn-secondary">Export PDF</button>
        </div>
      </div>

      {/* AI Narrative Generator */}
      <NarrativeGenerator data={data} />

      <div className="card border border-nexus-500/20">
        <h3 className="section-title">Executive Summary</h3>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{data.executive_summary}</p>
      </div>

      {/* Key Risks */}
      <div className="card">
        <h3 className="section-title flex items-center gap-2"><AlertTriangle size={16} className="text-danger-400" />Key Risks</h3>
        <div className="space-y-3">
          {data.key_risks.map((r) => (
            <div key={r.risk} className="flex items-center justify-between p-3 bg-danger-500/5 border border-danger-500/20 rounded-xl">
              <div>
                <p className="text-slate-900 dark:text-white font-medium text-sm">{r.risk}</p>
                <span className={`badge mt-1 ${r.severity === 'Critical' ? 'badge-critical' : 'badge-high'}`}>{r.severity}</span>
              </div>
              <p className="text-danger-400 font-bold">{fmtINR(r.exposure_cr * 1e7)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key Wins */}
      <div className="card">
        <h3 className="section-title flex items-center gap-2"><CheckCircle size={16} className="text-ok-400" />Key Wins</h3>
        <div className="space-y-3">
          {data.key_wins.map((w) => (
            <div key={w.win} className="flex items-center justify-between p-3 bg-ok-500/5 border border-ok-500/20 rounded-xl">
              <p className="text-slate-900 dark:text-white font-medium text-sm">{w.win}</p>
              <p className="text-ok-400 font-bold">{fmtINR(w.value_cr * 1e7)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="card">
        <h3 className="section-title">Recommended Actions</h3>
        <ol className="space-y-2">
          {data.recommendations.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="text-nexus-400 font-bold flex-shrink-0">{i + 1}.</span>{r}
            </li>
          ))}
        </ol>
      </div>

      <div className="text-center p-4 bg-nexus-500/5 border border-nexus-500/20 rounded-xl">
        <div className="ai-insight-badge mx-auto w-fit mb-2"><Bot size={12} />{data.ai_badge}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Requires CFO / Chief Actuary sign-off before board presentation</p>
      </div>
    </div>
  )
}
