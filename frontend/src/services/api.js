/**
 * InsureNexus API client — all backend calls go through this module.
 * BASE_URL reads from env (proxied to /api in local dev).
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: inject auth token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: global error handling ─────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Redirect to login in production; ignore in demo mode
      console.warn('Unauthenticated — demo mode active')
    }
    return Promise.reject(err)
  }
)

// ── KPIs ────────────────────────────────────────────────────────────────────
export const fetchKpis = (filters = {}) =>
  api.get('/kpis', { params: filters }).then((r) => r.data)

// ── Timeseries ───────────────────────────────────────────────────────────────
export const fetchTimeseries = (metric, params = {}) =>
  api.get(`/timeseries/${metric}`, { params }).then((r) => r.data)

// ── Geo ──────────────────────────────────────────────────────────────────────
export const fetchGeoMetric = (metric, params = {}) =>
  api.get(`/geo/states/${metric}`, { params }).then((r) => r.data)

// ── Claims ───────────────────────────────────────────────────────────────────
export const fetchClaimsFunnel = (params = {}) =>
  api.get('/claims/funnel', { params }).then((r) => r.data)

export const fetchClaimsList = (params = {}) =>
  api.get('/claims/list', { params }).then((r) => r.data)

export const fetchProviderBenchmarks = (params = {}) =>
  api.get('/claims/provider-benchmarks', { params }).then((r) => r.data)

// ── Policies ─────────────────────────────────────────────────────────────────
export const fetchLossRatioCohort = (params = {}) =>
  api.get('/policies/loss-ratio-cohort', { params }).then((r) => r.data)

export const fetchLapseRisk = (params = {}) =>
  api.get('/policies/lapse-risk', { params }).then((r) => r.data)

// ── Anomalies ─────────────────────────────────────────────────────────────────
export const fetchAnomalies = (params = {}) =>
  api.get('/anomalies', { params }).then((r) => r.data)

// ── Fraud ─────────────────────────────────────────────────────────────────────
export const fetchFraudScores = (params = {}) =>
  api.get('/fraud/scores', { params }).then((r) => r.data)

export const fetchFraudGraph = (params = {}) =>
  api.get('/fraud/graph', { params }).then((r) => r.data)

// ── Cases ─────────────────────────────────────────────────────────────────────
export const fetchCases = (params = {}) =>
  api.get('/cases', { params }).then((r) => r.data)

export const createCase = (body) =>
  api.post('/cases', body).then((r) => r.data)

export const decideCase = (caseId, decision) =>
  api.post(`/cases/${caseId}/decide`, decision).then((r) => r.data)

// ── RAG ───────────────────────────────────────────────────────────────────────
export const queryRag = (body) =>
  api.post('/rag/query', body).then((r) => r.data)

// ── Simulate ─────────────────────────────────────────────────────────────────
export const simulate = (body) =>
  api.post('/simulate', body).then((r) => r.data)

// ── Briefing ─────────────────────────────────────────────────────────────────
export const fetchBriefing = (params = {}) =>
  api.get('/briefing', { params }).then((r) => r.data)

// ── Audit ─────────────────────────────────────────────────────────────────────
export const fetchAuditLog = (params = {}) =>
  api.get('/audit', { params }).then((r) => r.data)

// ── Data Quality ──────────────────────────────────────────────────────────────
export const fetchDataQuality = () =>
  api.get('/data-quality').then((r) => r.data)

// ── Model Cards ───────────────────────────────────────────────────────────────
export const fetchModelCards = () =>
  api.get('/models/cards').then((r) => r.data)

export const fetchModelPerformance = () =>
  api.get('/models/performance').then((r) => r.data)

// ── Ask Nexus (SSE streaming) ─────────────────────────────────────────────────
export const askNexusStream = (question, sessionId, onEvent) => {
  const url = `${BASE_URL}/ask/stream`
  const controller = new AbortController()

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId }),
    signal: controller.signal,
  }).then(async (res) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6))
            onEvent(event)
          } catch (_) {}
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onEvent({ type: 'error', data: { message: err.message } })
  })

  return () => controller.abort()
}

export const fetchSuggestions = (category) =>
  api.get('/ask/suggestions', { params: { category } }).then((r) => r.data)

export default api
