/**
 * GlobeMap — 3D India-centric globe with glowing claim arc hotspots.
 * Uses react-globe.gl with custom arc data representing claim flows.
 * Lazy loaded — only imported when user clicks "3D Globe" toggle.
 */
import { useRef, useEffect, useState } from 'react'
import { scaleQuantize } from 'd3-scale'

const INDIA_CENTER = { lat: 22, lng: 82, altitude: 1.8 }

// Major Indian city claim hotspots
const HOTSPOTS = [
  { lat: 19.07, lng: 72.87, city: 'Mumbai', claims: 18400, risk: 0.89 },
  { lat: 28.67, lng: 77.22, city: 'Delhi', claims: 14200, risk: 0.74 },
  { lat: 12.97, lng: 77.59, city: 'Bangalore', claims: 11000, risk: 0.75 },
  { lat: 13.08, lng: 80.27, city: 'Chennai', claims: 9600, risk: 0.76 },
  { lat: 10.85, lng: 76.27, city: 'Kerala', claims: 12800, risk: 0.94 },
  { lat: 26.91, lng: 75.79, city: 'Jaipur', claims: 7200, risk: 0.82 },
  { lat: 23.02, lng: 72.57, city: 'Ahmedabad', claims: 8100, risk: 0.70 },
  { lat: 22.57, lng: 88.36, city: 'Kolkata', claims: 7600, risk: 0.77 },
  { lat: 17.68, lng: 83.21, city: 'Vizag', claims: 5800, risk: 0.68 },
  { lat: 26.45, lng: 80.33, city: 'Kanpur', claims: 6200, risk: 0.71 },
]

// Create arcs between major hubs
const ARCS = HOTSPOTS.slice(0, 6).flatMap((src, i) =>
  HOTSPOTS.slice(i + 1, i + 3).map(dst => ({
    startLat: src.lat, startLng: src.lng,
    endLat: dst.lat, endLng: dst.lng,
    color: src.risk > 0.85 ? '#ef4444' : src.risk > 0.75 ? '#f59e0b' : '#6366f1',
    label: `${src.city} → ${dst.city}`,
  }))
)

export default function GlobeMap({ data, metric }) {
  const globeEl = useRef(null)
  const [GlobeGL, setGlobeGL] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import('react-globe.gl').then(m => {
      setGlobeGL(() => m.default)
      setReady(true)
    }).catch(() => setReady(false))
  }, [])

  const colorScale = scaleQuantize()
    .domain([0.5, 1.0])
    .range(['#1e3a8a', '#1d4ed8', '#4f46e5', '#7c3aed', '#f59e0b', '#ef4444'])

  const pointsData = HOTSPOTS.map(h => ({
    ...h,
    color: colorScale(h.risk),
    size: Math.sqrt(h.claims / 1000) * 0.3,
  }))

  if (!ready || !GlobeGL) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-10 h-10 border-2 border-nexus-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading 3D Globe...</span>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height: 480 }}>
      <GlobeGL
        ref={globeEl}
        width={undefined}
        height={480}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#6366f1"
        atmosphereAltitude={0.18}
        pointsData={pointsData}
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.4}
        pointLabel={d => `<div style="background:#1e293b;padding:6px 10px;border-radius:8px;border:1px solid rgba(99,102,241,0.4);font-size:12px;color:#f1f5f9"><b>${d.city}</b><br/>Claims: ${d.claims.toLocaleString()}<br/>Risk: ${(d.risk * 100).toFixed(0)}%</div>`}
        arcsData={ARCS}
        arcColor="color"
        arcDashLength={0.5}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        arcStroke={0.4}
        arcLabel={d => d.label}
        onGlobeReady={() => {
          globeEl.current?.pointOfView(INDIA_CENTER, 0)
        }}
      />
      {/* Overlay legend */}
      <div className="absolute top-4 left-4 bg-white/80 dark:bg-navy-900/80 backdrop-blur rounded-xl px-3 py-2 border border-slate-200 dark:border-white/10">
        <p className="text-xs font-semibold text-slate-700 dark:text-white mb-1">Claim Hotspots</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-danger-500 inline-block" /> High Risk
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-1" /> Medium
          <span className="w-2 h-2 rounded-full bg-nexus-500 inline-block ml-1" /> Normal
        </div>
      </div>
    </div>
  )
}
