import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Bot, Loader2 } from 'lucide-react'

export default function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your AI Copilot. I can help analyze whatever you are currently looking at on the screen.' }
  ])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userQuery = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userQuery }])
    setLoading(true)

    // Mock copilot response taking page context into account
    setTimeout(() => {
      let reply = "Based on what I can see, here is my analysis..."
      const path = window.location.pathname
      if (path.includes('claims')) reply = "Looking at the claims table, I notice a 15% discrepancy in hospital billing averages compared to peers."
      if (path.includes('policies')) reply = "For this policy portfolio, the loss ratio is heavily skewed by the Rajasthan crop segment."
      if (path.includes('fraud')) reply = "This fraud graph shows a tight cluster of 5 garages. I recommend flagging all linked claims for SIU immediately."
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setLoading(false)
    }, 1500)
  }

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        className="fixed bottom-6 right-6 w-14 h-14 bg-nexus-600 hover:bg-nexus-500 text-white rounded-full flex items-center justify-center shadow-lg z-50 transition-all hover:scale-105"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare size={24} />
      </motion.button>

      {/* Widget Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-80 sm:w-96 h-[500px] max-h-[calc(100vh-120px)] bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-nexus-600 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Bot size={18} />
                <span className="font-semibold text-sm">Copilot Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-navy-900/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-nexus-600 text-white rounded-br-sm' 
                      : 'bg-white dark:bg-navy-700 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-navy-700 border border-slate-200 dark:border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 size={14} className="text-nexus-500 animate-spin" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-3 bg-white dark:bg-navy-800 border-t border-slate-200 dark:border-white/10 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about this page..."
                className="flex-1 bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-nexus-500"
              />
              <button 
                type="submit" 
                disabled={loading || !input.trim()}
                className="bg-nexus-600 hover:bg-nexus-500 text-white p-2 rounded-xl disabled:opacity-50 flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
