/**
 * Sparkline mini-chart using Recharts.
 */
import { LineChart, Line, ResponsiveContainer } from 'recharts'

export default function Sparkline({ data = [], color = '#6366f1', height = 48 }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
