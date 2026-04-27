import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a5f',
        },
        signal: {
          strong: '#22c55e',
          moderate: '#eab308',
          weak: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};

export default config;
