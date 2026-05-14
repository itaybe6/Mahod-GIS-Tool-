import type { Config } from 'tailwindcss';
import tailwindcssRtl from 'tailwindcss-rtl';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#07090f',
          1: '#0a0e1a',
          2: '#0d1117',
        },
        surface: {
          DEFAULT: '#111827',
          2: '#161f31',
        },
        border: {
          DEFAULT: '#1f2937',
          2: '#2b3648',
        },
        text: {
          DEFAULT: '#f9fafb',
          dim: '#9ca3af',
          faint: '#6b7280',
        },
        brand: {
          /** Primary accent — teal-green */
          teal: '#2eaa6f',
          /** Lighter companion for gradients / glows */
          teal2: '#4fd6a0',
          /** Blue anchor of the gradient */
          blue: '#1a6fb5',
          green: '#2eaa6f',
        },
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        purple: '#8b5cf6',
      },
      fontFamily: {
        sans: ['Rubik', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        glow: '0 0 0 1px rgba(26, 111, 181, 0.35), 0 8px 28px rgba(46, 170, 111, 0.18)',
      },
      keyframes: {
        loader: {
          '0%': { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '-100% 0' },
        },
        pulse2: {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        markerPulse: {
          '0%': { transform: 'scale(0.6)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        fadein: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        loader: 'loader 2.4s linear infinite',
        'pulse-dot': 'pulse2 2s ease-out infinite',
        'marker-pulse': 'markerPulse 2.4s ease-out infinite',
        fadein: 'fadein 0.6s ease-out both',
      },
    },
  },
  plugins: [tailwindcssRtl],
};

export default config;
