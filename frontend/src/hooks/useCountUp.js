import { useState, useEffect, useRef } from 'react'

/**
 * useCountUp — animates a number from 0 to `end` over `duration` ms.
 * Uses requestAnimationFrame for smooth 60fps counting.
 */
export function useCountUp(end, duration = 1200, decimals = 0) {
  const [count, setCount] = useState(0)
  const rafRef = useRef(null)
  const startTimeRef = useRef(null)
  const startValRef = useRef(0)

  useEffect(() => {
    if (end == null || isNaN(end)) return
    startValRef.current = 0
    startTimeRef.current = null

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValRef.current + (end - startValRef.current) * eased
      setCount(parseFloat(current.toFixed(decimals)))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration, decimals])

  return count
}
