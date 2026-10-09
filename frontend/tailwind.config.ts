import type { Config } from "tailwindcss";

// Palette: cool grey paper, deep ink, one green accent. Score bands get their own hues
// so "hot" reads as hot at a glance in later sprints.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F1F3F6",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#18232B", soft: "#4B5A66", faint: "#7A8894" },
        line: "#D9DEE4",
        accent: { DEFAULT: "#0E7C66", dark: "#0A5F4E", wash: "#E3F2EE" },
        band: { hot: "#C2412D", high: "#D98A00", medium: "#2F7FB8", low: "#8A96A0" },
        warn: "#B45309",
        danger: "#B42318",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
