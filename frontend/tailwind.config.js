/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        archive: {
          fog: '#F0F4F5',
          ink: '#182A3C',
          teal: '#34786F',
          blue: '#557A9E',
          'blue-light': '#A7C5E0',
          mint: '#C7EDE6',
          canvas: '#0F1728',
          surface: '#161F31',
          raised: '#202C40',
          border: '#2F3C51',
          brass: '#D0A142'
        },
        blue: {
          50: '#F0F5F9',
          100: '#E0EAF2',
          200: '#C7D8E7',
          300: '#ABC3D9',
          400: '#8EACC8',
          500: '#6E91B2',
          600: '#557A9E',
          700: '#466886',
          800: '#38546D',
          900: '#2A4055',
          950: '#1B2D40'
        }
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', 'sans-serif']
      }
    },
  },
  plugins: [],
}
