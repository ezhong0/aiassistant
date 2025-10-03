import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { 
  FadeInUp, 
  useAnimatedStyle, 
  withTiming,
  withRepeat,
  withSequence 
} from 'react-native-reanimated';
import { designSystem } from '../../design-system';

interface SystemMessageProps {
  message: string;
  timestamp?: number | Date;
  type?: 'info' | 'success' | 'warning' | 'loading';
  onPress?: () => void;
  dismissible?: boolean;
  animationDelay?: number;
  autoHideAfter?: number; // Auto-hide after milliseconds
}

export const SystemMessage: React.FC<SystemMessageProps> = ({
  message,
  timestamp,
  type = 'info',
  onPress,
  dismissible = false,
  animationDelay = 0,
  autoHideAfter,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isHiding, setIsHiding] = useState(false);

  // Auto-hide functionality
  useEffect(() => {
    if (autoHideAfter && autoHideAfter > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideAfter);

      return () => clearTimeout(timer);
    }
  }, [autoHideAfter]);

  const handleDismiss = () => {
    setIsHiding(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 200); // Allow animation to complete
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (dismissible) {
      handleDismiss();
    }
  };

  const colors = designSystem.colors.light;

  // Type-specific styling
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: colors.successLight,
          borderColor: colors.success,
          iconColor: colors.success,
        };
      case 'warning':
        return {
          backgroundColor: colors.warningLight,
          borderColor: colors.warning,
          iconColor: colors.warning,
        };
      case 'loading':
        return {
          backgroundColor: colors.infoLight,
          borderColor: colors.info,
          iconColor: colors.info,
        };
      default: // info
        return {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.borderSecondary,
          iconColor: colors.textSecondary,
        };
    }
  };

  const typeStyles = getTypeStyles();

  // Loading animation for loading state
  const loadingAnimation = useAnimatedStyle(() => ({
    opacity: type === 'loading' 
      ? withRepeat(
          withSequence(
            withTiming(0.3, { duration: 1000 }),
            withTiming(1, { duration: 1000 })
          ),
          -1
        )
      : 1,
  }));

  // Hide animation
  const hideAnimation = useAnimatedStyle(() => ({
    opacity: withTiming(isHiding ? 0 : 1, { duration: 200 }),
    transform: [{ 
      scale: withTiming(isHiding ? 0.95 : 1, { duration: 200 }) 
    }],
  }));

  if (!isVisible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(designSystem.animations.duration.fast).delay(animationDelay)}
      style={[
        {
          alignSelf: 'center',
          maxWidth: '90%',
          marginVertical: designSystem.spacing['2'],
        },
        hideAnimation,
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          {
            backgroundColor: typeStyles.backgroundColor,
            borderRadius: designSystem.borderRadius.md,
            paddingVertical: designSystem.spacing['3'],
            paddingHorizontal: designSystem.spacing['4'],
            borderWidth: 1,
            borderColor: typeStyles.borderColor,
            opacity: pressed ? 0.9 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        {/* Type Icon */}
        <View style={{ marginRight: designSystem.spacing['2'] }}>
          <Animated.Text style={[
            {
              fontSize: 16,
              color: typeStyles.iconColor,
              fontWeight: '600' as const,
            },
            loadingAnimation,
          ]}>
            {type === 'success' && '✓'}
            {type === 'warning' && '⚠'}
            {type === 'loading' && '⟳'}
            {type === 'info' && 'ℹ'}
          </Animated.Text>
        </View>

        {/* Message Text */}
        <Text style={{
          fontSize: designSystem.typography.sizes.caption.fontSize,
          lineHeight: designSystem.typography.sizes.caption.lineHeight,
          color: colors.textSecondary,
          fontWeight: '500' as const,
          textAlign: 'center',
          flex: 1,
        }}>
          {message}
        </Text>

        {/* Dismissible indicator */}
        {dismissible && (
          <Pressable
            onPress={handleDismiss}
            style={{
              marginLeft: designSystem.spacing['2'],
              padding: designSystem.spacing['1'],
            }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={{
              fontSize: 12,
              color: colors.textTertiary,
              fontWeight: '600' as const,
            }}>
              ×
            </Text>
          </Pressable>
        )}
      </Pressable>

      {/* Optional timestamp (for debugging/logging) */}
      {timestamp && (
        <View style={{ alignItems: 'center', marginTop: designSystem.spacing['1'] }}>
          <Text style={{
            fontSize: 10,
            color: colors.textTertiary,
            opacity: 0.7,
          }}>
            {new Date(timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

/* 
USAGE EXAMPLES:
--------------
Basic info message:
<SystemMessage message="Connected to Work Gmail" />

Success notification:
<SystemMessage 
  message="Email sent successfully" 
  type="success" 
  autoHideAfter={3000}
/>

Warning message:
<SystemMessage 
  message="Unable to sync calendar events" 
  type="warning"
  dismissible 
/>

Loading state:
<SystemMessage 
  message="Analyzing emails..." 
  type="loading"
/>
*/

/* 
STYLING EXPLANATION:
-------------------
- Centered alignment for non-intrusive appearance
- Max width 90% to prevent overly wide messages
- Type-specific color coding (success=green, warning=amber, loading=blue, info=gray)
- Subtle border for definition without heaviness
- Icon indicator (✓, ⚠, ⟳, ℹ) with appropriate colors
- Smaller font size (caption) to maintain secondary importance
- Dismissible cross button (×) for user control
- Loading animation pulses the icon continuously
- Auto-hide timer functionality for temporary notifications
- Optional timestamp in tiny text for debugging/logging
- Smooth hide animation (fade + scale down) when dismissed
- Minimal vertical margin to keep system messages compact
*/
