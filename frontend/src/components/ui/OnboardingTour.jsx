/**
 * OnboardingTour — driver.js powered auto-walkthrough for judges/new users.
 * Auto-starts on first visit, can be re-triggered from any page.
 */
import { useEffect } from 'react'

export function startTour() {
  import('driver.js').then(({ driver }) => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(15, 23, 42, 0.85)',
      popoverClass: 'nexus-tour-popover',
      steps: [
        {
          element: '[data-tour="command-center"]',
          popover: {
            title: '🚀 Executive Command Center',
            description: 'Real-time portfolio intelligence. Every KPI animates from zero on load and updates live as claims stream in.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="kpi-grid"]',
          popover: {
            title: '📊 Animated KPI Tiles',
            description: 'Nine core metrics with sparklines. Watch the numbers roll up in real time! Red = bad trend, green = improving.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="live-stream"]',
          popover: {
            title: '⚡ Live Claims Stream',
            description: 'Claims arriving in real time. New Motor/Health/Crop claims appear every 3 seconds with fraud alerts triggering automatically.',
            side: 'top',
          },
        },
        {
          element: '[data-tour="map-globe"]',
          popover: {
            title: '🌏 India Risk Intelligence',
            description: 'Toggle between the flat heatmap and a full 3D globe with glowing arc hotspots. Use Compare Mode to put two states head-to-head.',
            side: 'top',
          },
        },
        {
          element: '[data-tour="nav-fraud"]',
          popover: {
            title: '🔍 Fraud Risk Center',
            description: 'An animated D3 force-directed network graph revealing fraud rings. Nodes pulse red when fraud score crosses threshold.',
            side: 'right',
          },
        },
        {
          element: '[data-tour="nav-ask"]',
          popover: {
            title: '🧠 Ask Nexus (AI Engine)',
            description: 'Ask anything in natural language — or use your voice in Hindi/English via Sarvam AI. Get inline charts as answers.',
            side: 'right',
          },
        },
        {
          element: '[data-tour="nav-simulate"]',
          popover: {
            title: '🎮 Scenario Simulator',
            description: 'Adjust sliders for claim amount, inception lag, and provider deviation to watch the Fraud Risk Score recalculate live.',
            side: 'right',
          },
        },
        {
          element: '[data-tour="nav-anomaly"]',
          popover: {
            title: '⏱️ Anomaly Replay Timeline',
            description: 'Scrub through 24 months of data to watch fraud patterns evolve. Hit Play to see the animated time-lapse.',
            side: 'right',
          },
        },
        {
          element: '[data-tour="nav-briefing"]',
          popover: {
            title: '📄 Executive Briefing',
            description: 'One-click AI narrative generation + PDF export. Perfect for board meetings and regulatory reporting.',
            side: 'right',
          },
        },
        {
          element: '[data-tour="cmd-k"]',
          popover: {
            title: '⌘K — Command Palette',
            description: 'Press Cmd+K (or Ctrl+K) to instantly navigate anywhere, trigger AI queries, or switch modes. Like Vercel/Linear.',
            side: 'bottom',
          },
        },
      ],
    })
    driverObj.drive()
  })
}

export default function OnboardingTour() {
  useEffect(() => {
    const seen = localStorage.getItem('nexus_tour_seen')
    if (!seen) {
      localStorage.setItem('nexus_tour_seen', '1')
      setTimeout(() => startTour(), 1500)
    }
  }, [])

  return null
}
