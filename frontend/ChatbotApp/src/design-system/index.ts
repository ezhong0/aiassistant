/**
 * Design System for Email Intelligence Assistant
 * Modern, minimal aesthetic inspired by Linear, Raycast, and Arc Browser
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  // ===== LIGHT MODE =====
  light: {
    // Background Colors
    background: '#FFFFFF',        // Pure white background for clean, minimal feel
    backgroundSecondary: '#F8F9FB', // Subtle secondary background for cards/sections
    
    // Surface Colors (for elevated elements like cards, modals)
    surface: '#FFFFFF',          // Cards, modals, floating elements
    surfaceSecondary: '#F1F3F6', // Subtle surface variation
    surfaceTertiary: '#EDF0F3',  // Backdrop for disabled states
    
    // Brand/Primary Colors
    primary: '#2563EB',          // Indigo 600 - professional, trustworthy blue
    primaryHover: '#1D4ED8',    // Indigo 700 - hover state
    primaryLight: '#E0E7FF',    // Indigo 100 - subtle primary accent
    primaryDark: '#1E40AF',     // Indigo 800 - for text on primary bg
    
    // Text Colors
    textPrimary: '#111827',     // Gray 900 - high contrast for readability
    textSecondary: '#6B7280',   // Gray 500 - secondary text, perfect contrast
    textTertiary: '#9CA3AF',    // Gray 400 - less important info
    textDisabled: '#D1D5DB',   // Gray 300 - disabled text
    
    // Border Colors
    border: '#E5E7EB',          // Gray 200 - subtle borders
    borderSecondary: '#F3F4F6', // Gray 100 - very subtle borders
    borderFocus: '#2563EB',     // Same as primary for focus states
    
    // Status Colors
    success: '#059669',         // Emerald 600 - positive actions
    successLight: '#D1FAE5',   // Emerald 100 - success backgrounds
    error: '#DC2626',          // Red 600 - errors, destructive actions
    errorLight: '#FEE2E2',     // Red 100 - error backgrounds
    warning: '#D97706',        // Amber 600 - warnings
    warningLight: '#FEF3C7',   // Amber 100 - warning backgrounds
    info: '#2563EB',           // Info (same as primary)
    infoLight: '#E0E7FF',      // Info backgrounds
    
    // Semantic Colors for Chat UI
    messageSent: '#E0E7FF',    // Light indigo for sent messages
    messageReceived: '#F3F4F6', // Light gray for received messages
    messageSystem: '#FEF3C7',   // Light amber for system messages
  },
  
  // ===== DARK MODE =====
  dark: {
    // Background Colors
    background: '#0F1629',      // Deep navy backdrop (Arc Browser inspired)
    backgroundSecondary: '#1A2332', // Subtle secondary background
    
    // Surface Colors
    surface: '#1E293B',        // Cards, modals, floating elements
    surfaceSecondary: '#334155', // Subtle surface variation
    surfaceTertiary: '#475569', // Backdrop for disabled states
    
    // Brand/Primary Colors
    primary: '#3B82F6',        // Blue 500 - brighter for dark mode
    primaryHover: '#2563EB',    // Blue 600 - hover state
    primaryLight: '#1E3A8A',   // Blue 900 - subtle primary accent
    primaryDark: '#60A5FA',    // Blue 400 - text on primary bg
    
    // Text Colors
    textPrimary: '#F8FAFC',    // Slate 50 - high contrast for readability
    textSecondary: '#94A3B8',  // Slate 400 - secondary text
    textTertiary: '#64748B',   // Slate 500 - less important info
    textDisabled: '#475569',   // Slate 600 - disabled text
    
    // Border Colors
    border: '#334155',         // Subtle borders that don't overpower
    borderSecondary: '#475569', // Very subtle borders
    borderFocus: '#3B82F6',    // Same as primary for focus states
    
    // Status Colors
    success: '#10B981',       // Emerald 500 - brighter for dark mode
    successLight: '#064E3B',  // Emerald 900 - success backgrounds
    error: '#EF4444',         // Red 500 - brighter for dark mode
    errorLight: '#7F1D1D',    // Red 900 - error backgrounds
    warning: '#F59E0B',       // Amber 500 - brighter for dark mode
    warningLight: '#78350F',  // Amber 900 - warning backgrounds
    info: '#3B82F6',          // Info (same as primary)
    infoLight: '#1E3A8A',     // Info backgrounds
    
    // Semantic Colors for Chat UI
    messageSent: '#1E3A8A',   // Dark blue for sent messages
    messageReceived: '#334155', // Dark gray for received messages
    messageSystem: '#78350F',  // Dark amber for system messages
  }
} as const;

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================

export const typography = {
  // Font Family (system fonts for performance and consistency)
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  
  // Font Sizes and Line Heights
  sizes: {
    // Display - for hero sections or very prominent text
    display: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    
    // Headings
    h1: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '600' as const,
      letterSpacing: -0.25,
    },
    h3: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
    h4: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
    
    // Body Text
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    bodyMedium: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500' as const,
      letterSpacing: 0,
    },
    
    // Small Text
    caption: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    captionMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500' as const,
      letterSpacing: 0,
    },
    
    // Labels and UI Elements
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,
      letterSpacing: 0.25,
    },
    labelSmall: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
    },
    
    // Chat-specific sizes
    chatMessage: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    chatTime: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400' as const,
      letterSpacing: 0.25,
    },
  }
} as const;

// ============================================================================
// SPACING SCALE (8-point grid system)
// ============================================================================

export const spacing = {
  // Base unit is 4px, following 8-point grid
  0: 0,      // No spacing
  '0.5': 2,   // 2px - tiny gaps between tightly related elements
  '1': 4,     // 4px - minimal internal padding
  '1.5': 6,   // 6px - small gaps, tight layouts
  '2': 8,     // 8px - standard small spacing
  '3': 12,    // 12px - comfortable spacing between related items
  '4': 16,    // 16px - standard spacing, most common
  '5': 20,    // 20px - generous spacing
  '6': 24,    // 24px - section spacing
  '8': 32,    // 32px - large spacing between sections
  '10': 40,   // 40px - very large spacing
  '12': 48,   // 48px - hero section spacing
  '16': 64,   // 64px - page-level spacing
  '20': 80,   // 80px - extreme spacing
  '24': 96,   // 96px - maximum spacing
  
  // Semantic spacing for common patterns
  icon: 6,           // spacing.3 - space around icons
  buttonPadding: 12, // spacing.3 - standard button padding
  cardPadding: 16,   // spacing.4 - standard card padding
  sectionMargin: 32, // spacing.8 - margin between major sections
  
  // Chat-specific spacing
  chatInputHeight: 44,    // Standard iOS input height
  chatMessagePadding: 12, // spacing.3 - message bubble padding
  chatMessageMargin: 8,   // spacing.2 - margin between messages
  chatTimestampMargin: 4, // spacing.1 - margin for timestamps
} as const;

// ============================================================================
// BORDER RADIUS VALUES
// ============================================================================

export const borderRadius = {
  none: 0,        // No radius - rectilinear design elements
  sm: 4,          // Small radius - inputs, small buttons
  md: 8,          // Medium radius - cards, buttons (default)
  lg: 12,         // Large radius - modals, large cards
  xl: 16,         // Extra large radius - hero sections
  '2xl': 24,      // Maximum radius - special emphasis
  full: 9999,     // Fully rounded - pills, avatars
  
  // Semantic radius for common components
  button: 8,      // borderRadius.md - default button radius
  card: 12,       // borderRadius.lg - default card radius
  input: 6,       // Between sm and md - input fields
  message: 16,    // borderRadius.xl - chat message bubbles
  avatar: 9999,   // borderRadius.full - user avatars
} as const;

// ============================================================================
// SHADOW DEPTHS
// ============================================================================

export const shadows = {
  // iOS shadow styles
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0, // Android
  },
  
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1, // Android
  },
  
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4, // Android
  },
  
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8, // Android
  },
  
  // Semantic shadows for components
  card: 'medium',      // Default card shadow
  button: 'subtle',    // Default button shadow
  modal: 'heavy',      // Modal backdrop shadow
  message: 'subtle',   // Chat message shadow
} as const;

// ============================================================================
// ANIMATION TIMINGS & EASING
// ============================================================================

export const animations = {
  // Duration (in milliseconds)
  duration: {
    instant: 150,      // Quick micro-interactions
    fast: 250,         // Standard animations (buttons, hovers)
    medium: 300,       // Page transitions
    slow: 500,         // Complex animations, modal appearances
    slowest: 750,      // Error animations, loading states
  },
  
  // Easing functions (CSS equivalent)
  easing: {
    linear: 'ease',              // Linear progression
    easeIn: 'ease-in',           // Slow start, fast end
    easeOut: 'ease-out',          // Fast start, slow end (recommended)
    easeInOut: 'ease-in-out',    // Slow start/end, fast middle
    spring: [0.4, 0, 0.2, 1],    // Custom spring easing (Material Design)
    bounce: [0.68, -0.55, 0.265, 1.55], // Subtle bounce effect
  },
  
  // Semantic animations for specific use cases
  buttonPress: {
    duration: 'instant',
    easing: 'easeOut',
    scale: 0.96, // Slight scale down on press
  },
  
  modalSlide: {
    duration: 'medium',
    easing: 'easeOut',
  },
  
  messageEnter: {
    duration: 'fast',
    easing: 'easeOut',
  },
  
  loadingSpinner: {
    duration: 1000,
    easing: 'linear',
  },
} as const;

// ============================================================================
// BREAKPOINTS (for responsive design)
// ============================================================================

export const breakpoints = {
  xs: 0,      // Extra small devices
  sm: 576,    // Small devices (tablets in portrait)
  md: 768,    // Medium devices (tablets in landscape)
  lg: 992,    // Large devices (desktops)
  xl: 1200,   // Extra large devices
} as const;

// ============================================================================
// USAGE GUIDELINES
// ============================================================================

export const guidelines = {
  // When to use each spacing value
  spacingUsage: {
    xs: 'Tight layouts, icons, small elements',
    sm: 'Minimal gaps between related items',
    md: 'Standard spacing between elements',
    lg: 'Comfortable spacing in cards',
    xl: 'Section spacing, large components',
    '2xl': 'Page-level spacing',
    '3xl': 'Hero sections, major separations',
  },
  
  // When to use each text size
  textUsage: {
    display: 'Hero sections, major CTAs',
    h1: 'Page titles, main headings',
    h2: 'Section headings',
    h3: 'Card titles, subsection headings',
    h4: 'Small section headings',
    body: 'Default paragraph text, chat messages',
    caption: 'Helper text, descriptions',
    label: 'Form labels, small UI elements',
  },
  
  // Color usage patterns
  colorUsage: {
    primary: 'CTAs, links, active states, brand elements',
    textPrimary: 'Main content, important information',
    textSecondary: 'Supporting text, less important info',
    success: 'Confirmation messages, successful actions',
    error: 'Error states, destructive actions',
    warning: 'Caution messages, pending states',
  },
  
  // Animation timing guidelines
  animationUsage: {
    instant: 'Button presses, immediate feedback',
    fast: 'Card hovers, small state changes',
    medium: 'Page transitions, modal appearances',
    slow: 'Loading states, complex animations',
  },
} as const;

// ============================================================================
// COMMON PATTERNS & PRESETS
// ============================================================================

export const presets = {
  // Button styles
  button: {
    primary: {
      borderRadius: borderRadius.button,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['4'],
      shadow: shadows.button,
    },
    secondary: {
      borderRadius: borderRadius.button,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['4'],
      borderWidth: 1,
    },
  },
  
  // Card styles
  card: {
    default: {
      borderRadius: borderRadius.card,
      padding: spacing.cardPadding,
      shadow: shadows.card,
    },
  },
  
  // Input styles
  input: {
    default: {
      borderRadius: borderRadius.input,
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['4'],
      borderWidth: 1,
    },
  },
  
  // Message styles
  message: {
    sent: {
      borderRadius: borderRadius.message,
      paddingVertical: spacing.chatMessagePadding,
      paddingHorizontal: spacing.chatMessagePadding,
      marginVertical: spacing.chatMessageMargin,
    },
    received: {
      borderRadius: borderRadius.message,
      paddingVertical: spacing.chatMessagePadding,
      paddingHorizontal: spacing.chatMessagePadding,
      marginVertical: spacing.chatMessageMargin,
    },
  },
} as const;

// Export everything as a single object for convenience
export const designSystem = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  breakpoints,
  guidelines,
  presets,
} as const;

// TypeScript interfaces for enhanced type safety
export interface ThemeColors {
  light: typeof colors.light;
  dark: typeof colors.dark;
}

export interface DesignSystemTheme {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  animations: typeof animations;
}

export type ColorTheme = keyof ThemeColors;
export type SpacingKey = keyof typeof spacing;
export type TextSize = keyof typeof typography.sizes;
export type BorderRadiusKey = keyof typeof borderRadius;
export type ShadowDepth = keyof typeof shadows;
export type AnimationDuration = keyof typeof animations.duration;
