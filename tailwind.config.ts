import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark control-room palette
        surface: {
          DEFAULT: "#0d1117",
          raised: "#161b22",
          overlay: "#1c2230",
        },
        accent: {
          DEFAULT: "#3b82f6",
          glow: "#60a5fa",
        },
        deal: "#22c55e",
        peak: "#f97316",
        offpeak: "#3b82f6",
        shoulder: "#eab308",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
