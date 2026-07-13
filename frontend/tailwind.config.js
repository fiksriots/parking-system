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
        background: '#090a0f',
        card: '#121420',
        primary: '#10b981', // emerald-500
        secondary: '#f59e0b', // amber-500
        danger: '#ef4444', // red-500
      },
    },
  },
  plugins: [],
}
