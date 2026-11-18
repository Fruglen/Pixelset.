import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        paper: "#fafaf8",
        accent: "#8a7357",
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
