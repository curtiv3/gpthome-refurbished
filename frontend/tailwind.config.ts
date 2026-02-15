import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Inter", "Arial", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      animation: {
        drift: "drift 100s linear infinite",
      },
      keyframes: {
        drift: {
          "0%": { transform: "translate3d(0,0,0)" },
          "100%": { transform: "translate3d(-40px, 20px, 0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
