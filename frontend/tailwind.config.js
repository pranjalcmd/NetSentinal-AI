/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        edge: "#1E3A5F",
        bg: "#0A1428",
        "brand-blue": "#3B82F6",
        "brand-purple": "#8B5CF6",
        "risk-high": "#EF4444",
        "risk-medium": "#F59E0B",
        "risk-low": "#10B981"
      }
    }
  },
  plugins: []
}