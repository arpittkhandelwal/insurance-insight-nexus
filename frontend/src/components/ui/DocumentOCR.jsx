import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, UploadCloud, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

export default function DocumentOCR() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  const handleUpload = (e) => {
    const selected = e.target.files[0]
    if (!selected) return
    setFile(selected)
    setUploading(true)

    // Simulate OCR processing via Vision Model
    setTimeout(() => {
      setResult({
        docType: 'Hospital Bill - Inpatient',
        provider: 'HSP0002 - City Care Network',
        totalAmount: '₹2,45,000',
        anomalies: [
          'Room rent (₹12,000/day) exceeds policy sub-limit (₹5,000/day)',
          'Pharmacy consumables billed at 300% above market rate',
          'Consultation dates overlap with patient ICU stay dates'
        ],
        recommendation: 'Reject ₹45,000 overhead and send to desk audit.'
      })
      setUploading(false)
    }, 2500)
  }

  return (
    <div className="card mb-6 border-nexus-500/30">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={18} className="text-nexus-500" />
        <h3 className="text-slate-900 dark:text-white font-semibold">Document Analysis (Vision OCR)</h3>
      </div>
      
      {!result && !uploading && (
        <label className="border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-nexus-500/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-navy-900/50">
          <UploadCloud size={32} className="text-slate-400 mb-3" />
          <p className="text-sm text-slate-900 dark:text-white font-medium">Click to upload hospital bill or police report (PDF/JPG)</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Vision models will automatically extract anomalies.</p>
          <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={handleUpload} />
        </label>
      )}

      {uploading && (
        <div className="p-8 flex flex-col items-center justify-center">
          <Loader2 size={32} className="text-nexus-500 animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Analyzing document structure & extracting text...</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cross-referencing with policy limits and historical peer billing.</p>
        </div>
      )}

      {result && !uploading && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="flex items-center gap-3 bg-ok-50 dark:bg-ok-500/10 border border-ok-200 dark:border-ok-500/30 text-ok-700 dark:text-ok-400 p-3 rounded-xl">
              <CheckCircle2 size={18} />
              <div className="text-sm font-medium">Successfully processed {file?.name || 'document.pdf'}</div>
              <button onClick={() => { setResult(null); setFile(null) }} className="ml-auto text-xs font-semibold underline">Upload Another</button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-slate-50 dark:bg-navy-800 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400 text-xs block mb-1">Document Type</span>
                <strong className="text-slate-900 dark:text-white">{result.docType}</strong>
              </div>
              <div className="bg-slate-50 dark:bg-navy-800 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400 text-xs block mb-1">Provider Extracted</span>
                <strong className="text-slate-900 dark:text-white">{result.provider}</strong>
              </div>
              <div className="bg-slate-50 dark:bg-navy-800 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                <span className="text-slate-500 dark:text-slate-400 text-xs block mb-1">Total Claim Amount</span>
                <strong className="text-slate-900 dark:text-white">{result.totalAmount}</strong>
              </div>
            </div>

            <div className="bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/30 p-4 rounded-xl">
              <h4 className="flex items-center gap-2 text-danger-700 dark:text-danger-400 font-semibold mb-2">
                <AlertTriangle size={16} /> Discrepancies Found
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-200 mb-3">
                {result.anomalies.map((anom, i) => (
                  <li key={i}>{anom}</li>
                ))}
              </ul>
              <div className="pt-3 border-t border-danger-200 dark:border-danger-500/20 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">AI Action: {result.recommendation}</span>
                <button className="btn-danger text-xs py-1">Attach to Case File</button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
