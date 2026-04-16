/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        'xl': '1rem',
      },
      scale: {
        '105': '1.05',
      }
    },
  },
  plugins: [],
}
