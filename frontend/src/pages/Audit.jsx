/**Audit Log page*/
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { fetchAuditLog } from '../services/api'

export default function AuditPage() {
  const { data: entries = [] } = useQuery({ queryKey: ['audit'], queryFn: fetchAuditLog })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3"><BarChart3 className="text-nexus-400" />Audit Log</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Every query, decision, and export tracked for governance</p>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr>
            <th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th><th>Detail</th>
          </tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-xs text-slate-500 dark:text-slate-400">{new Date(e.timestamp).toLocaleString('en-IN')}</td>
                <td className="text-sm">{e.user}</td>
                <td><span className="badge badge-ai">{e.action}</span></td>
                <td className="font-mono text-xs">{e.resource}</td>
                <td className="text-xs text-slate-500 dark:text-slate-400 max-w-sm truncate">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
