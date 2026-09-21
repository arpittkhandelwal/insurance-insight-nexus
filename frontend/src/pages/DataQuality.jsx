/**Data Quality page*/
import { useQuery } from '@tanstack/react-query'
import { Database, CheckCircle, AlertTriangle } from 'lucide-react'
import { fetchDataQuality } from '../services/api'

export default function DataQualityPage() {
  const { data } = useQuery({ queryKey: ['data-quality'], queryFn: fetchDataQuality })
  const tables = data?.tables || []

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3"><Database className="text-nexus-400" />Data Quality</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Nulls · Duplicates · Freshness · Schema drift</p>
        </div>
        {data && <div className="card text-center px-6"><p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Overall Score</p>
          <p className={`text-3xl font-bold ${data.overall_score >= 95 ? 'text-ok-400' : data.overall_score >= 85 ? 'text-warn-400' : 'text-danger-400'}`}>{data.overall_score}%</p>
        </div>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tables.map((t) => (
          <div key={t.table} className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 dark:text-white capitalize">{t.table}</h3>
              <div className="flex items-center gap-2">
                {t.quality_score >= 95 ? <CheckCircle size={16} className="text-ok-400" /> : <AlertTriangle size={16} className="text-warn-400" />}
                <span className={`font-bold ${t.quality_score >= 95 ? 'text-ok-400' : 'text-warn-400'}`}>{t.quality_score}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-2 text-center">
                <p className="text-slate-500 dark:text-slate-400">Rows</p>
                <p className="text-slate-900 dark:text-white font-bold">{t.row_count?.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-2 text-center">
                <p className="text-slate-500 dark:text-slate-400">Null%</p>
                <p className={`font-bold ${t.null_pct > 2 ? 'text-danger-400' : 'text-ok-400'}`}>{t.null_pct?.toFixed(2)}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-2 text-center">
                <p className="text-slate-500 dark:text-slate-400">Dupe%</p>
                <p className={`font-bold ${t.duplicate_pct > 1 ? 'text-warn-400' : 'text-ok-400'}`}>{t.duplicate_pct?.toFixed(2)}%</p>
              </div>
            </div>
            {t.issues?.length > 0 && (
              <div className="mt-3 space-y-1">
                {t.issues.map((issue, i) => (
                  <p key={i} className="text-xs text-warn-400 flex items-center gap-1">
                    <AlertTriangle size={11} />{issue}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
