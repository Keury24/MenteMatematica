import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f1a",
          900: "#0f1524",
          800: "#161d31",
          700: "#1f2740",
          600: "#2b3554",
        },
        accent: {
          DEFAULT: "#22d3ee",
          soft: "#67e8f9",
        },
        hot: "#fb7185",
        cold: "#60a5fa",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
