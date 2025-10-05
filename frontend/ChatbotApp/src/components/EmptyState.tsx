/**
 * Empty State Component
 *
 * Contextual empty states for different scenarios:
 * - First conversation
 * - No internet
 * - Error state
 * - Loading state
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { designSystem } from '../design-system';

const { colors, spacing, typography } = designSystem;

export type EmptyStateType = 'first-conversation' | 'offline' | 'error' | 'loading';

interface EmptyStateProps {
  type: EmptyStateType;
  isDarkMode?: boolean;
  onAction?: () => void;
  actionText?: string;
  errorMessage?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  isDarkMode = false,
  onAction,
  actionText,
  errorMessage,
}) => {
  const themeColors = isDarkMode ? colors.dark : colors.light;

  const getContent = () => {
    switch (type) {
      case 'first-conversation':
        return {
          icon: '🤖',
          title: 'Hey! I\'m your AI assistant.',
          subtitle:
            'I can help you:\n• Find urgent emails\n• Check your schedule\n• Draft responses\n• And much more!',
          action: null,
        };

      case 'offline':
        return {
          icon: '📡',
          title: 'You\'re offline',
          subtitle: 'Messages will be sent when you\'re back online.',
          action: actionText || 'Retry Connection',
        };

      case 'error':
        return {
          icon: '⚠️',
          title: 'Something went wrong',
          subtitle: errorMessage || 'We encountered an unexpected error.',
          action: actionText || 'Try Again',
        };

      case 'loading':
        return {
          icon: '⏳',
          title: 'Loading...',
          subtitle: 'Please wait a moment.',
          action: null,
        };

      default:
        return {
          icon: '💬',
          title: 'Start a conversation',
          subtitle: 'Ask me anything!',
          action: null,
        };
    }
  };

  const content = getContent();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{content.icon}</Text>

      <Text style={[styles.title, { color: themeColors.textPrimary }]}>
        {content.title}
      </Text>

      <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
        {content.subtitle}
      </Text>

      {content.action && onAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
          onPress={onAction}
          accessible={true}
          accessibilityLabel={content.action}
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>{content.action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.base,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  actionButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});

export default EmptyState;
