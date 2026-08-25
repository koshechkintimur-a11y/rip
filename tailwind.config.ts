import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rip: {
          // пепельный графит (концепт 2031): чуть теплее и глубже, чем чистый чёрный
          bg: '#0b0b0d',
          panel: '#15151a',
          panel2: '#1b1b21',
          line: '#24242b',
          text: '#ececea',
          dim: '#9a9aa3',
          faint: '#5c5c66',
          accent: '#e5e5e5',
          // ржавчина — тёплый акцент «закат, а не траур»
          rust: '#d97f4f',
          // костяной — тёплый пепельно-белый для заголовков/имён
          bone: '#d6d2c6',
          blood: '#ff2d40',
          warn: '#ffb020',
          green: '#3ddc84',
          gold: '#d9b45c',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
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
