/**
 * CommandPalette — Vercel/Linear style Cmd+K global palette using `cmdk`.
 */
import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { LayoutDashboard, AlertTriangle, Shield, TrendingUp, Sliders, Settings, Search, Bot, Briefcase } from 'lucide-react'
import { startTour } from './OnboardingTour'

export default function CommandPalette({ open, onClose, onNavigate }) {
  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (open) onClose()
        else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
        }
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-[20vh] bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
        <Command
          className="w-full h-full"
          shouldFilter={true}
          loop
        >
          <div className="flex items-center border-b border-slate-100 dark:border-white/5 px-4">
            <Search className="w-5 h-5 text-slate-400" />
            <Command.Input
              autoFocus
              placeholder="Search features, run simulations, or ask AI..."
              className="w-full bg-transparent border-0 py-4 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
            <div className="flex gap-1">
              <kbd className="bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">ESC</kbd>
            </div>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No results found. Press <kbd className="bg-slate-100 dark:bg-white/5 px-1 rounded">Enter</kbd> to ask Nexus AI.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs text-slate-500 font-medium px-2 py-1">
              {[
                { label: 'Command Center Dashboard', icon: LayoutDashboard, route: '/' },
                { label: 'Fraud Risk Center', icon: Shield, route: '/fraud' },
                { label: 'Anomaly Detection', icon: AlertTriangle, route: '/anomaly' },
                { label: 'Scenario Simulator', icon: Sliders, route: '/simulate' },
                { label: 'Executive Briefing', icon: Briefcase, route: '/briefing' },
              ].map(item => (
                <Command.Item
                  key={item.route}
                  onSelect={() => onNavigate(item.route)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-slate-700 dark:text-slate-300 aria-selected:bg-nexus-500/10 aria-selected:text-nexus-600 dark:aria-selected:text-nexus-400 cursor-pointer transition-colors"
                >
                  <item.icon size={16} />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions" className="text-xs text-slate-500 font-medium px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => { onClose(); startTour() }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-slate-700 dark:text-slate-300 aria-selected:bg-nexus-500/10 aria-selected:text-nexus-600 dark:aria-selected:text-nexus-400 cursor-pointer transition-colors"
              >
                <Bot size={16} />
                Start Onboarding Tour
              </Command.Item>
              <Command.Item
                onSelect={() => { document.documentElement.classList.toggle('dark'); onClose() }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-slate-700 dark:text-slate-300 aria-selected:bg-nexus-500/10 aria-selected:text-nexus-600 dark:aria-selected:text-nexus-400 cursor-pointer transition-colors"
              >
                <Settings size={16} />
                Toggle Dark/Light Mode
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
