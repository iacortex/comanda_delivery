/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-fast': 'pulse 1s ease-in-out infinite',
      },
      colors: {
        'sushi-red': '#dc2626',
        'sushi-orange': '#ea580c',
      }
    },
  },
  plugins: [],
}