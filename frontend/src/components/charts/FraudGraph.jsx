/**
 * FraudGraph — animated D3 force-directed network revealing fraud rings.
 * Nodes pulse red when fraud score > threshold. Edges show claim flow.
 * Fully interactive: drag nodes, click to see details.
 */
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const RING_DATA = {
  nodes: [
    // Fraud ring hub
    { id: 'G001', label: 'SunShine Auto', type: 'garage', score: 92, claims: 84 },
    { id: 'G002', label: 'City Motors', type: 'garage', score: 87, claims: 61 },
    { id: 'G003', label: 'Speed Auto', type: 'garage', score: 45, claims: 23 },
    // Surveyors
    { id: 'S001', label: 'Rajan K.', type: 'surveyor', score: 88, claims: 112 },
    { id: 'S002', label: 'Priya M.', type: 'surveyor', score: 31, claims: 40 },
    // Customers
    { id: 'C001', label: 'Rahul V.', type: 'customer', score: 78, claims: 5 },
    { id: 'C002', label: 'Anil P.', type: 'customer', score: 82, claims: 4 },
    { id: 'C003', label: 'Sunita D.', type: 'customer', score: 21, claims: 2 },
    { id: 'C004', label: 'Manoj T.', type: 'customer', score: 73, claims: 3 },
    { id: 'C005', label: 'Deepa R.', type: 'customer', score: 15, claims: 1 },
    // Insurance agent
    { id: 'A001', label: 'Agent Sharma', type: 'agent', score: 71, claims: 310 },
    // Hospital (health fraud)
    { id: 'H001', label: 'QuickCure Hosp.', type: 'hospital', score: 85, claims: 220 },
    { id: 'C006', label: 'Vijay S.', type: 'customer', score: 65, claims: 6 },
  ],
  links: [
    { source: 'C001', target: 'G001', value: 3 },
    { source: 'C002', target: 'G001', value: 4 },
    { source: 'C004', target: 'G002', value: 3 },
    { source: 'G001', target: 'S001', value: 6 },
    { source: 'G002', target: 'S001', value: 4 },
    { source: 'G003', target: 'S002', value: 2 },
    { source: 'S001', target: 'A001', value: 8 },
    { source: 'C003', target: 'G003', value: 1 },
    { source: 'C005', target: 'G003', value: 1 },
    { source: 'C006', target: 'H001', value: 4 },
    { source: 'H001', target: 'S001', value: 5 },
    { source: 'A001', target: 'G001', value: 10 },
  ],
}

const TYPE_COLOR = {
  garage: '#ef4444',
  surveyor: '#f59e0b',
  customer: '#6366f1',
  agent: '#ec4899',
  hospital: '#10b981',
}
const TYPE_ICON = { garage: '🔧', surveyor: '👁', customer: '👤', agent: '💼', hospital: '🏥' }

export default function FraudGraph() {
  const svgRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [threshold, setThreshold] = useState(60)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const W = el.clientWidth || 700
    const H = 440

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('width', W)
      .attr('height', H)

    // Background
    svg.append('rect').attr('width', W).attr('height', H).attr('rx', 16)
      .attr('fill', 'transparent')

    // Glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow')
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    const nodes = RING_DATA.nodes.map(d => ({ ...d }))
    const links = RING_DATA.links.map(d => ({ ...d }))

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(32))

    // Links
    const link = svg.append('g').selectAll('line')
      .data(links).join('line')
      .attr('stroke', d => {
        const src = nodes.find(n => n.id === (d.source.id || d.source))
        return src?.score >= threshold ? '#ef444466' : '#94a3b833'
      })
      .attr('stroke-width', d => Math.sqrt(d.value) * 1.2)

    // Node groups
    const node = svg.append('g').selectAll('g')
      .data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )
      .on('click', (e, d) => setSelected(d))

    // Pulse ring for high-risk nodes
    node.filter(d => d.score >= threshold)
      .append('circle')
      .attr('r', 22)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.5)
      .attr('filter', 'url(#glow)')
      .each(function () {
        d3.select(this).append('animate')
          .attr('attributeName', 'r').attr('values', '18;26;18').attr('dur', '2s').attr('repeatCount', 'indefinite')
        d3.select(this).append('animate')
          .attr('attributeName', 'opacity').attr('values', '0.6;0.1;0.6').attr('dur', '2s').attr('repeatCount', 'indefinite')
      })

    // Main circle
    node.append('circle')
      .attr('r', d => 10 + Math.sqrt(d.claims) * 0.8)
      .attr('fill', d => TYPE_COLOR[d.type] + (d.score >= threshold ? 'ff' : '88'))
      .attr('stroke', d => d.score >= threshold ? '#fff' : 'transparent')
      .attr('stroke-width', 1.5)
      .attr('filter', d => d.score >= threshold ? 'url(#glow)' : null)

    // Labels
    node.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => 14 + Math.sqrt(d.claims) * 0.8)
      .attr('font-size', 9)
      .attr('fill', '#94a3b8')
      .attr('pointer-events', 'none')

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => sim.stop()
  }, [threshold])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="section-title mb-0">Fraud Network Graph</h3>
          <p className="text-xs text-slate-400">Pulsing nodes = fraud score above threshold · Drag to explore</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">Threshold: <span className="font-bold text-danger-400">{threshold}</span></label>
          <input type="range" min={20} max={90} value={threshold} onChange={e => setThreshold(+e.target.value)} className="w-28 accent-danger-500" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(TYPE_COLOR).map(([t, c]) => (
          <span key={t} className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} />
            {TYPE_ICON[t]} {t}
          </span>
        ))}
        <span className="flex items-center gap-1 text-xs text-danger-400 font-semibold ml-2">
          ● Pulsing = High Risk
        </span>
      </div>

      <svg ref={svgRef} className="w-full" />

      {/* Selected node detail */}
      {selected && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-start gap-3">
          <span className="text-2xl">{TYPE_ICON[selected.type]}</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{selected.label}
              <span className="ml-2 text-xs font-normal text-slate-500 capitalize">({selected.type})</span>
            </p>
            <div className="flex gap-4 mt-1">
              <span className="text-xs">Fraud Score: <span className={`font-bold ${selected.score >= threshold ? 'text-danger-400' : 'text-ok-400'}`}>{selected.score}</span></span>
              <span className="text-xs">Claims Involved: <span className="font-bold text-slate-700 dark:text-slate-200">{selected.claims}</span></span>
            </div>
          </div>
          <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>
      )}
    </div>
  )
}
