/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme colors
        'bg-primary': '#1e1e2e',
        'bg-secondary': '#181825',
        'bg-tertiary': '#11111b',
        'bg-hover': '#313244',
        'bg-selected': '#45475a',
        'text-primary': '#cdd6f4',
        'text-secondary': '#a6adc8',
        'text-muted': '#6c7086',
        'border-primary': '#313244',
        'accent-blue': '#89b4fa',
        'accent-green': '#a6e3a1',
        'accent-red': '#f38ba8',
        'accent-yellow': '#f9e2af',
        'accent-purple': '#cba6f7',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
