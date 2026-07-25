import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clinical: {
          blue: "#1E5DAA",
          blueDark: "#123B70",
          gray: "#F4F6F8",
          border: "#E2E8F0",
        },
        triage: {
          emergency: "#DC2626", // red
          urgent: "#EA580C",    // orange
          moderate: "#CA8A04",  // yellow
          routine: "#16A34A",   // green
        },
      },
      borderRadius: {
        card: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
