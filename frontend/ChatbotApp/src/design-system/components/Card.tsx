import React from 'react';
import { View, ViewProps } from 'react-native';
import { designSystem } from '../index';
import type { ShadowDepth } from '../index';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'flat';
  padding?: keyof typeof designSystem.spacing | 'none';
  rounded?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'card-padding',
  rounded = false,
  style,
  ...props
}) => {
  // Variant configurations
  const variantConfig = {
    default: {
      backgroundColor: designSystem.colors.light.surface,
      shadow: designSystem.shadows.medium,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    elevated: {
      backgroundColor: designSystem.colors.light.surface,
      shadow: designSystem.shadows.heavy,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    flat: {
      backgroundColor: designSystem.colors.light.surfaceSecondary,
      shadow: designSystem.shadows.none,
      borderWidth: 1,
      borderColor: designSystem.colors.light.borderSecondary,
    },
  };

  const config = variantConfig[variant];
  const paddingValue = padding === 'none' ? 0 : designSystem.spacing[padding as keyof typeof designSystem.spacing];

  return (
    <View
      style={[
        {
          backgroundColor: config.backgroundColor,
          borderRadius: rounded ? designSystem.borderRadius['2xl'] : designSystem.borderRadius.card,
          padding: paddingValue,
          borderWidth: config.borderWidth,
          borderColor: config.borderColor,
          ...config.shadow,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};
