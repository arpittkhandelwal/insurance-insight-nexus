/**
 * Executive Command Center — main dashboard page.
 * KPI tiles + sparklines, India heatmap, trend charts, AI insights strip.
 */

import { useState, useEffect, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, AlertTriangle, Globe,
  RefreshCw, Calendar, Zap, Map,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'
import { fetchKpis, fetchTimeseries, fetchGeoMetric } from '../services/api'
import { fmtINR, fmtNumber, fmtPct } from '../lib/utils'
import IndiaMap from '../components/charts/IndiaMap'
import Sparkline from '../components/charts/Sparkline'
import AiInsightStrip from '../components/ui/AiInsightStrip'
import { useCountUp } from '../hooks/useCountUp'
const GlobeMap = lazy(() => import('../components/charts/GlobeMap'))

function LiveClaimsStream() {
  const [claims, setClaims] = useState([])

  useEffect(() => {
    const timer = setInterval(() => {
      const newClaim = {
        id: `CLM-${Math.floor(Math.random() * 90000) + 10000}`,
        amount: Math.floor(Math.random() * 500000) + 10000,
        type: ['Motor', 'Health', 'Crop', 'Property'][Math.floor(Math.random() * 4)],
        timestamp: new Date().toLocaleTimeString()
      }
      setClaims(prev => [newClaim, ...prev].slice(0, 5))
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-danger-500"></span>
          </span>
          Live Claims Stream
        </h3>
      </div>
      <div className="flex-1 overflow-hidden space-y-2">
        {claims.length === 0 && <div className="text-slate-500 text-sm flex items-center justify-center h-full">Connecting to stream...</div>}
        {claims.map(c => (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key={c.id} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 text-sm">
            <div>
              <span className="font-mono text-xs text-slate-500 mr-2">{c.id}</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{c.type}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-nexus-600 dark:text-nexus-400">₹{c.amount.toLocaleString()}</span>
              <div className="text-[10px] text-slate-400">{c.timestamp}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}


const STAGGER = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }
const ITEM = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function KpiTile({ kpi }) {
  const isUp = kpi.delta_pct > 0
  const DeltaIcon = isUp ? TrendingUp : TrendingDown
  const deltaClass = kpi.trend === 'up'
    ? (kpi.key === 'fraud_exposure' || kpi.key === 'loss_ratio' || kpi.key === 'lapse_rate' || kpi.key === 'open_high_risk_cases'
       ? 'text-danger-400' : 'text-ok-400')
    : 'text-ok-400'

  // Parse raw number for count-up animation
  const rawNum = parseFloat(String(kpi.value).replace(/[^0-9.]/g, '')) || 0
  const decimals = rawNum < 10 ? 1 : 0
  const animatedNum = useCountUp(rawNum, 1400, decimals)

  // Reconstruct formatted value with animated number
  const displayValue = kpi.unit === '%' ? `${animatedNum}%`
    : kpi.unit === 'Cr' ? `₹${animatedNum} Cr`
    : kpi.unit === 'days' ? `${animatedNum}d`
    : kpi.unit === 'cases' ? animatedNum
    : kpi.formatted

  return (
    <motion.div variants={ITEM} className="kpi-tile">
      {/* Glow accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-nexus-500/5 rounded-full -translate-y-12 translate-x-12" />

      <div className="flex items-start justify-between mb-3">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">{kpi.label}</p>
        {kpi.delta_pct != null && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${deltaClass}`}>
            <DeltaIcon size={12} />
            {Math.abs(kpi.delta_pct).toFixed(1)}%
          </span>
        )}
      </div>

      <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mb-1">
        {displayValue}
      </p>

      {/* Sparkline */}
      <div className="h-12 mt-2">
        <Sparkline data={kpi.sparkline} color={
          kpi.key === 'fraud_exposure' ? '#ef4444'
            : kpi.key === 'loss_ratio' ? '#f59e0b'
            : '#6366f1'
        } />
      </div>
    </motion.div>
  )
}

function SkeletonTile() {
  return (
    <div className="card">
      <div className="skeleton h-4 w-24 mb-3 rounded" />
      <div className="skeleton h-8 w-32 mb-2 rounded" />
      <div className="skeleton h-12 w-full rounded" />
    </div>
  )
}

export default function Dashboard() {
  const [mapMetric, setMapMetric] = useState('loss_ratio')
  const [mapView, setMapView] = useState('map') // 'map' | 'globe'
  const [compareMode, setCompareMode] = useState(false)
  const [compareA, setCompareA] = useState('Maharashtra')
  const [compareB, setCompareB] = useState('Kerala')
  const [filters] = useState({})

  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => fetchKpis(filters),
  })

  const { data: tsData } = useQuery({
    queryKey: ['timeseries', 'claims_paid', filters],
    queryFn: () => fetchTimeseries('claims_paid', { granularity: 'monthly', forecast_periods: 12, ...filters }),
  })

  const { data: geoData } = useQuery({
    queryKey: ['geo', mapMetric],
    queryFn: () => fetchGeoMetric(mapMetric),
    keepPreviousData: true,
  })

  const { data: lrData } = useQuery({
    queryKey: ['timeseries', 'loss_ratio', filters],
    queryFn: () => fetchTimeseries('loss_ratio', { granularity: 'monthly', ...filters }),
  })

  const kpis = kpisData?.kpis || []
  const tsSeries = tsData?.series || []
  const lrSeries = lrData?.series || []

  // Format timeseries for Recharts
  const chartData = tsSeries.map((p) => ({
    period: p.period.slice(0, 7),
    value: p.value / 1e7,  // Convert to Cr
    forecast: p.forecast ? p.forecast / 1e7 : undefined,
    lo: p.forecast_lower ? p.forecast_lower / 1e7 : undefined,
    hi: p.forecast_upper ? p.forecast_upper / 1e7 : undefined,
  }))

  const lrChartData = lrSeries.map((p) => ({
    period: p.period.slice(0, 7),
    value: Math.round((p.value || 0) * 100),
  }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Executive Command Center</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time insurance portfolio intelligence · <span className="text-nexus-400">LLM_PROVIDER={import.meta.env.VITE_LLM_PROVIDER || 'mock'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <Calendar size={16} />
            <span>Jul 2022 – Sep 2024</span>
          </button>
          <button className="btn-primary">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* AI Insights Strip */}
      <AiInsightStrip />

      {/* KPI Tiles */}
      <section aria-label="Key Performance Indicators">
        <h2 className="section-title flex items-center gap-2">
          <Zap size={18} className="text-nexus-400" />
          Portfolio KPIs
        </h2>
        {kpisLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array(9).fill(0).map((_, i) => <SkeletonTile key={i} />)}
          </div>
        ) : (
          <motion.div
            variants={STAGGER}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
          >
            {kpis.map((kpi) => <KpiTile key={kpi.key} kpi={kpi} />)}
          </motion.div>
        )}
      </section>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Claims trend + forecast */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title mb-0">Claims Paid — 12-Month Forecast</h3>
            <span className="text-xs text-nexus-400 bg-nexus-500/10 px-2 py-1 rounded-lg border border-nexus-500/20">
              Monsoon spike visible Jul 2022
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="claimGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}Cr`} />
              <Tooltip
                formatter={(v, name) => [
                  `₹${Number(v).toFixed(1)} Cr`,
                  name === 'value' ? 'Actual' : 'Forecast'
                ]}
                contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 12 }}
              />
              <ReferenceLine x="2022-07" stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Monsoon', fill: '#ef4444', fontSize: 10 }} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#claimGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="forecast" stroke="#8b5cf6" fill="url(#forecastGrad)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Loss ratio trend */}
        <div className="card">
          <h3 className="section-title">Loss Ratio Trend (%)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lrChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[50, 100]} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Loss Ratio']}
                contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 12 }}
              />
              <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target 85%', fill: '#f59e0b', fontSize: 10 }} />
              <ReferenceLine x="2022-07" stroke="#ef4444" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* India Heatmap / Globe */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="section-title mb-0">India Risk Intelligence</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Map/Globe toggle */}
            <div className="flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
              <button onClick={() => setMapView('map')} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all ${ mapView === 'map' ? 'bg-nexus-500/20 text-nexus-300' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white' }`}>
                <Map size={12} /> Map
              </button>
              <button onClick={() => setMapView('globe')} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all ${ mapView === 'globe' ? 'bg-nexus-500/20 text-nexus-300' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white' }`}>
                <Globe size={12} /> 3D Globe
              </button>
            </div>
            {/* Comparison toggle */}
            <button onClick={() => setCompareMode(c => !c)} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${ compareMode ? 'bg-ok-500/20 border-ok-400/40 text-ok-400' : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400' }`}>
              Compare Mode
            </button>
            {/* Metric buttons */}
            {['loss_ratio', 'claim_frequency', 'fraud_score', 'weather_exposure', 'settlement_days'].map((m) => (
              <button
                key={m}
                onClick={() => setMapMetric(m)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  mapMetric === m
                    ? 'bg-nexus-500/20 border-nexus-500/40 text-nexus-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/30'
                }`}
              >
                {m.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {mapView === 'globe' ? (
            <motion.div key="globe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-400">Loading 3D Globe...</div>}>
                <GlobeMap data={geoData} metric={mapMetric} />
              </Suspense>
            </motion.div>
          ) : compareMode ? (
            <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-4">
              {[compareA, compareB].map((state, i) => {
                const stateData = geoData?.states?.find(s => s.state === state)
                const states = ['Maharashtra', 'Kerala', 'Rajasthan', 'Gujarat', 'Tamil Nadu', 'Karnataka', 'Uttar Pradesh', 'West Bengal']
                return (
                  <div key={i} className="space-y-2">
                    <select value={i === 0 ? compareA : compareB} onChange={e => i === 0 ? setCompareA(e.target.value) : setCompareB(e.target.value)} className="w-full text-sm bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1">
                      {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{state}</p>
                      <p className="text-2xl font-bold text-nexus-600 dark:text-nexus-400 mt-1">{stateData ? stateData.value.toFixed(2) : 'N/A'}</p>
                      <p className="text-xs text-slate-400 mt-1">{mapMetric.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <IndiaMap data={geoData} metric={mapMetric} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom row — product breakdown + alert */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Product mix bar chart */}
        <div className="card xl:col-span-2">
          <h3 className="section-title">Claims by Product Line</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[
              { product: 'Motor', claims: 36_000, paid: 3_90_00_000 / 1e7 },
              { product: 'Health', claims: 30_000, paid: 2_94_00_000 / 1e7 },
              { product: 'Life', claims: 18_000, paid: 1_73_60_000 / 1e7 },
              { product: 'Home', claims: 14_400, paid: 86_40_000 / 1e7 },
              { product: 'Crop', claims: 7_200, paid: 1_82_00_000 / 1e7 },
              { product: 'Travel', claims: 9_600, paid: 40_80_000 / 1e7 },
              { product: 'Marine', claims: 4_800, paid: 58_40_000 / 1e7 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="product" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}Cr`} />
              <Tooltip
                formatter={(v, name) => [
                  name === 'paid' ? `₹${v.toFixed(1)} Cr` : v.toLocaleString('en-IN'),
                  name === 'paid' ? 'Claims Paid' : 'Claim Count'
                ]}
                contentStyle={{ background: 'var(--tooltip-bg, #111b33)', border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))', borderRadius: 12 }}
              />
              <Bar dataKey="paid" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active alerts summary */}
        <div className="card">
          <h3 className="section-title flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger-400" />
            Active Alerts
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Motor Fraud Ring', severity: 'Critical', amount: '₹12.4 Cr', action: '/fraud' },
              { label: 'Crop/Rajasthan LR 91%', severity: 'High', amount: '₹8.5 Cr', action: '/policies' },
              { label: 'Hospital Upcoding', severity: 'High', amount: '₹6.2 Cr', action: '/claims' },
              { label: 'Monsoon Reserve Gap', severity: 'Medium', amount: '₹28 Cr', action: '/anomaly' },
            ].map((alert) => (
              <a key={alert.label} href={alert.action}
                 className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5
                            border border-slate-200 dark:border-white/10 hover:border-nexus-500/30 transition-all">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.label}</p>
                  <span className={`badge mt-1 ${
                    alert.severity === 'Critical' ? 'badge-critical'
                      : alert.severity === 'High' ? 'badge-high' : 'badge-medium'
                  }`}>{alert.severity}</span>
                </div>
                <span className="text-danger-400 font-semibold text-sm">{alert.amount}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Live Claims Stream */}
        <LiveClaimsStream />
      </div>
    </div>
  )
}
