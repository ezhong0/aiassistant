/**
 * Progress Indicator - Shows onboarding progress
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { designSystem } from '../../design-system';

const { colors, spacing } = designSystem;

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  isDarkMode?: boolean;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  isDarkMode = false,
}) => {
  const themeColors = isDarkMode ? colors.dark : colors.light;
  const progress = (currentStep + 1) / totalSteps;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${progress * 100}%`, {
        duration: 300,
      }),
    };
  });

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.progressBar,
          { backgroundColor: themeColors.border },
        ]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            { backgroundColor: themeColors.primary },
            animatedStyle,
          ]}
        />
      </View>
      <View style={styles.dotsContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index <= currentStep
                    ? themeColors.primary
                    : themeColors.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});

export default ProgressIndicator;
