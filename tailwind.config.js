/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        invicsa: {
          50:  '#f0f7fb',
          100: '#dceaf3',
          200: '#bdd6e8',
          300: '#8eb8d6',
          400: '#5891be',
          500: '#3974a4',
          600: '#2a5b88',
          700: '#244a6f',
          800: '#21405d',
          900: '#1f3750',
          950: '#142436'
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
}
