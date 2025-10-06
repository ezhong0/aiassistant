/**
 * Welcome Screen - First screen in onboarding flow
 * Shows value proposition and key features
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { designSystem } from '../../design-system';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const { colors, spacing, typography } = designSystem;

interface WelcomeScreenProps {
  onContinue: () => void;
  onSkip: () => void;
  isDarkMode?: boolean;
}

const FEATURES = [
  {
    icon: '📧',
    title: 'Smart Email Management',
    description: 'AI analyzes your emails and highlights what matters most',
  },
  {
    icon: '⚡',
    title: 'Instant Answers',
    description: 'Get quick summaries and action items from your inbox',
  },
  {
    icon: '🎯',
    title: 'Stay Focused',
    description: 'Filter out noise and focus on important communications',
  },
  {
    icon: '📅',
    title: 'Calendar Integration',
    description: 'Never miss a meeting or deadline again',
  },
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onContinue,
  onSkip,
  isDarkMode = false,
}) => {
  const themeColors = isDarkMode ? colors.dark : colors.light;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <Animated.View
          entering={FadeIn.duration(600)}
          style={styles.heroSection}
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>✨</Text>
          </View>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            Welcome to Assistant
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Your AI-powered email & calendar assistant that helps you stay organized and productive
          </Text>
        </Animated.View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={index}
              entering={FadeInDown.delay(200 + index * 100).duration(500)}
              style={[
                styles.featureCard,
                {
                  backgroundColor: themeColors.backgroundSecondary,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: themeColors.textPrimary }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: themeColors.textSecondary }]}>
                  {feature.description}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Value Proposition */}
        <Animated.View
          entering={FadeInDown.delay(800).duration(500)}
          style={[
            styles.valueCard,
            {
              backgroundColor: themeColors.primary + '15',
              borderColor: themeColors.primary + '30',
            },
          ]}
        >
          <Text style={[styles.valueText, { color: themeColors.primary }]}>
            Save 2+ hours every day by letting AI handle the busywork
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.footer, { backgroundColor: themeColors.background }]}>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: themeColors.primary }]}
          onPress={onContinue}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.continueButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text style={[styles.skipButtonText, { color: themeColors.textSecondary }]}>
            Skip for now
          </Text>
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
    paddingTop: spacing.xxl * 1.5,
    paddingBottom: spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoEmoji: {
    fontSize: 50,
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
  featuresContainer: {
    marginBottom: spacing.xl,
  },
  featureCard: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: spacing.lg,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: typography.sizes.base,
    lineHeight: 22,
  },
  valueCard: {
    padding: spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  valueText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  continueButton: {
    height: 56,
    borderRadius: designSystem.sizing.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  skipButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
});

export default WelcomeScreen;
