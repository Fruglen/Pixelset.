import type { Config } from "tailwindcss";

// Design upgrade: warm stone-leaning neutrals replace the cool grays (the
// whole `neutral` scale is remapped to Tailwind's stone values, so every
// existing neutral-* class warms up without touching components), Pixora
// teal (#1abc9c family) is the product accent, and the type stack is the
// self-hosted Nunito Sans (product sans) + EB Garamond (display serif).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1917",
        paper: "#faf9f7",
        accent: "#8a7357",
        neutral: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
          950: "#0c0a09",
        },
        brand: {
          50: "#e9fbf5",
          100: "#d1f7ea",
          200: "#a6efdb",
          300: "#6fe0c4",
          400: "#38c9a8",
          500: "#1abc9c",
          600: "#12a37f",
          700: "#12876b",
          800: "#136c57",
          900: "#125847",
          950: "#042f27",
        },
      },
      fontFamily: {
        sans: ["'Nunito Sans'", "'Segoe UI'", "system-ui", "sans-serif"],
        display: ["'EB Garamond'", "Georgia", "serif"],
        serif: ["'EB Garamond'", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,25,23,0.05), 0 10px 30px -12px rgba(28,25,23,0.14)",
        lift: "0 2px 4px rgba(28,25,23,0.06), 0 16px 40px -12px rgba(28,25,23,0.2)",
      },
    },
  },
  plugins: [],
};
export default config;
