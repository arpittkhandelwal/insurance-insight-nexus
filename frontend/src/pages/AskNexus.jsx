/**
 * Ask Nexus — Natural-language insurance analytics with 10-step agentic workflow.
 * Streaming SSE responses, visible agent trace, inline charts, SQL viewer.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, ChevronDown, ChevronRight, Copy, Check,
  Code, BarChart3, Mic, BookOpen, AlertTriangle, Loader2,
  Sparkles, Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { askNexusStream, fetchSuggestions } from '../services/api'
import { clsx } from '../lib/utils'

const STEP_ICONS = {
  'Intent Classification':     '🧠',
  'Query Planning':            '📋',
  'SQL Generation':            '⚙️',
  'SQL Safety Guard':          '🛡️',
  'Query Execution':           '🔍',
  'Chart Selection':           '📊',
  'Root-Cause Drill-Down':     '🔬',
  'Insight Writing':           '✍️',
  'Recommendations':           '💡',
  'Verification':              '✅',
}

function AgentStep({ step }) {
  const [expanded, setExpanded] = useState(false)
  const icon = STEP_ICONS[step.name] || '•'
  const statusIcon = {
    done: <CheckCircle2 size={14} className="text-ok-400" />,
    running: <Loader2 size={14} className="text-nexus-400 animate-spin" />,
    error: <XCircle size={14} className="text-danger-400" />,
    pending: <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/20" />,
  }[step.status]

  return (
    <div className={`agent-step ${step.status}`}>
      <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {statusIcon}
        <span className="text-xs">{icon} {step.name}</span>
        {step.duration_ms && (
          <span className="text-slate-500 text-xs flex items-center gap-0.5 ml-auto">
            <Clock size={10} />
            {step.duration_ms}ms
          </span>
        )}
        {step.detail && (
          expanded ? <ChevronDown size={12} className="text-slate-500 dark:text-slate-400" />
                   : <ChevronRight size={12} className="text-slate-500 dark:text-slate-400" />
        )}
      </div>
      {expanded && step.detail && (
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 ml-6 pl-2 border-l border-slate-200 dark:border-white/10">
          {step.detail}
        </p>
      )}
    </div>
  )
}

function SqlBlock({ sql }) {
  const [copied, setCopied] = useState(false)
  if (!sql) return null
  const copy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden mt-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
          <Code size={12} />
          <span>Generated SQL</span>
          <span className="badge bg-ok-500/10 text-ok-400 border border-ok-500/20">
            ✓ Safety Verified
          </span>
        </div>
        <button onClick={copy} className="btn-ghost text-xs py-1 px-2">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs text-ok-300 p-4 overflow-x-auto font-mono leading-relaxed">{sql}</pre>
    </div>
  )
}

function InlineChart({ chartType, data, config }) {
  if (!data?.length || chartType === 'table') {
    if (!data?.length) return null
    const cols = Object.keys(data[0]).slice(0, 6)
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="data-table text-xs">
          <thead>
            <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {data.slice(0, 20).map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c}>{typeof row[c] === 'number' ? row[c].toLocaleString('en-IN') : String(row[c] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const xKey = config?.x || Object.keys(data[0])[0]
  const yKey = config?.y?.[0] || Object.keys(data[0])[1]

  const Chart = chartType === 'line' ? LineChart : chartType === 'scatter' ? ScatterChart : BarChart

  return (
    <div className="mt-3 bg-slate-50 dark:bg-navy-900/50 rounded-xl p-3">
      <ResponsiveContainer width="100%" height={200}>
        {chartType === 'line' ? (
          <LineChart data={data.slice(0, 50)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 8 }} />
            <Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={data.slice(0, 20)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 8 }} />
            <Bar dataKey={yKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function Message({ msg }) {
  const [showTrace, setShowTrace] = useState(false)

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-nexus-600/30 border border-nexus-500/30 rounded-2xl rounded-tr-sm px-4 py-3 max-w-2xl">
          <p className="text-slate-900 dark:text-white text-sm">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 max-w-5xl">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-nexus-500 to-nexus-700 flex-shrink-0
                      flex items-center justify-center mt-1">
        <Bot size={16} className="text-slate-900 dark:text-white" />
      </div>
      <div className="flex-1 space-y-3">
        {/* AI badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="ai-insight-badge w-fit">
            <Sparkles size={12} />
            AI Analytical Insight — Not a Final Decision
          </div>
          {msg.provider && (
            <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-nexus-500/20 text-nexus-600 dark:text-nexus-400 bg-nexus-500/10">
              Powered by {msg.provider === 'bedrock' ? 'Amazon Bedrock' : msg.provider === 'sarvam' ? 'Sarvam AI' : 'Mock Mode'}
            </div>
          )}
        </div>

        {/* Agent trace toggle */}
        {msg.steps?.length > 0 && (
          <div>
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {showTrace ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>{msg.steps.length} agent steps</span>
              {msg.steps.every((s) => s.status === 'done') && (
                <CheckCircle2 size={12} className="text-ok-400" />
              )}
            </button>

            <AnimatePresence>
              {showTrace && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-1.5 overflow-hidden"
                >
                  {msg.steps.map((step) => (
                    <AgentStep key={step.step} step={step} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* SQL */}
        {msg.sql && <SqlBlock sql={msg.sql} />}

        {/* Chart */}
        {msg.chartType && msg.chartData && (
          <InlineChart chartType={msg.chartType} data={msg.chartData} config={msg.chartConfig} />
        )}

        {/* Insight text */}
        {msg.content && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}

        {/* Streaming indicator */}
        {msg.streaming && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <Loader2 size={14} className="animate-spin" />
            <span>Analyzing...</span>
          </div>
        )}

        {/* Recommendations */}
        {msg.recommendations?.length > 0 && (
          <div className="border border-slate-200 dark:border-white/10 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recommended Actions</p>
            {msg.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-nexus-400 font-bold">{i + 1}.</span>
                {r}
              </div>
            ))}
          </div>
        )}

        {/* Follow-up suggestions */}
        {msg.followUps?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {msg.followUps.map((q) => (
              <button
                key={q}
                className="text-xs bg-nexus-500/10 text-nexus-400 border border-nexus-500/20
                           px-3 py-1.5 rounded-lg hover:bg-nexus-500/20 transition-colors"
              >
                {q.length > 50 ? q.slice(0, 50) + '…' : q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const STARTER_QUESTIONS = [
  'Why did motor claims spike in Kerala in July 2022?',
  'Show the top fraud risk claims this month',
  'What is the loss ratio by product line for 2023?',
  'Which hospital chain has the highest billing anomaly?',
  'Show the Rajasthan crop portfolio loss ratio trend',
]

export default function AskNexus() {
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const messagesEndRef = useRef(null)
  const cancelRef = useRef(null)
  const mediaRecorderRef = useRef(null)

  // Auto-populate from URL param (e.g., from command palette)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !messages.length) {
      setInput(q)
      setTimeout(() => handleSubmit(null, q), 300)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async (e, overrideQuestion) => {
    e?.preventDefault()
    const question = overrideQuestion || input.trim()
    if (!question || loading) return

    setInput('')
    setLoading(true)

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: question }
    const assistantId = Date.now() + 1
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      steps: [],
      sql: null,
      chartType: null,
      chartData: null,
      chartConfig: null,
      recommendations: [],
      followUps: [],
      streaming: true,
    }

    setMessages((m) => [...m, userMsg, assistantMsg])

    // Stream SSE events
    cancelRef.current = askNexusStream(question, null, (event) => {
      setMessages((m) =>
        m.map((msg) => {
          if (msg.id !== assistantId) return msg
          switch (event.type) {
            case 'step':
              const existing = msg.steps.find((s) => s.step === event.data.step)
              if (existing) {
                return { ...msg, steps: msg.steps.map((s) => s.step === event.data.step ? event.data : s) }
              }
              return { ...msg, steps: [...msg.steps, event.data] }
            case 'sql':
              return { ...msg, sql: event.data.sql }
            case 'data':
              return { ...msg, chartData: event.data.rows }
            case 'chart':
              return { ...msg, chartType: event.data.chart_type, chartConfig: event.data.config }
            case 'insight_chunk':
              return { ...msg, content: msg.content + event.data.chunk }
            case 'recommendations':
              return {
                ...msg,
                recommendations: event.data.actions,
                followUps: event.data.follow_up_questions,
              }
            case 'done':
              return { ...msg, streaming: false, provider: event.data.provider }
            case 'error':
              return { ...msg, content: `❌ Error: ${event.data.message}`, streaming: false }
            default:
              return msg
          }
        })
      )
      if (event.type === 'done' || event.type === 'error' || event.type === 'end') {
        setLoading(false)
      }
    })
  }, [input, loading])

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Ask Nexus</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Natural-language insurance analytics with 10-step agentic AI workflow
          </p>
        </div>
        <div className="ai-insight-badge">
          <Bot size={14} />
          Agentic NL Engine · {import.meta.env.VITE_LLM_PROVIDER || 'Mock'} Mode
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">
        {messages.length === 0 && (
          <div className="space-y-8 py-8">
            {/* Welcome */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-nexus-500 to-nexus-700
                              flex items-center justify-center mb-4">
                <Sparkles size={32} className="text-slate-900 dark:text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">What would you like to know?</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-sm">
                Ask any question about your insurance portfolio in plain English.
                The AI will generate SQL, run it, explain the results, and suggest next steps.
              </p>
            </div>

            {/* Starter questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSubmit(null, q)}
                  className="card-hover text-left p-4 text-sm"
                >
                  <span className="text-nexus-400 font-semibold text-lg">›</span>
                  <p className="text-slate-600 dark:text-slate-300 mt-1">{q}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <Message key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
        {/* Voice input */}
        <button
          type="button"
          className={`btn-secondary p-2.5 transition-all ${recording ? 'bg-danger-50 text-danger-600 border-danger-200 dark:bg-danger-500/20 dark:text-danger-400 dark:border-danger-500/40 animate-pulse' : ''}`}
          aria-label="Voice input"
          onClick={async () => {
            if (recording) {
              mediaRecorderRef.current?.stop();
              setRecording(false);
              return;
            }
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mediaRecorder = new MediaRecorder(stream);
              mediaRecorderRef.current = mediaRecorder;
              const audioChunks = [];

              mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
              };

              mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');
                
                setInput('Transcribing audio with Sarvam AI...');
                try {
                  const res = await fetch('http://localhost:8000/api/v1/sarvam/transcribe', {
                    method: 'POST',
                    body: formData,
                  });
                  const data = await res.json();
                  if (data.text) {
                    setInput(data.text);
                  } else {
                    setInput('');
                  }
                } catch (e) {
                  console.error('Sarvam STT failed', e);
                  setInput('');
                }
                stream.getTracks().forEach(track => track.stop());
              };

              mediaRecorder.start();
              setRecording(true);
            } catch (err) {
              console.error("Microphone access denied", err);
              alert("Microphone access is required for voice input.");
            }
          }}
        >
          {recording ? <Mic size={18} className="text-danger-500" /> : <Mic size={18} />}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your insurance portfolio... (try: 'Why did motor claims spike in Kerala?')"
          className="input flex-1"
          disabled={loading}
          aria-label="Ask Nexus query input"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary px-5"
          aria-label="Send query"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {loading ? 'Analyzing…' : 'Ask'}
        </button>
      </form>

      {/* Assumptions note */}
      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
        <AlertTriangle size={11} />
        All answers include generated SQL, data lineage, and assumptions.
        AI outputs require human review before business decisions.
      </p>
    </div>
  )
}
