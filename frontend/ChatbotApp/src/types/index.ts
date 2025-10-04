export type MessageSender = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'failed';
}

export interface ExampleQuery {
  id: string;
  text: string;
  icon: string;
}

export interface ConnectedAccount {
  email: string;
  type: 'work' | 'personal';
  connected: boolean;
  dotColor: 'work' | 'personal' | 'disconnected';
}

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  surface?: string;
  surfaceSecondary?: string;
  surfaceTertiary?: string;
  surfaceSubtle?: string;
  surfaceElevated?: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  border: string;
  borderSecondary: string;
  borderFocus: string;
  messageSent: string;
  messageReceived: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  work?: string;
  personal?: string;
  disconnected?: string;
  inputBackground?: string;
  inputBorder?: string;
  inputText?: string;
  inputPlaceholder?: string;
  buttonPrimary?: string;
  buttonPrimaryText?: string;
  buttonSecondary?: string;
  buttonSecondaryText?: string;
  buttonDisabled?: string;
  buttonDisabledText?: string;
  ghostButtonHover?: string;
  ghostButtonActive?: string;
}

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

export interface DesignSystem {
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  typography: {
    fontFamily: {
      primary: string;
      monospace: string;
    };
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
    fontWeight: {
      regular: string;
      medium: string;
      semibold: string;
      bold: string;
    };
  };
  sizing: {
    heights: {
      input: number;
      button: number;
      icon: number;
      avatar: number;
    };
    borderRadius: {
      sm: number;
      md: number;
      lg: number;
      xl: number;
      full: number;
    };
  };
  elevation: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}
