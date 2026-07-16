import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        "bento-bg": "var(--bg)",
        "bento-surface": "var(--surface)",
        "bento-surface-lighter": "var(--surface-lighter)",
        "bento-border": "var(--border)",
        "bento-accent": "var(--accent)",
        "bento-accent-muted": "var(--accent-muted)",
        "bento-success": "var(--success)",
        "bento-text-primary": "var(--text-primary)",
        "bento-text-secondary": "var(--text-secondary)",
      },
    },
  },
  plugins: [],
};

export default config;
