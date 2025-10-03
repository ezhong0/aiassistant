import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { designSystem } from '../../design-system';
import type { ShadowDepth } from '../../design-system';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  ...props
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      paddingVertical: designSystem.spacing['1.5'],
      paddingHorizontal: designSystem.spacing['3'],
      fontSize: designSystem.typography.sizes.label.fontSize,
      shadow: designSystem.shadows.subtle,
    },
    md: {
      paddingVertical: designSystem.spacing['2'],
      paddingHorizontal: designSystem.spacing['4'],
      fontSize: designSystem.typography.sizes.body.fontSize,
      shadow: designSystem.shadows.subtle,
    },
    lg: {
      paddingVertical: designSystem.spacing['3'],
      paddingHorizontal: designSystem.spacing['6'],
      fontSize: designSystem.typography.sizes.bodyMedium.fontSize,
      shadow: designSystem.shadows.medium,
    },
  };

  // Variant styles
  const getVariantStyles = (isDark: boolean = false) => {
    const colors = designSystem.colors[isDark ? 'dark' : 'light'];
    
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled ? colors.textDisabled : colors.primary,
          borderColor: 'transparent',
          textColor: colors.textPrimary,
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.border,
          borderWidth: 1,
          textColor: colors.textPrimary,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: colors.textSecondary,
        };
      case 'danger':
        return {
          backgroundColor: disabled ? colors.textDisabled : colors.error,
          borderColor: 'transparent',
          textColor: '#FFFFFF',
        };
      default:
        return {
          backgroundColor: colors.primary,
          borderColor: 'transparent',
          textColor: '#FFFFFF',
        };
    }
  };

  const styles = sizeConfig[size];
  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: variantStyles.borderWidth || 0,
          borderRadius: designSystem.borderRadius.button,
          paddingVertical: styles.paddingVertical,
          paddingHorizontal: styles.paddingHorizontal,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        },
        fullWidth && { width: '100%' },
        !disabled && !loading && styles.shadow,
      ]}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'secondary' || variant === 'ghost' ? designSystem.colors.light.textSecondary : '#FFFFFF'} 
        />
      ) : (
        <>
          {icon && (
            <View style={{ marginRight: designSystem.spacing['2'] }}>
              {icon}
            </View>
          )}
          <Text
            style={{
              fontSize: styles.fontSize,
              fontWeight: designSystem.typography.sizes.bodyMedium.fontWeight,
              color: disabled ? designSystem.colors.light.textDisabled : variantStyles.textColor,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};
