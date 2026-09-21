/**
 * HeatCalendar — GitHub-style daily claims volume heatmap.
 * Shows 52 weeks × 7 days grid with hover tooltips.
 */
import { useMemo, useState } from 'react'

function generateCalendarData() {
  const weeks = []
  const base = new Date('2024-01-01')
  for (let w = 0; w < 52; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(base)
      date.setDate(base.getDate() + w * 7 + d)
      const isMonsoon = date.getMonth() >= 5 && date.getMonth() <= 8
      const isWeekend = d === 0 || d === 6
      let claims = Math.floor(Math.random() * 180 + 40)
      if (isMonsoon) claims = Math.floor(claims * 1.8)
      if (isWeekend) claims = Math.floor(claims * 0.6)
      days.push({ date: date.toISOString().slice(0, 10), claims })
    }
    weeks.push(days)
  }
  return weeks
}

function getColor(claims) {
  if (claims < 60) return '#dbeafe'
  if (claims < 120) return '#93c5fd'
  if (claims < 180) return '#6366f1'
  if (claims < 250) return '#7c3aed'
  return '#ef4444'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function HeatCalendar() {
  const data = useMemo(() => generateCalendarData(), [])
  const [tooltip, setTooltip] = useState(null)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Claims Volume — Daily Heat Calendar 2024</h3>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Low</span>
          {['#dbeafe', '#93c5fd', '#6366f1', '#7c3aed', '#ef4444'].map(c => (
            <div key={c} className="w-4 h-4 rounded-sm" style={{ background: c }} />
          ))}
          <span>High</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-1 pt-5">
            {DAYS.map((d, i) => (
              <div key={i} className="w-3 h-3 text-[9px] text-slate-400 flex items-center justify-center">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {data.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {/* Month label for first week of month */}
              <div className="h-4 text-[9px] text-slate-400 truncate">
                {wi === 0 || (week[0]?.date && new Date(week[0].date).getDate() <= 7)
                  ? MONTHS[new Date(week[0]?.date).getMonth()] : ''}
              </div>
              {week.map((day, di) => (
                <div
                  key={di}
                  className="w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-125 hover:ring-1 hover:ring-slate-400"
                  style={{ background: getColor(day.claims) }}
                  onMouseEnter={() => setTooltip(day)}
                  onMouseLeave={() => setTooltip(null)}
                  title={`${day.date}: ${day.claims} claims`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {tooltip && (
        <div className="mt-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{tooltip.date}</span>
          {' — '}<span className="text-nexus-600 dark:text-nexus-400 font-bold">{tooltip.claims}</span> claims
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">🔴 Monsoon season (Jun–Sep) shows significantly higher claim density</p>
    </div>
  )
}
