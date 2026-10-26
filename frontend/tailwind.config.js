/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vyora: {
          bg: '#050505',
          bgSecondary: '#0A0A0A',
          elevated: '#111111',
          card: '#151515',
          border: '#27272A',
          primary: '#FAFAFA',
          secondary: '#A1A1AA',
          muted: '#71717A',
          silver: '#D4D4D8',
          violet: '#8B5CF6',
          white: '#EDEDED',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
