/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // InsureNexus brand palette — deep navy + electric blue + accent gold
        nexus: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',  // primary
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        navy: {
          900: '#0a0f1e',
          800: '#0d1526',
          700: '#111b33',
          600: '#162040',
          500: '#1b2850',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: { 500: '#ef4444', 400: '#f87171' },
        warn:   { 500: '#f59e0b', 400: '#fbbf24' },
        ok:     { 500: '#10b981', 400: '#34d399' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-nexus': 'linear-gradient(135deg, #1e1b4b 0%, #0a0f1e 50%, #162040 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(79,70,229,0.05) 100%)',
        'gradient-alert': 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
      },
      boxShadow: {
        'nexus': '0 4px 24px rgba(99,102,241,0.25)',
        'card': '0 2px 16px rgba(0,0,0,0.4)',
        'glow': '0 0 20px rgba(99,102,241,0.4)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'count-up': 'countUp 0.8s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(99,102,241,0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(99,102,241,0.7)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
