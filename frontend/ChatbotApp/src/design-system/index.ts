/**
 * Design System for Email Intelligence Assistant - OBSESSIVE POLISH VERSION
 * Final refinement for Superhuman-level quality aesthetics
 */

// ============================================================================
// OBSESSIVE POLISH COLOR PALETTE - PREMIUM SOPHISTICATION
// ============================================================================

export const colors = {
  // ===== LIGHT MODE - CLEAN & MODERN =====
  light: {
    // Clean backgrounds
    background: '#FFFFFF',
    backgroundSecondary: '#F8F8F8',
    
    // Surface hierarchy
    surface: '#FFFFFF',
    surfaceSecondary: '#F8F8F8',
    surfaceTertiary: '#F0F0F0',
    
    // Sophisticated brand
    primary: '#6366F1',
    primaryHover: '#5046E5',
    primaryLight: '#EEF2FF',
    primaryDark: '#4338CA',
    
    // Typography hierarchy
    textPrimary: '#000000',
    textSecondary: '#737373',
    textTertiary: '#A3A3A3',
    textDisabled: '#D4D4D4',
    
    // Interface elements
    border: '#E5E5E5',
    borderSecondary: '#F0F0F0',
    borderFocus: '#6366F1',
    
    // Status colors
    success: '#5B9FED',
    successLight: '#ECFDF5',
    error: '#EF4444',
    errorLight: '#FEF2F2',
    warning: '#E8B44D',
    warningLight: '#FFFBEB',
    info: '#6366F1',
    infoLight: '#EEF2FF',
    
    // Sophisticated messaging
    messageSent: '#6366F1',
    messageReceived: '#F8F8F8',
    messageSystem: '#ECFDF5',
    
    // Account indicators
    accountWork: '#5B9FED',
    accountPersonal: '#9B87E5',
    accountDisconnected: '#A3A3A3',
    
    // Enhanced input prominence
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E5E5',
    inputBorderFocus: '#6366F1',
    inputPlaceholder: '#888888',
    
    // Ghost button styling
    ghostButtonBg: '#F8F8F8',
    ghostButtonBorder: '#E5E5E5',
    ghostButtonActive: '#F0F0F0',
  },
  
  // ===== DARK MODE - OBSESSIVE POLISH ULTRA REFINEMENT =====
  dark: {
    // Ultra-premium backgrounds
    background: '#0A0A0A',          // Almost black - highest quality feel
    backgroundSecondary: '#000000', // Pure black for surfaces
    
    // Whisper-light surface hierarchy
    surfaceSubtle: '#141414',       // Ghost buttons - whisper light
    surfaceElevated: '#1A1A1A',     // Input field - more prominent
    
    // Sophisticated brand consistency
    primary: '#6366F1',
    primaryHover: '#5046E5',
    primaryLight: '#1A1A2E',
    primaryDark: '#A5B4FC',
    
    // Pure typography hierarchy
    textPrimary: '#FFFFFF',         // Pure white - maximum contrast
    textSecondary: '#707070',      // Subtle gray - clearly secondary
    textTertiary: '#888888',       // Bright placeholder text
    textDisabled: '#4A4A4A',       // Disabled content
    textMuted: '#6A6A6A',          // Icon colors
    
    // Subtle border hierarchy
    borderSubtle: '#252525',       // Button borders - almost invisible
    borderMedium: '#2A2A2A',       // Input border - more visible
    borderProminent: '#353535',    // Hover/focus states - noticeable
    
    // Refined status colors
    success: '#5B9FED',           // Muted blue - sophisticated
    successLight: '#0A2E0A',
    error: '#EF4444',
    errorLight: '#2E0A0A',
    warning: '#E8B44D',           // Muted yellow - less saturated
    warningLight: '#2E1A0A',
    info: '#6366F1',
    infoLight: '#1A1A2E',
    
    // Sophisticated chat UI
    messageSent: '#6366F1',
    messageReceived: '#2A2A2A',
    messageSystem: '#0A2E0A',
    
    // Premium account colors
    accountWork: '#5B9FED',        // Muted blue dot
    accountPersonal: '#9B87E5',    // Muted purple dot
    accountDisconnected: '#6A6A6A', // Subtle disconnected state
    
    // Enhanced input prominence
    inputBackground: '#1A1A1A',     // Noticeably lighter
    inputBorder: '#2A2A2A',        // More visible border
    inputBorderFocus: '#353535',   // Clear focus state
    inputPlaceholder: '#888888',   // Much brighter placeholder
    
    // Whisper-light ghost buttons
    ghostButtonBg: '#141414',      // Almost invisible
    ghostButtonBorder: '#252525',  // Subtle border
    ghostButtonActive: '#1A1A1A',  // Press state
  }
} as const;

// ============================================================================
// OBSESSIVE POLISH TYPOGRAPHY - DRAMATIC HIERARCHY
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    primary: 'SF Pro Display',
    monospace: 'SF Mono',
    fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  
  // Dramatic typography hierarchy for maximum impact
  sizes: {
    // Hero headline - DOMINATES visual hierarchy
    headline: {
      fontSize: 28,                // Much larger - commands attention
      fontWeight: '700' as const,   // Bold - not semibold
      lineHeight: 34,              // Compact line height
      letterSpacing: -0.8,         // Tight, refined spacing
    },
    
    // Subtle subheadline - clearly secondary
    subheadline: {
      fontSize: 14,                // Much smaller than headline
      fontWeight: '400' as const,   // Regular weight - recedes
      lineHeight: 20,              // Comfortable line height
      letterSpacing: 0,            // Normal spacing
    },
    
    // Body text
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    
    // Button text - clear but not competing
    button: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 20,
      letterSpacing: -0.2,
    },
    
    // Input text
    input: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    
    // Small labels
    label: {
      fontSize: 13,
      fontWeight: '500' as const,
      lineHeight: 18,
    },
    
    // Chat messages
    chatMessage: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
  }
} as const;

// ============================================================================
// OBSESSIVE POLISH SPACING - GENEROUS PREMIUM FEELS
// ============================================================================

export const spacing = {
  // Micro spacing
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
  
  // Layout-specific generous spacing
  layout: {
    accountBarToContent: 56,       // Generous top spacing
    iconToHeadline: 24,            // Space around hero icon
    headlineToSubtext: 16,         // Clear hierarchy separation
    subtextToButtons: 40,          // Major content separation
    betweenButtons: 14,            // Comfortable button spacing
    contentToInput: 32,            // Minimum input separation
  },
  
  // Enhanced component spacing
  enhancedInputPadding: 24,         // More generous input padding
  buttonPaddingHorizontal: 20,     // Comfortable button padding
  accountPillPadding: 10,          // Extra pill padding
} as const;

// ============================================================================
// OBSESSIVE POLISH SIZING - REFINED PROPORTIONS
// ============================================================================

export const sizing = {
  // Refined border radius
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    hero: 20,
  },
  
  // Enhanced shadows for depth
  elevation: {
    none: {
      shadowOpacity: 0,
    },
    subtle: {
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      shadowColor: '#000000',
    },
    medium: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowColor: '#000000',
    },
    prominent: {
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowColor: '#000000',
    },
  },
  
  // Obsessive component heights
  heights: {
    accountStatusBar: 44,           // Taller for breathing room
    inputField: 64,                // Larger for prominence
    ghostButton: 56,               // Generous tap target
    sendButton: 44,                // More prominent send button
    iconSize: 32,                  // Larger hero icon
    accountDot: 6,                 // Small account dots
    settingsIcon: 26,              // More prominent settings
  },
  
  // Component widths
  widths: {
    inputFieldSendButton: 44,      // Larger send button
  },
} as const;

// ============================================================================
// MICRO-INTERACTIONS - OBSESSIVE POLISH ANIMATIONS
// ============================================================================

export const animations = {
  // Timing for smooth interactions
  duration: {
    fast: 150,
    base: 250,
    slow: 600,
  },
  
  // Spring animations for natural feel
  spring: {
    damping: 15,
    stiffness: 300,
  },
  
  // Scale animations for press feedback
  scale: {
    pressed: 0.97,                 // Subtle press feedback
    focus: 1.01,                   // Subtle focus feedback
    icon: {
      pulse: 0.98,
      shimmer: 1.02,
    },
  },
  
  // Opacity for subtle states
  opacity: {
    pressed: 0.7,
    disabled: 0.4,
  },
} as const;

// ============================================================================
// EXPORT OBSESSIVE POLISH DESIGN SYSTEM
// ============================================================================

export const designSystem = {
  colors,
  typography,
  spacing,
  sizing: {
    ...sizing,
    borderRadius: sizing.borderRadius,
    elevation: sizing.elevation,
    heights: sizing.heights,
    widths: sizing.widths,
  },
  animations,
} as const;

export default designSystem;