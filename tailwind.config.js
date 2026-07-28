/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
  ],

  theme: {
    extend: {
      colors: {
        tayebOrange: "#EA580C",
        tayebYellow: "#FACC15",
        tayebDark: "#0B0F17",
        tayebBg: "#F8FAFC",
      },
    },
  },

  plugins: [],
};