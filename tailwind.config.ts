import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      spacing: {
        "ui-1": "var(--space-1)",
        "ui-2": "var(--space-2)",
        "ui-3": "var(--space-3)",
        "ui-4": "var(--space-4)",
        "ui-5": "var(--space-5)",
        "ui-6": "var(--space-6)",
        "ui-8": "var(--space-8)",
        "icon-xs": "var(--icon-xs)",
        "icon-sm": "var(--icon-sm)",
        "icon-md": "var(--icon-md)",
        "icon-lg": "var(--icon-lg)",
        "icon-xl": "var(--icon-xl)",
        widget: "var(--widget-size)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        ui: "var(--radius-md)",
        "ui-sm": "var(--radius-sm)",
        "ui-md": "var(--radius-md)",
        "ui-lg": "var(--radius-lg)",
        "ui-full": "9999px",
      },
      fontSize: {
        display: ["var(--type-display-size)", { lineHeight: "var(--type-display-leading)", letterSpacing: "var(--type-display-tracking)" }],
        heading: ["var(--type-heading-size)", { lineHeight: "var(--type-heading-leading)", letterSpacing: "var(--type-heading-tracking)" }],
        subheading: ["var(--type-subheading-size)", { lineHeight: "var(--type-subheading-leading)", letterSpacing: "var(--type-subheading-tracking)" }],
        body: ["var(--type-body-size)", { lineHeight: "var(--type-body-leading)", letterSpacing: "var(--type-body-tracking)" }],
        label: ["var(--type-label-size)", { lineHeight: "var(--type-label-leading)", letterSpacing: "var(--type-label-tracking)" }],
        caption: ["var(--type-caption-size)", { lineHeight: "var(--type-caption-leading)", letterSpacing: "var(--type-caption-tracking)" }],
        kpi: ["var(--type-kpi-size)", { lineHeight: "var(--type-kpi-leading)", letterSpacing: "var(--type-kpi-tracking)" }],
        "ui-xs": ["var(--type-caption-size)", { lineHeight: "var(--type-caption-leading)" }],
        "ui-sm": ["var(--type-body-size)", { lineHeight: "var(--type-body-leading)" }],
        "ui-base": ["var(--type-body-size)", { lineHeight: "var(--type-body-leading)" }],
        "ui-lg": ["var(--type-subheading-size)", { lineHeight: "var(--type-subheading-leading)" }],
        "ui-xl": ["var(--type-heading-size)", { lineHeight: "var(--type-heading-leading)" }],
      },
      fontWeight: {
        display: "var(--type-display-weight)",
        heading: "var(--type-heading-weight)",
        subheading: "var(--type-subheading-weight)",
        body: "var(--type-body-weight)",
        label: "var(--type-label-weight)",
        caption: "var(--type-caption-weight)",
        kpi: "var(--type-kpi-weight)",
      },
      zIndex: {
        "floating-widget": "var(--z-floating-widget)",
        "floating-panel": "var(--z-floating-panel)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
