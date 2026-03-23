/**
 * FOUNDATION.template.config.js
 *
 * How to use this:
 * 1. Copy this file to your project root as `tailwind.config.js`
 * 2. Read your PRODUCT_STRATEGY.md
 * 3. Replace every [PLACEHOLDER] with your actual values from PRODUCT_STRATEGY
 * 4. Commit this to version control — it's now the source of truth for your design system
 * 5. Reference this in `ui-design-brain Step 2` (Foundation Setup)
 *
 * Key principle: Every value here comes from PRODUCT_STRATEGY.md. No ad-hoc changes per-page.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
  ],

  theme: {
    extend: {
      // ===== TYPOGRAPHY (from PRODUCT_STRATEGY) =====
      fontFamily: {
        // Display font: headlines, heroes, dramatic text
        // From PRODUCT_STRATEGY: "Display Font: [NAME]"
        display: [
          '[DISPLAY_FONT_NAME]',
          'serif', // or 'sans-serif' depending on font
          { fontVariationSettings: '"wght" 700' }, // Bold by default
        ],

        // Body font: all UI text, descriptions
        // From PRODUCT_STRATEGY: "Body Font: [NAME]"
        body: [
          '[BODY_FONT_NAME]',
          'sans-serif',
          { fontVariationSettings: '"wght" 400' },
        ],

        // Monospace: code, IDs, timestamps, data
        // From PRODUCT_STRATEGY: "Monospace Font: [NAME]"
        mono: [
          '[MONO_FONT_NAME]',
          'monospace',
        ],
      },

      fontSize: {
        // Scale: Use no more than 5–6 sizes in any single view
        // From PRODUCT_STRATEGY: "Type Scale"
        // Format: [size, { lineHeight, letterSpacing, fontWeight }]
        xs: ['11px', { lineHeight: '1.4', letterSpacing: '0' }],   // Captions, tiny labels
        sm: ['13px', { lineHeight: '1.5', letterSpacing: '0' }],   // Secondary text, meta
        base: ['15px', { lineHeight: '1.6', letterSpacing: '0' }], // Body text (default)
        lg: ['18px', { lineHeight: '1.4', letterSpacing: '0' }],   // Subheadings
        xl: ['24px', { lineHeight: '1.2', letterSpacing: '0' }],   // Section titles
        '2xl': ['32px', { lineHeight: '1.1', letterSpacing: '0' }],// Page titles
        hero: ['clamp(40px, 6vw, 72px)', { lineHeight: '1.05', fontFamily: 'display' }], // Hero headlines only
      },

      // ===== COLORS (from PRODUCT_STRATEGY) =====
      colors: {
        // Primary palette
        // From PRODUCT_STRATEGY: "Primary Colors"

        bg: {
          // Page background
          // From PRODUCT_STRATEGY Accent: "[HEX]"
          DEFAULT: '[BG_COLOR_HEX]',
          dark: '[BG_COLOR_DARK_HEX]', // If dark mode supported
        },

        surface: {
          // Cards, modals, lifted surfaces
          // From PRODUCT_STRATEGY: "Surface: [HEX]"
          DEFAULT: '[SURFACE_COLOR_HEX]',
          dark: '[SURFACE_COLOR_DARK_HEX]',
        },

        text: {
          // Primary text
          // From PRODUCT_STRATEGY: "Text/Primary: [HEX]"
          primary: '[TEXT_PRIMARY_HEX]',
          // Secondary/muted text
          // From PRODUCT_STRATEGY: "Text/Muted: [HEX]"
          muted: '[TEXT_MUTED_HEX]',
          dark: '[TEXT_DARK_HEX]',
        },

        border: {
          // Dividers, input borders, structure
          // From PRODUCT_STRATEGY: "Border: [HEX]"
          DEFAULT: '[BORDER_COLOR_HEX]',
          dark: '[BORDER_COLOR_DARK_HEX]',
        },

        // Action color: The ONE strong accent for buttons, highlights, CTAs
        // From PRODUCT_STRATEGY: "Accent: [HEX]"
        accent: '[ACCENT_COLOR_HEX]',
        'accent-dark': '[ACCENT_COLOR_DARK_HEX]',

        // Semantic colors (status feedback)
        // From PRODUCT_STRATEGY: "Semantic Colors"
        success: {
          DEFAULT: '[SUCCESS_COLOR_HEX]',
          light: '[SUCCESS_LIGHT_HEX]', // for backgrounds
          dark: '[SUCCESS_DARK_HEX]',
        },

        warning: {
          DEFAULT: '[WARNING_COLOR_HEX]',
          light: '[WARNING_LIGHT_HEX]',
          dark: '[WARNING_DARK_HEX]',
        },

        error: {
          DEFAULT: '[ERROR_COLOR_HEX]',
          light: '[ERROR_LIGHT_HEX]',
          dark: '[ERROR_DARK_HEX]',
        },

        info: {
          DEFAULT: '[INFO_COLOR_HEX]',
          light: '[INFO_LIGHT_HEX]',
          dark: '[INFO_DARK_HEX]',
        },

        // Neutral grays (if using a gray scale)
        gray: {
          50: '[GRAY_50_HEX]',
          100: '[GRAY_100_HEX]',
          200: '[GRAY_200_HEX]',
          300: '[GRAY_300_HEX]',
          400: '[GRAY_400_HEX]',
          500: '[GRAY_500_HEX]',
          600: '[GRAY_600_HEX]',
          700: '[GRAY_700_HEX]',
          800: '[GRAY_800_HEX]',
          900: '[GRAY_900_HEX]',
        },
      },

      // ===== SPACING (from PRODUCT_STRATEGY motion language) =====
      spacing: {
        // Gap between icon and label, badge internal padding
        xs: '4px',
        // Tight group spacing, compact UI density
        sm: '8px',
        // Standard gap between related items
        md: '16px',
        // Gap between sections within a component
        lg: '24px',
        // Gap between major page sections
        xl: '32px',
        // Hero internal padding, section top margin
        '2xl': '48px',
        // Full section separation on desktop
        '3xl': '64px',
      },

      // ===== SHADOWS (Subtle, minimal) =====
      boxShadow: {
        // No shadow — flat design
        none: 'none',
        // Subtle shadow for slightly lifted elements
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        // Card shadow
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        // Elevated shadow
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        // Modal/drawer shadow
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },

      // ===== ANIMATION & EASING (from PRODUCT_STRATEGY motion language) =====
      animation: {
        // Entrance motion: appears at specified opacity/scale
        // From PRODUCT_STRATEGY: "Entrance Moments"
        'fade-in': 'fadeIn [ENTRANCE_DURATION] [ENTRANCE_EASING]',
        'scale-in': 'scaleIn [ENTRANCE_DURATION] [ENTRANCE_EASING]',
        'slide-in': 'slideIn [ENTRANCE_DURATION] [ENTRANCE_EASING]',

        // Scroll-linked motion
        // From PRODUCT_STRATEGY: "Scroll-Linked Effects"
        'parallax': 'parallax 1s linear',

        // Hover and interaction feedback
        // From PRODUCT_STRATEGY: "Hover & Interaction"
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',

        // Loading state shimmer
        // From PRODUCT_STRATEGY: "State Feedback"
        'shimmer': 'shimmer 1.5s infinite',
      },

      keyframes: {
        // ENTRANCE: Scale + fade
        // Example: "starts at 0.95 scale, 0 opacity → full scale, full opacity"
        scaleIn: {
          '0%': {
            transform: 'scale(0.95)',
            opacity: '0',
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1',
          },
        },

        // ENTRANCE: Fade only
        fadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },

        // ENTRANCE: Slide from side
        slideIn: {
          '0%': {
            transform: 'translateY(8px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },

        // SCROLL-LINKED: Parallax depth effect
        parallax: {
          '0%': {
            transform: 'translateY(0)',
          },
          '100%': {
            transform: 'translateY(-50px)',
          },
        },

        // HOVER/INTERACTION: Subtle pulse for focus
        pulseSubtle: {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.8',
          },
        },

        // LOADING: Shimmer sweep
        shimmer: {
          '0%': {
            backgroundPosition: '-1000px 0',
          },
          '100%': {
            backgroundPosition: '1000px 0',
          },
        },
      },

      transitionDuration: {
        // From PRODUCT_STRATEGY: Motion Language timing
        // Fast: hover color changes
        // From PRODUCT_STRATEGY: "[MOTION_TIMING]"
        'fast': '[FAST_DURATION_MS]ms',
        // Base: most state transitions
        'base': '[BASE_DURATION_MS]ms',
        // Slow: modals, drawers, page transitions
        'slow': '[SLOW_DURATION_MS]ms',
      },

      transitionTimingFunction: {
        // From PRODUCT_STRATEGY: Motion Language easing
        'standard': 'cubic-bezier(0.4, 0, 0.2, 1)',      // Default movement
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',        // Elements entering
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',         // Elements exiting
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',   // Elastic/bounce
      },

      // ===== BORDER RADIUS (minimal, clean) =====
      borderRadius: {
        'none': '0',
        'sm': '2px',
        'md': '4px',
        'lg': '8px',
        'xl': '12px',
        'full': '9999px', // Fully round (pills, avatars)
      },

      // ===== OTHER UTILITIES =====
      maxWidth: {
        // Content max-width for readability
        prose: '65ch', // ~65 characters, optimal for reading
      },

      screens: {
        // Mobile-first breakpoints
        'sm': '640px',  // Mobile landscape
        'md': '768px',  // Tablet
        'lg': '1024px', // Desktop
        'xl': '1280px', // Wide desktop
        '2xl': '1536px', // Ultra-wide
      },

      // Opacity scale for more granular control
      opacity: {
        0: '0',
        5: '0.05',
        10: '0.1',
        20: '0.2',
        30: '0.3',
        40: '0.4',
        50: '0.5',
        60: '0.6',
        70: '0.7',
        80: '0.8',
        90: '0.9',
        95: '0.95',
        100: '1',
      },
    },
  },

  plugins: [
    // Add plugins for additional utilities if needed
    // Example: require('@tailwindcss/forms') for form styling
  ],

  // Dark mode configuration
  // From PRODUCT_STRATEGY: "Dark Mode"
  darkMode: 'class', // or 'media' if following system preference
};

/**
 * CONSTRAINT ENFORCEMENT
 *
 * These rules ensure consistency across all pages:
 *
 * ✅ DO:
 * - Use colors, spacing, and animation values from this file
 * - Extend theme values from here, never hardcode hex/px
 * - Reference this file when building components
 * - Test all values on real devices (motion, contrast, spacing)
 *
 * ❌ DON'T:
 * - Hardcode colors in CSS/JSX (always use theme variables)
 * - Add arbitrary spacing like "w-[237px]" (use defined scale)
 * - Invent new animations outside PRODUCT_STRATEGY motion language
 * - Override this config per-page or per-component
 * - Change timings without updating PRODUCT_STRATEGY
 *
 * If you need a new value (color, spacing, animation):
 * 1. Check if it exists in the PRODUCT_STRATEGY
 * 2. If it should exist, add it here with a comment referencing the strategy
 * 3. Never make the same value change twice (update here, everywhere benefits)
 */
