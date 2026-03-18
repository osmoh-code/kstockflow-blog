import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#1c1c1e",
          accent: "#DC2626",
          "accent-hover": "#B91C1C",
          "accent-light": "#FEE2E2",
          muted: "#6b7280",
          bg: "#f9fafb",
          "bg-dark": "#111827",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            color: "#374151",
            lineHeight: "1.8",
            fontSize: "1.0625rem",
            h1: {
              color: "#1c1c1e",
              fontWeight: "800",
              fontSize: "2rem",
              marginBottom: "1rem",
            },
            h2: {
              color: "#1c1c1e",
              fontWeight: "700",
              fontSize: "1.5rem",
              marginTop: "2rem",
              marginBottom: "0.75rem",
            },
            h3: {
              color: "#1c1c1e",
              fontWeight: "600",
              fontSize: "1.25rem",
              marginTop: "1.5rem",
              marginBottom: "0.5rem",
            },
            a: {
              color: "#DC2626",
              textDecoration: "underline",
              "&:hover": {
                color: "#B91C1C",
              },
            },
            blockquote: {
              borderLeftColor: "#DC2626",
              backgroundColor: "#f0f9ff",
              padding: "1rem 1.5rem",
              borderRadius: "0.25rem",
            },
            code: {
              backgroundColor: "#f3f4f6",
              padding: "0.125rem 0.375rem",
              borderRadius: "0.25rem",
              fontSize: "0.875em",
            },
            "code::before": {
              content: "none",
            },
            "code::after": {
              content: "none",
            },
            img: {
              borderRadius: "0.5rem",
            },
            strong: {
              color: "#1c1c1e",
            },
          },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;
