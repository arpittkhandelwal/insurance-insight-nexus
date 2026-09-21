/**Model Monitoring page*/
import { useQuery } from '@tanstack/react-query'
import { Bot, CheckCircle } from 'lucide-react'
import { fetchModelCards } from '../services/api'

export default function ModelMonitorPage() {
  const { data: models = [] } = useQuery({ queryKey: ['model-cards'], queryFn: fetchModelCards })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3"><Bot className="text-nexus-400" />Model Monitoring</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Model cards · Performance · Fairness · Drift detection</p>
        </div>
      </div>
      <div className="space-y-4">
        {models.map((m) => (
          <div key={m.model_id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-slate-900 dark:text-white font-semibold">{m.model_name}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{m.algorithm} · v{m.version} · Trained {m.training_date}</p>
              </div>
              {m.fairness_checked && (
                <div className="badge badge-ok"><CheckCircle size={12} />Fairness Checked</div>
              )}
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">{m.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[['AUC-ROC', m.auc_roc], ['Precision', m.precision], ['Recall', m.recall], ['F1', m.f1], ['Training Samples', m.training_samples?.toLocaleString('en-IN')]].map(([label, val]) => (
                <div key={label} className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">{label}</p>
                  <p className="text-slate-900 dark:text-white font-bold">{typeof val === 'number' && val < 2 ? (val * 100).toFixed(1) + '%' : val}</p>
                </div>
              ))}
            </div>
            {m.protected_attributes_excluded?.length > 0 && (
              <div className="mt-3 p-2 bg-ok-500/5 border border-ok-500/20 rounded-xl text-xs text-ok-400">
                ✓ Protected attributes excluded from model: {m.protected_attributes_excluded.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
