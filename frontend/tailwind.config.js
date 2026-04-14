/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f4f7fb",
          100: "#e8eef6",
          200: "#ccd9ea",
          300: "#9fb6d4",
          400: "#6b8cb8",
          500: "#4a6fa0",
          600: "#3a5885",
          700: "#31486c",
          800: "#2c3f5a",
          900: "#1e2d44",
          950: "#0f1729",
        },
        accent: {
          DEFAULT: "#4f7cac",
          hover: "#3d6694",
        },
        gold: {
          DEFAULT: "#c9a227",
          muted: "#b08d1e",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
        "card-lg":
          "0 10px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};
