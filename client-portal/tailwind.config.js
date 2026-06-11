export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary:   "#4F46E5",   // Indigo — Zolvit-style
        primaryD:  "#3730A3",   // Darker indigo for hover
        accent:    "#7C3AED",   // Purple accent
        success:   "#10B981",
        warning:   "#F59E0B",
        danger:    "#EF4444",
        surface:   "#F5F7FF",   // Very light purple-tinted background
        card:      "#FFFFFF",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        card:  "0 2px 15px -3px rgba(79,70,229,0.07), 0 10px 20px -2px rgba(79,70,229,0.04)",
        hover: "0 8px 30px -4px rgba(79,70,229,0.15), 0 20px 40px -4px rgba(79,70,229,0.08)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
        "gradient-soft":    "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)",
        "gradient-card":    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
    },
  },
  plugins: [],
}
