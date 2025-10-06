import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { designSystem } from '../index';
import type { TextSize } from '../index';

interface CustomTextProps extends TextProps {
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyMedium' | 'caption' | 'captionMedium' | 'label' | 'labelSmall' | 'chatMessage' | 'chatTime';
  color?: 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'success' | 'error' | 'warning';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  className?: string;
}

export const Text: React.FC<CustomTextProps> = ({
  children,
  variant = 'body',
  color = 'primary',
  textAlign = 'left',
  style,
  ...props
}) => {
  // Get typography configuration
  const typography = designSystem.typography.sizes[variant];
  const colors = designSystem.colors.light;
  
  // Color mapping
  const colorMap = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    disabled: colors.textDisabled,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
  };

  return (
    <RNText
      style={[
        {
          fontSize: typography.fontSize,
          lineHeight: typography.lineHeight,
          fontWeight: typography.fontWeight,
          letterSpacing: typography.letterSpacing,
          color: colorMap[color],
          textAlign,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};
