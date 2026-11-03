/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'rgb(var(--bg-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
          tertiary: 'rgb(var(--bg-tertiary-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
          hover: 'rgb(var(--bg-hover-rgb) / <alpha-value>)',
          active: 'rgb(var(--bg-active-rgb) / <alpha-value>)',
          selected: 'rgb(var(--bg-selected-rgb) / <alpha-value>)',
        },
        'bg-elevated': 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
        'bg-hover': 'rgb(var(--bg-hover-rgb) / <alpha-value>)',
        fg: {
          DEFAULT: 'rgb(var(--fg-primary-rgb) / <alpha-value>)',
          primary: 'rgb(var(--fg-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary-rgb) / <alpha-value>)',
          tertiary: 'rgb(var(--fg-tertiary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--fg-tertiary-rgb) / <alpha-value>)',
          inverse: 'var(--fg-inverse)',
          disabled: 'var(--fg-disabled)',
        },
        brand: {
          primary: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
          'primary-hover': 'rgb(var(--brand-primary-hover-rgb) / <alpha-value>)',
          'primary-active': 'rgb(var(--brand-primary-active-rgb) / <alpha-value>)',
          secondary: 'var(--brand-secondary)',
          tertiary: 'var(--brand-tertiary)',
        },
        accent: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
        'accent-hover': 'rgb(var(--brand-primary-hover-rgb) / <alpha-value>)',
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          emphasis: 'var(--border-emphasis)',
          brand: 'var(--border-brand)',
          focus: 'var(--border-focus)',
          error: 'var(--border-error)',
          success: 'var(--border-success)',
        },
        player: {
          bg: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
          border: 'var(--player-border)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          border: 'var(--sidebar-border)',
          hover: 'var(--sidebar-item-hover-bg)',
        },
        card: 'var(--card-bg)',
      },
      fontFamily: { 
        sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] 
      },
      animation: { 
        'fade-in': 'fadeIn 0.2s ease-out', 'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite' 
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } }
      }
    }
  },
  plugins: []
}