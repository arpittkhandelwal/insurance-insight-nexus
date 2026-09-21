/**
 * Indian number formatting utilities.
 * Uses lakh/crore notation as required.
 */

export const fmtINR = (val, opts = {}) => {
  const n = Number(val) || 0
  const { short = true, decimals = 2 } = opts
  if (!short) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n)
  }
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(decimals)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(decimals)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

export const fmtNumber = (val, decimals = 1) => {
  const n = Number(val) || 0
  if (n >= 1e7) return `${(n / 1e7).toFixed(decimals)} Cr`
  if (n >= 1e5) return `${(n / 1e5).toFixed(decimals)} L`
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)} K`
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals })
}

export const fmtPct = (val, decimals = 1) =>
  `${(Number(val) * 100).toFixed(decimals)}%`

export const fmtDays = (val) => {
  const n = Math.round(Number(val) || 0)
  return `${n} day${n !== 1 ? 's' : ''}`
}

export const clsx = (...classes) => classes.filter(Boolean).join(' ')

export const riskColor = (score) => {
  if (score >= 80) return 'text-danger-400'
  if (score >= 60) return 'text-orange-400'
  if (score >= 40) return 'text-warn-400'
  return 'text-ok-400'
}

export const riskBadgeClass = (tier) => {
  const map = {
    Critical: 'badge-critical',
    High: 'badge-high',
    Medium: 'badge-medium',
    Low: 'badge-low',
  }
  return map[tier] || 'badge'
}

export const trendIcon = (trend) => {
  if (trend === 'up') return '↑'
  if (trend === 'down') return '↓'
  return '→'
}

// Colors for charts
export const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
]

export const PRODUCT_COLORS = {
  Motor: '#6366f1',
  Health: '#10b981',
  Life: '#f59e0b',
  Home: '#06b6d4',
  Travel: '#8b5cf6',
  Crop: '#84cc16',
  Marine: '#ec4899',
}
