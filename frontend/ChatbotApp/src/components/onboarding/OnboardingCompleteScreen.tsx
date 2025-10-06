/**
 * Onboarding Complete Screen - Success screen after onboarding
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { designSystem } from '../../design-system';

const { colors, spacing, typography } = designSystem;

interface OnboardingCompleteScreenProps {
  onComplete: () => void;
  isDarkMode?: boolean;
}

const OnboardingCompleteScreen: React.FC<OnboardingCompleteScreenProps> = ({
  onComplete,
  isDarkMode = false,
}) => {
  const themeColors = isDarkMode ? colors.dark : colors.light;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Animation */}
        <Animated.View
          entering={ZoomIn.duration(600)}
          style={styles.successSection}
        >
          <View style={styles.successCircle}>
            <Text style={styles.successEmoji}>🎉</Text>
          </View>
        </Animated.View>

        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(400).duration(600)}
          style={styles.headerSection}
        >
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            You're All Set!
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Your AI assistant is ready to help you stay organized and productive
          </Text>
        </Animated.View>

        {/* Quick Tips */}
        <View style={styles.tipsContainer}>
          <Animated.View
            entering={FadeInDown.delay(600).duration(400)}
            style={styles.sectionHeader}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Quick Tips to Get Started
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(700).duration(400)}
            style={[
              styles.tipCard,
              {
                backgroundColor: themeColors.backgroundSecondary,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={styles.tipNumber}>1</Text>
            <View style={styles.tipContent}>
              <Text style={[styles.tipTitle, { color: themeColors.textPrimary }]}>
                Ask natural questions
              </Text>
              <Text style={[styles.tipDescription, { color: themeColors.textSecondary }]}>
                Try "Show me urgent emails" or "What's on my calendar today?"
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(800).duration(400)}
            style={[
              styles.tipCard,
              {
                backgroundColor: themeColors.backgroundSecondary,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={styles.tipNumber}>2</Text>
            <View style={styles.tipContent}>
              <Text style={[styles.tipTitle, { color: themeColors.textPrimary }]}>
                Get daily summaries
              </Text>
              <Text style={[styles.tipDescription, { color: themeColors.textSecondary }]}>
                Receive morning digests of important emails and events
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(900).duration(400)}
            style={[
              styles.tipCard,
              {
                backgroundColor: themeColors.backgroundSecondary,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={styles.tipNumber}>3</Text>
            <View style={styles.tipContent}>
              <Text style={[styles.tipTitle, { color: themeColors.textPrimary }]}>
                Customize your experience
              </Text>
              <Text style={[styles.tipDescription, { color: themeColors.textSecondary }]}>
                Visit Settings to adjust notifications and preferences
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Success Stats */}
        <Animated.View
          entering={FadeInDown.delay(1000).duration(400)}
          style={[
            styles.statsCard,
            {
              backgroundColor: themeColors.primary + '15',
              borderColor: themeColors.primary + '30',
            },
          ]}
        >
          <Text style={[styles.statsTitle, { color: themeColors.primary }]}>
            ✨ Expected time savings
          </Text>
          <Text style={[styles.statsValue, { color: themeColors.primary }]}>
            2+ hours/day
          </Text>
          <Text style={[styles.statsDescription, { color: themeColors.textSecondary }]}>
            Join thousands of users who have reclaimed their time
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Footer Action */}
      <View style={[styles.footer, { backgroundColor: themeColors.background }]}>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: themeColors.primary }]}
          onPress={onComplete}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Start using the app"
        >
          <Text style={styles.startButtonText}>Start Using Assistant</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  successSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successEmoji: {
    fontSize: 60,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: spacing.md,
  },
  tipsContainer: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  tipCard: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  tipNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    color: '#FFFFFF',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    lineHeight: 32,
    marginRight: spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  tipDescription: {
    fontSize: typography.sizes.base,
    lineHeight: 22,
  },
  statsCard: {
    padding: spacing.xl,
    borderRadius: designSystem.sizing.borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  statsValue: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  statsDescription: {
    fontSize: typography.sizes.base,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  startButton: {
    height: 56,
    borderRadius: designSystem.sizing.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
});

export default OnboardingCompleteScreen;
