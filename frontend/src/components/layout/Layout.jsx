/**
 * Main application shell — sidebar, top bar, and content area.
 * Includes the persistent AI insight disclaimer banner (required by rules).
 */

import { useState, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, AlertTriangle, Shield, MessageSquare,
  FileText, TrendingUp, Briefcase, Database, Bot,
  Settings, ChevronLeft, ChevronRight, Bell, Search,
  Sliders, ClipboardList, Zap, Info, Moon, Sun, Activity,
} from 'lucide-react'
import { useTheme } from '../../lib/ThemeProvider'
import { clsx } from '../../lib/utils'
import CommandPalette from '../ui/CommandPalette'
import GlobalFilters from '../ui/GlobalFilters'
import CopilotWidget from '../ui/CopilotWidget'

const NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Command Center',      badge: null,  tour: 'command-center' },
  { to: '/claims',        icon: FileText,        label: 'Claims Analytics',    badge: null,  tour: null },
  { to: '/policies',      icon: TrendingUp,      label: 'Policy Portfolio',    badge: null,  tour: null },
  { to: '/anomaly',       icon: AlertTriangle,   label: 'Anomaly Detection',   badge: '47',  tour: 'nav-anomaly' },
  { to: '/fraud',         icon: Shield,          label: 'Fraud Risk Center',   badge: '!!',  tour: 'nav-fraud' },
  { to: '/ask',           icon: MessageSquare,   label: 'Ask Nexus',           badge: null,  tour: 'nav-ask' },
  { to: '/simulate',      icon: Sliders,         label: 'Scenario Simulator',  badge: null,  tour: 'nav-simulate' },
  { to: '/stress-test',   icon: Activity,        label: 'Stress Test',         badge: 'NEW', tour: null },
  { to: '/cases',         icon: ClipboardList,   label: 'Case Management',     badge: '3',   tour: null },
  { to: '/briefing',      icon: Briefcase,       label: 'Executive Briefing',  badge: null,  tour: 'nav-briefing' },
  { to: '/data-quality',  icon: Database,        label: 'Data Quality',        badge: null,  tour: null },
  { to: '/model-monitor', icon: Bot,             label: 'Model Monitoring',    badge: null,  tour: null },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  // Cmd+K to open command palette
  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCmdOpen(true)
    }
  }, [])

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-navy-900 flex text-slate-900 dark:text-slate-800 dark:text-slate-100"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="bg-white dark:bg-navy-800 border-r border-slate-200 dark:border-white/10 flex flex-col h-screen sticky top-0 overflow-hidden z-20"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200 dark:border-white/10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-nexus-500 to-nexus-700 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-slate-900 dark:text-white text-sm leading-tight"
            >
              Insurance<br />
              <span className="text-gradient">Insight Nexus</span>
            </motion.span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto scrollbar-hide">
          {NAV.map(({ to, icon: Icon, label, badge, tour }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              data-tour={tour || undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                  isActive
                    ? 'bg-nexus-100 dark:bg-nexus-600/20 text-nexus-700 dark:text-nexus-300 border border-nexus-200 dark:border-nexus-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-50 dark:hover:bg-white/5'
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              {badge && !collapsed && (
                <span className={clsx(
                  'ml-auto text-xs font-bold px-1.5 py-0.5 rounded-md',
                  badge === '!!' ? 'bg-danger-100 text-danger-600 dark:bg-danger-500/30 dark:text-danger-400' : 'bg-nexus-100 text-nexus-600 dark:bg-nexus-500/20 dark:text-nexus-300'
                )}>
                  {badge}
                </span>
              )}
              {/* Tooltip when collapsed */}
              {collapsed && (
                <span className="absolute left-16 bg-white dark:bg-slate-100 dark:bg-navy-700 text-slate-900 dark:text-white text-xs px-2 py-1 rounded-lg
                                 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50
                                 border border-slate-200 dark:border-slate-300 dark:border-white/20 pointer-events-none shadow-card">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn-ghost w-full justify-center"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Collapse</span></>}
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white/80 dark:bg-navy-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-white/10 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
          {/* Search / Command palette trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            data-tour="cmd-k"
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2
                       text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-nexus-300 dark:hover:border-nexus-500/40 transition-all duration-200
                       text-sm flex-1 max-w-xs"
          >
            <Search size={14} />
            <span>Search or ask...</span>
            <kbd className="ml-auto text-xs bg-white dark:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded font-mono shadow-sm">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {/* AWS Badge */}
          <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-2 py-1 rounded text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wide">
            <span className="w-2 h-2 rounded-full bg-ok-500 animate-pulse"></span>
            Deployed on AWS
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn-ghost relative"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notification bell */}
          <button className="btn-ghost relative">
            <Bell size={18} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-danger-500 rounded-full" />
          </button>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-500 to-nexus-700
                          flex items-center justify-center text-white text-sm font-bold cursor-pointer">
            A
          </div>
        </header>

        {/* ── AI DISCLAIMER BANNER (required by hackathon rules) ── */}
        <div className="bg-nexus-50 dark:bg-nexus-950/80 border-b border-nexus-200 dark:border-nexus-500/20 px-6 py-2 flex items-center gap-2">
          <Info size={14} className="text-nexus-600 dark:text-nexus-400 flex-shrink-0" />
          <span className="text-xs text-nexus-800 dark:text-nexus-300">
            <strong>AI Analytical Insights Platform</strong> — All AI outputs are analytical insights to support decision-making.
            They are <strong>not final business decisions</strong>. Human review and sign-off is required before taking action.
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={(path) => { navigate(path); setCmdOpen(false) }}
      />
      
      {/* Global AI Copilot */}
      <CopilotWidget />
    </div>
  )
}
