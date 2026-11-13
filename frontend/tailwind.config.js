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
          fog: '#EEF3F7',
          ink: '#162B36',
          teal: '#167C80',
          blue: '#536DDB',
          brass: '#D0A142'
        }
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', 'sans-serif']
      }
    },
  },
  plugins: [],
}
