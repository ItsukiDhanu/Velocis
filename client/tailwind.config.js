/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0d1117",
          900: "#161b22",
          800: "#21262d",
          700: "#30363d",
          600: "#484f58"
        },
        snow: "#c9d1d9",
        mist: "#8b949e",
        accent: "#2f81f7",
        accentStrong: "#1f6feb",
        success: "#3fb950",
        warning: "#d29922",
        danger: "#f85149"
      },
      boxShadow: {
        subtle: "0 0 0 1px rgba(48, 54, 61, 0.8)",
        lift: "0 8px 24px rgba(1, 4, 9, 0.6)"
      }
    }
  },
  plugins: []
};
