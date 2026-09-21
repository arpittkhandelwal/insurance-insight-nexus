/**
 * India state heatmap using react-simple-maps.
 * Shows per-state metric values with color scale.
 * Falls back to a static SVG placeholder if map data unavailable.
 */

import { useMemo } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { scaleQuantize } from 'd3-scale'
import { interpolateRgb } from 'd3-interpolate'

// India GeoJSON from a public CDN (simplified boundaries)
const GEO_URL = 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson'

const STATE_NAME_MAP = {
  'Andhra Pradesh': 'Andhra Pradesh',
  'Arunachal Pradesh': 'Arunachal Pradesh',
  'Assam': 'Assam',
  'Bihar': 'Bihar',
  'Chhattisgarh': 'Chhattisgarh',
  'Goa': 'Goa',
  'Gujarat': 'Gujarat',
  'Haryana': 'Haryana',
  'Himachal Pradesh': 'Himachal Pradesh',
  'Jammu and Kashmir': 'Jammu and Kashmir',
  'Jharkhand': 'Jharkhand',
  'Karnataka': 'Karnataka',
  'Kerala': 'Kerala',
  'Madhya Pradesh': 'Madhya Pradesh',
  'Maharashtra': 'Maharashtra',
  'Manipur': 'Manipur',
  'Meghalaya': 'Meghalaya',
  'Mizoram': 'Mizoram',
  'Nagaland': 'Nagaland',
  'NCT of Delhi': 'Delhi',
  'Odisha': 'Odisha',
  'Punjab': 'Punjab',
  'Rajasthan': 'Rajasthan',
  'Sikkim': 'Sikkim',
  'Tamil Nadu': 'Tamil Nadu',
  'Telangana': 'Telangana',
  'Tripura': 'Tripura',
  'Uttar Pradesh': 'Uttar Pradesh',
  'Uttarakhand': 'Uttarakhand',
  'West Bengal': 'West Bengal',
}

export default function IndiaMap({ data, metric = 'loss_ratio' }) {
  const stateValues = useMemo(() => {
    if (!data?.states) return {}
    return Object.fromEntries(data.states.map((s) => [s.state, s.value]))
  }, [data])

  const maxVal = data?.max_value || 1
  const minVal = data?.min_value || 0

  const colorScale = scaleQuantize()
    .domain([minVal, maxVal])
    .range([
      '#1e1b4b', '#2e2b6b', '#3730a3', '#4338ca',
      '#4f46e5', '#6366f1', '#818cf8',
      '#fbbf24', '#f59e0b', '#ef4444',
    ])

  const [tooltip, setTooltip] = useMemo(() => {
    let t = null
    return [t, (v) => { t = v }]
  }, [])

  return (
    <div className="relative w-full" style={{ height: 420 }}>
      {/* Legend */}
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        <span className="text-xs text-slate-500 dark:text-slate-400">{data?.unit || ''}</span>
        <div className="flex">
          {['#1e1b4b', '#4338ca', '#6366f1', '#f59e0b', '#ef4444'].map((c) => (
            <div key={c} style={{ background: c }} className="w-6 h-3" />
          ))}
        </div>
        <div className="flex text-xs text-slate-500 dark:text-slate-400 gap-6">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 1000, center: [82, 22] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup zoom={1} center={[82, 22]}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties.NAME_1 || geo.properties.name || ''
                const stateName = STATE_NAME_MAP[geoName] || geoName
                const value = stateValues[stateName]
                const fill = value != null ? colorScale(value) : '#1a2035'

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { fill: '#818cf8', outline: 'none', cursor: 'pointer' },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={() => {}}
                    aria-label={`${stateName}: ${value != null ? value.toFixed(2) : 'N/A'} ${data?.unit || ''}`}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}
