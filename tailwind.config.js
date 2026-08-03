/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red:    '#EE1945',
          redark: '#B80F32',
          gold:   '#FFAA00',
          bg:     '#0A0A0C',
          muted:  '#CBD5E1',
        },
      },
    },
  },
  plugins: [],
}
