/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Light Mode Colors
        'bg-primary': '#FFFFFF',
        'bg-secondary': '#F8F9FB',
        'surface': '#FFFFFF',
        'surface-secondary': '#F1F3F6',
        'surface-tertiary': '#EDF0F3',
        
        // Brand Colors
        'primary': '#2563EB',
        'primary-hover': '#1D4ED8',
        'primary-light': '#E0E7FF',
        'primary-dark': '#1E40AF',
        
        // Text Colors
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        'text-tertiary': '#9CA3AF',
        'text-disabled': '#D1D5DB',
        
        // Border Colors
        'border': '#E5E7EB',
        'border-secondary': '#F3F4F6',
        'border-focus': '#2563EB',
        
        // Status Colors
        'success': '#059669',
        'success-light': '#D1FAE5',
        'error': '#DC2626',
        'error-light': '#FEE2E2',
        'warning': '#D97706',
        'warning-light': '#FEF3C7',
        'info': '#2563EB',
        'info-light': '#E0E7FF',
        
        // Chat UI Colors
        'message-sent': '#E0E7FF',
        'message-received': '#F3F4F6',
        'message-system': '#FEF3C7',
      },
      
      fontSize: {
        'display': ['32px', '40px'],
        'h1': ['28px', '36px'],
        'h2': ['24px', '32px'],
        'h3': ['20px', '28px'],
        'h4': ['18px', '24px'],
        'body': ['16px', '24px'],
        'body-medium': ['16px', '24px'],
        'caption': ['14px', '20px'],
        'caption-medium': ['14px', '20px'],
        'label': ['12px', '16px'],
        'label-small': ['11px', '14px'],
        'chat-message': ['15px', '22px'],
        'chat-time': ['12px', '16px'],
      },
      
      fontWeight: {
        'regular': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
      },
      
      spacing: {
        '0': '0px',
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        
        // Semantic spacing
        'icon': '6px',
        'button-padding': '12px',
        'card-padding': '16px',
        'section-margin': '32px',
        'chat-input-height': '44px',
        'chat-message-padding': '12px',
        'chat-message-margin': '8px',
        'chat-timestamp-margin': '4px',
      },
      
      borderRadius: {
        'none': '0px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        'full': '9999px',
        
        // Semantic radius
        'button': '8px',
        'card': '12px',
        'input': '6px',
        'message': '16px',
        'avatar': '9999px',
      },
      
      fontFamily: {
        'system': ['System'],
      },
      
      letterSpacing: {
        'tight': '-0.5px',
        'snug': '-0.25px',
        'normal': '0px',
        'wide': '0.25px',
        'wider': '0.5px',
      },
      
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'medium': '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
        'heavy': '0 4px 16px 0 rgba(0, 0, 0, 0.15)',
      },
      
      animation: {
        'button-press': 'buttonPress 150ms ease-out',
        'modal-slide': 'modalSlide 300ms ease-out',
        'message-enter': 'messageEnter 250ms ease-out',
        'loading-spin': 'loadingSpin 1000ms linear infinite',
      },
      
      keyframes: {
        buttonPress: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        modalSlide: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        messageEnter: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        loadingSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      
      // Dark Mode Support (for React Native)
      darkMode: 'class',
    },
  },
  plugins: [
    // Disable plugins that don't work with React Native
  ],
  corePlugins: {
    // Disable core plugins that don't work with React Native
    appearance: false,
    fontVariantNumeric: false,
    listStyleType: false,
    resize: false,
    userSelect: false,
    visibility: false,
  },
}
