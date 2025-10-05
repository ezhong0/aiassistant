/**
 * Loading Indicator Component
 *
 * Contextual loading states:
 * - Typing indicator (animated dots)
 * - Sending message
 * - Syncing
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { designSystem } from '../design-system';

const { colors, spacing, typography } = designSystem;

export type LoadingType = 'typing' | 'sending' | 'syncing';

interface LoadingIndicatorProps {
  type: LoadingType;
  isDarkMode?: boolean;
  message?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  type,
  isDarkMode = false,
  message,
}) => {
  const themeColors = isDarkMode ? colors.dark : colors.light;

  // Animated values for dots
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = Animated.parallel([
      createDotAnimation(dot1, 0),
      createDotAnimation(dot2, 150),
      createDotAnimation(dot3, 300),
    ]);

    animations.start();

    return () => animations.stop();
  }, [dot1, dot2, dot3]);

  const getMessage = () => {
    if (message) return message;

    switch (type) {
      case 'typing':
        return 'Thinking...';
      case 'sending':
        return 'Sending...';
      case 'syncing':
        return 'Syncing...';
      default:
        return 'Loading...';
    }
  };

  const getDotOpacity = (dot: Animated.Value) => ({
    opacity: dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
  });

  return (
    <View style={styles.container}>
      {type === 'typing' && (
        <View style={[styles.avatar, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.avatarText}>🤖</Text>
        </View>
      )}

      <View style={[styles.bubble, { backgroundColor: themeColors.backgroundSecondary }]}>
        <Text style={[styles.text, { color: themeColors.textSecondary }]}>
          {getMessage()}
        </Text>

        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: themeColors.primary },
              getDotOpacity(dot1),
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: themeColors.primary },
              getDotOpacity(dot2),
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: themeColors.primary },
              getDotOpacity(dot3),
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: typography.sizes.sm,
    marginRight: spacing.sm,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
});

export default LoadingIndicator;
