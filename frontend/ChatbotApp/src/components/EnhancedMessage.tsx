/**
 * Enhanced Message Component
 *
 * Improved message bubble with:
 * - Status indicators (sending, sent, failed)
 * - Timestamps with smart formatting
 * - Retry button for failed messages
 * - Long-press menu
 * - Accessibility support
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ViewStyle,
  StyleProp,
} from 'react';
import { StoredMessage } from '../services/storage.service';
import { designSystem } from '../design-system';

const { colors, spacing, typography } = designSystem;

interface EnhancedMessageProps {
  message: StoredMessage;
  isDarkMode?: boolean;
  onRetry?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (text: string) => void;
  style?: StyleProp<ViewStyle>;
}

const EnhancedMessage: React.FC<EnhancedMessageProps> = ({
  message,
  isDarkMode = false,
  onRetry,
  onDelete,
  onCopy,
  style,
}) => {
  const themeColors = isDarkMode ? colors.dark : colors.light;
  const isUser = message.sender === 'user';
  const isAssistant = message.sender === 'assistant';
  const isSystem = message.sender === 'system';

  // Format timestamp
  const formattedTime = useMemo(() => {
    const date = new Date(message.timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [message.timestamp]);

  // Status indicator
  const StatusIndicator = () => {
    if (!isUser) return null;

    switch (message.status) {
      case 'sending':
        return (
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: themeColors.textTertiary }]} />
            <View style={[styles.statusDot, { backgroundColor: themeColors.textTertiary }]} />
          </View>
        );
      case 'sent':
        return (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: themeColors.success }]}>✓✓</Text>
          </View>
        );
      case 'failed':
        return (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: themeColors.error }]}>!</Text>
          </View>
        );
      default:
        return null;
    }
  };

  // Handle long press
  const handleLongPress = () => {
    const options: string[] = ['Copy'];

    if (message.status === 'failed' && onRetry) {
      options.push('Retry');
    }

    if (onDelete) {
      options.push('Delete');
    }

    options.push('Cancel');

    Alert.alert('Message Options', undefined, [
      {
        text: 'Copy',
        onPress: () => onCopy?.(message.text),
      },
      ...(message.status === 'failed' && onRetry
        ? [
            {
              text: 'Retry',
              onPress: () => onRetry(message.id),
            },
          ]
        : []),
      ...(onDelete
        ? [
            {
              text: 'Delete',
              onPress: () => onDelete(message.id),
              style: 'destructive' as const,
            },
          ]
        : []),
      {
        text: 'Cancel',
        style: 'cancel' as const,
      },
    ]);
  };

  // Bubble colors
  const bubbleColor = isUser
    ? themeColors.messageSent
    : isAssistant
    ? themeColors.messageReceived
    : themeColors.warning + '20'; // System messages

  const textColor = isUser ? '#FFFFFF' : themeColors.textPrimary;

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={[styles.container, { alignSelf: isUser ? 'flex-end' : 'flex-start' }, style]}
      accessible={true}
      accessibilityLabel={`${isUser ? 'You' : 'Assistant'} said: ${message.text}`}
      accessibilityHint="Long press for options"
      accessibilityRole="text"
    >
      {/* Assistant Avatar */}
      {isAssistant && (
        <View style={[styles.avatar, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.avatarText}>🤖</Text>
        </View>
      )}

      <View style={{ maxWidth: '85%' }}>
        {/* Message Bubble */}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              borderTopLeftRadius: isUser ? 16 : 4,
              borderTopRightRadius: isUser ? 4 : 16,
            },
          ]}
        >
          <Text
            style={[styles.text, { color: textColor }]}
            selectable={true}
            textBreakStrategy="highQuality"
          >
            {message.text}
          </Text>
        </View>

        {/* Timestamp & Status */}
        <View
          style={[
            styles.footer,
            { alignSelf: isUser ? 'flex-end' : 'flex-start' },
          ]}
        >
          <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>
            {formattedTime}
          </Text>
          <StatusIndicator />
        </View>

        {/* Retry Button for Failed Messages */}
        {message.status === 'failed' && onRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: themeColors.error }]}
            onPress={() => onRetry(message.id)}
            accessible={true}
            accessibilityLabel="Retry sending message"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-end',
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
    padding: spacing.md,
    borderRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  text: {
    fontSize: typography.sizes.base,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    marginRight: spacing.xs,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
});

export default EnhancedMessage;
