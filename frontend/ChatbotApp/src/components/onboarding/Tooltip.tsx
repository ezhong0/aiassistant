/**
 * Tooltip Component - Contextual help overlays
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { designSystem } from '../../design-system';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const { colors, spacing, typography } = designSystem;

interface TooltipProps {
  visible: boolean;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'center';
  onDismiss: () => void;
  onNext?: () => void;
  isDarkMode?: boolean;
  showSkip?: boolean;
  currentStep?: number;
  totalSteps?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  visible,
  title,
  description,
  position = 'center',
  onDismiss,
  onNext,
  isDarkMode = false,
  showSkip = true,
  currentStep,
  totalSteps,
}) => {
  const themeColors = isDarkMode ? colors.dark : colors.light;

  const getContainerStyle = () => {
    switch (position) {
      case 'top':
        return { justifyContent: 'flex-start', paddingTop: spacing.xxl };
      case 'bottom':
        return { justifyContent: 'flex-end', paddingBottom: spacing.xxl };
      default:
        return { justifyContent: 'center' };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.overlay, getContainerStyle()]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onDismiss}
        />

        <Animated.View
          entering={SlideInUp.duration(300)}
          style={[
            styles.tooltipCard,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors.border,
            },
          ]}
        >
          {/* Progress indicator */}
          {currentStep !== undefined && totalSteps !== undefined && (
            <View style={styles.progressDots}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor:
                        index === currentStep
                          ? themeColors.primary
                          : themeColors.border,
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Content */}
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            {description}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {showSkip && (
              <TouchableOpacity
                onPress={onDismiss}
                style={styles.skipButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Skip tutorial"
              >
                <Text style={[styles.skipButtonText, { color: themeColors.textSecondary }]}>
                  Skip
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onNext || onDismiss}
              style={[styles.nextButton, { backgroundColor: themeColors.primary }]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={onNext ? 'Next tip' : 'Got it'}
            >
              <Text style={styles.nextButtonText}>
                {onNext ? 'Next' : 'Got it'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.xl,
  },
  tooltipCard: {
    borderRadius: designSystem.sizing.borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    maxWidth: SCREEN_WIDTH - spacing.xl * 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.sizes.base,
    lineHeight: 24,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  skipButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  nextButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: designSystem.sizing.borderRadius.lg,
    minWidth: 100,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});

export default Tooltip;
