/**
 * Email Connection Screen - Gmail OAuth connection flow
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { designSystem } from '../../design-system';

const { colors, spacing, typography } = designSystem;

interface EmailConnectionScreenProps {
  onConnect: () => void;
  onSkip: () => void;
  isDarkMode?: boolean;
}

const EmailConnectionScreen: React.FC<EmailConnectionScreenProps> = ({
  onConnect,
  onSkip,
  isDarkMode = false,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const themeColors = isDarkMode ? colors.dark : colors.light;

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      // TODO: Implement actual Gmail OAuth flow
      // For now, simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Success',
        'Gmail account connected successfully!',
        [{ text: 'Continue', onPress: onConnect }]
      );
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        'Unable to connect Gmail account. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.headerSection}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📧</Text>
          </View>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            Connect Your Email
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Connect your Gmail account to start managing your emails with AI
          </Text>
        </Animated.View>

        {/* Gmail Connection Card */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={[
            styles.connectionCard,
            {
              backgroundColor: themeColors.backgroundSecondary,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={styles.providerInfo}>
            <View style={styles.gmailIcon}>
              <Text style={styles.gmailIconText}>G</Text>
            </View>
            <View style={styles.providerContent}>
              <Text style={[styles.providerName, { color: themeColors.textPrimary }]}>
                Google Mail
              </Text>
              <Text style={[styles.providerDescription, { color: themeColors.textSecondary }]}>
                Connect with your Google account
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.connectButton,
              { backgroundColor: themeColors.primary },
              isConnecting && styles.connectButtonDisabled,
            ]}
            onPress={handleConnectGmail}
            disabled={isConnecting}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Connect Gmail"
          >
            {isConnecting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.connectButtonText}>Connect Gmail</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Security Information */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(400)}
          style={styles.securitySection}
        >
          <Text style={[styles.securityTitle, { color: themeColors.textPrimary }]}>
            🔒 Your privacy is protected
          </Text>
          <View style={styles.securityPoints}>
            <SecurityPoint
              text="End-to-end encrypted connection"
              themeColors={themeColors}
            />
            <SecurityPoint
              text="We never store your password"
              themeColors={themeColors}
            />
            <SecurityPoint
              text="You can disconnect anytime"
              themeColors={themeColors}
            />
            <SecurityPoint
              text="Read-only access to emails"
              themeColors={themeColors}
            />
          </View>
        </Animated.View>

        {/* Benefits */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(400)}
          style={[
            styles.benefitsCard,
            {
              backgroundColor: themeColors.primary + '10',
              borderColor: themeColors.primary + '30',
            },
          ]}
        >
          <Text style={[styles.benefitsTitle, { color: themeColors.primary }]}>
            What you'll get:
          </Text>
          <Text style={[styles.benefitItem, { color: themeColors.textSecondary }]}>
            ✓ Smart email summaries
          </Text>
          <Text style={[styles.benefitItem, { color: themeColors.textSecondary }]}>
            ✓ Automatic prioritization
          </Text>
          <Text style={[styles.benefitItem, { color: themeColors.textSecondary }]}>
            ✓ Action item extraction
          </Text>
          <Text style={[styles.benefitItem, { color: themeColors.textSecondary }]}>
            ✓ Meeting reminders
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: themeColors.background }]}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          disabled={isConnecting}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Skip email connection"
        >
          <Text style={[styles.skipButtonText, { color: themeColors.textSecondary }]}>
            I'll do this later
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SecurityPoint: React.FC<{ text: string; themeColors: any }> = ({ text, themeColors }) => (
  <View style={styles.securityPoint}>
    <Text style={[styles.checkmark, { color: themeColors.success }]}>✓</Text>
    <Text style={[styles.securityPointText, { color: themeColors.textSecondary }]}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  connectionCard: {
    padding: spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  gmailIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EA4335',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  gmailIconText: {
    fontSize: 24,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  providerContent: {
    flex: 1,
  },
  providerName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  providerDescription: {
    fontSize: typography.sizes.base,
  },
  connectButton: {
    height: 56,
    borderRadius: designSystem.sizing.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  securitySection: {
    marginBottom: spacing.xl,
  },
  securityTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  securityPoints: {
    marginTop: spacing.md,
  },
  securityPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  checkmark: {
    fontSize: 20,
    marginRight: spacing.sm,
    fontWeight: typography.weights.bold,
  },
  securityPointText: {
    fontSize: typography.sizes.base,
    flex: 1,
  },
  benefitsCard: {
    padding: spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.lg,
    borderWidth: 1,
  },
  benefitsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  benefitItem: {
    fontSize: typography.sizes.base,
    marginBottom: spacing.xs,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
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

export default EmailConnectionScreen;
