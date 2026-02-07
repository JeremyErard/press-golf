import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        background: "var(--bg-primary)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        card: "var(--bg-card)",

        // Brand
        brand: {
          DEFAULT: "var(--brand-primary)",
          dark: "var(--brand-primary-dark)",
        },
        accent: {
          DEFAULT: "var(--brand-accent)",
          light: "var(--brand-accent-light)",
        },

        // Text
        foreground: "var(--text-primary)",
        muted: "var(--text-secondary)",
        subtle: "var(--text-tertiary)",

        // Functional
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
        info: "var(--info)",

        // Borders
        border: "var(--border-default)",
        "border-subtle": "var(--border-subtle)",
      },
      fontSize: {
        hero: ["3rem", { lineHeight: "1", fontWeight: "800" }],
        score: ["2.25rem", { lineHeight: "1", fontWeight: "700" }],
        h1: ["1.75rem", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["1.0625rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["0.875rem", { lineHeight: "1.4", fontWeight: "400" }],
        label: ["0.75rem", { lineHeight: "1.3", fontWeight: "500" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
