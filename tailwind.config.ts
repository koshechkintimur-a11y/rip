import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rip: {
          bg: '#0a0a0c',
          panel: '#121216',
          panel2: '#17171d',
          line: '#26262e',
          text: '#e8e8ea',
          dim: '#8b8b95',
          accent: '#e5e5e5',
          blood: '#ff2d40',
          warn: '#ffb020',
          green: '#3ddc84',
          gold: '#ffd166',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-hard': 'pulseHard 0.9s ease-in-out infinite',
        'marquee': 'marquee 22s linear infinite',
        'blink': 'blink 1.1s steps(2) infinite',
        'shake': 'shake 0.35s linear infinite',
      },
      keyframes: {
        pulseHard: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(1.035)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0.25' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-1px)' },
          '75%': { transform: 'translateX(1px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
