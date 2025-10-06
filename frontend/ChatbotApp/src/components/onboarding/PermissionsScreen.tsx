/**
 * Permissions Screen - Request notification permissions
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { designSystem } from '../../design-system';

const { colors, spacing, typography } = designSystem;

interface PermissionsScreenProps {
  onGrant: () => void;
  onSkip: () => void;
  isDarkMode?: boolean;
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({
  onGrant,
  onSkip,
  isDarkMode = false,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const themeColors = isDarkMode ? colors.dark : colors.light;

  const handleRequestPermissions = async () => {
    setIsRequesting(true);
    try {
      // TODO: Implement actual notification permission request
      // For now, simulate permission request
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        'Permissions Granted',
        'You\'ll now receive important notifications',
        [{ text: 'Continue', onPress: onGrant }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Unable to request permissions. Please enable them in Settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRequesting(false);
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
            <Text style={styles.icon}>🔔</Text>
          </View>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            Stay in the Loop
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Get notified about important emails and upcoming events
          </Text>
        </Animated.View>

        {/* Notification Types */}
        <View style={styles.notificationTypes}>
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            style={[
              styles.notificationCard,
              {
                backgroundColor: themeColors.backgroundSecondary,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={styles.notificationEmoji}>⚡</Text>
            <View style={styles.notificationContent}>
              <Text style={[styles.notificationTitle, { color: themeColors.textPrimary }]}>
                Urgent Emails
              </Text>
              <Text style={[styles.notificationDescription, { color: themeColors.textSecondary }]}>
                Get alerted when VIP or urgent emails arrive
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            style={[
              styles.notificationCard,
              {
                backgroundColor: themeColors.backgroundSecondary,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={styles.notificationEmoji}>📅</Text>
            <View style={styles.notificationContent}>
              <Text style={[styles.notificationTitle, { color: themeColors.textPrimary }]}>
                Event Reminders
              </Text>
              <Text style={[styles.notificationDescription, { color: themeColors.textSecondary }]}>
                Never miss a meeting or deadline
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(400).duration(400)}
            style={[
              styles.notificationCard,
              {
                backgroundColor: themeColors.backgroundSecondary,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={styles.notificationEmoji}>✅</Text>
            <View style={styles.notificationContent}>
              <Text style={[styles.notificationTitle, { color: themeColors.textPrimary }]}>
                Action Items
              </Text>
              <Text style={[styles.notificationDescription, { color: themeColors.textSecondary }]}>
                Reminders for tasks that need your attention
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            style={[
              styles.notificationCard,
              {
                backgroundColor: themeColors.backgroundSecondary,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={styles.notificationEmoji}>📊</Text>
            <View style={styles.notificationContent}>
              <Text style={[styles.notificationTitle, { color: themeColors.textPrimary }]}>
                Daily Digest
              </Text>
              <Text style={[styles.notificationDescription, { color: themeColors.textSecondary }]}>
                Morning summary of what's ahead for the day
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Control Info */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(400)}
          style={[
            styles.infoCard,
            {
              backgroundColor: themeColors.primary + '10',
              borderColor: themeColors.primary + '30',
            },
          ]}
        >
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
            💡 You can customize notification preferences anytime in Settings
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: themeColors.background }]}>
        <TouchableOpacity
          style={[
            styles.enableButton,
            { backgroundColor: themeColors.primary },
            isRequesting && styles.enableButtonDisabled,
          ]}
          onPress={handleRequestPermissions}
          disabled={isRequesting}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Enable notifications"
        >
          <Text style={styles.enableButtonText}>
            {isRequesting ? 'Requesting...' : 'Enable Notifications'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          disabled={isRequesting}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Skip notifications"
        >
          <Text style={[styles.skipButtonText, { color: themeColors.textSecondary }]}>
            Not now
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
  notificationTypes: {
    marginBottom: spacing.xl,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  notificationEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  notificationDescription: {
    fontSize: typography.sizes.base,
    lineHeight: 22,
  },
  infoCard: {
    padding: spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.lg,
    borderWidth: 1,
  },
  infoText: {
    fontSize: typography.sizes.base,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  enableButton: {
    height: 56,
    borderRadius: designSystem.sizing.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  enableButtonDisabled: {
    opacity: 0.6,
  },
  enableButtonText: {
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

export default PermissionsScreen;
