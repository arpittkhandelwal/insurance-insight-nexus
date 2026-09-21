/**
 * App root — React Router, global state, theme, and layout.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import ClaimsPage from './pages/Claims'
import PoliciesPage from './pages/Policies'
import AnomalyPage from './pages/Anomaly'
import FraudPage from './pages/Fraud'
import AskNexus from './pages/AskNexus'
import SimulatorPage from './pages/Simulator'
import CasesPage from './pages/Cases'
import BriefingPage from './pages/Briefing'
import DataQualityPage from './pages/DataQuality'
import ModelMonitorPage from './pages/ModelMonitor'
import StressTestPage from './pages/StressTest'
import OnboardingTour from './components/ui/OnboardingTour'
import { useLiveAlerts } from './hooks/useLiveAlerts'

export default function App() {
  useLiveAlerts(true, 20000)
  return (
    <BrowserRouter>
      <OnboardingTour />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--tooltip-bg, #111b33)',
            color: '#f1f5f9',
            border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="claims" element={<ClaimsPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="anomaly" element={<AnomalyPage />} />
          <Route path="fraud" element={<FraudPage />} />
          <Route path="ask" element={<AskNexus />} />
          <Route path="simulate" element={<SimulatorPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="briefing" element={<BriefingPage />} />
          <Route path="data-quality" element={<DataQualityPage />} />
          <Route path="model-monitor" element={<ModelMonitorPage />} />
          <Route path="stress-test" element={<StressTestPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
