import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { designSystem } from '../../design-system';

interface ChatMessageProps extends ViewProps {
  message: string;
  isFromUser: boolean;
  timestamp?: string;
  isLoading?: boolean;
  className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isFromUser,
  timestamp,
  isLoading = false,
  style,
  ...props
}) => {
  const colors = designSystem.colors.light;
  
  // Message bubble styles based on sender
  const bubbleStyle = {
    backgroundColor: isFromUser ? colors.messageSent : colors.messageReceived,
    alignSelf: isFromUser ? 'flex-end' : 'flex-start',
    maxWidth: '80%',
    borderRadius: designSystem.borderRadius.message,
    paddingVertical: designSystem.spacing.chatMessagePadding,
    paddingHorizontal: designSystem.spacing['4'],
    marginVertical: designSystem.spacing.chatMessageMargin,
    ...designSystem.shadows.subtle,
  };

  const textStyle = {
    fontSize: designSystem.typography.sizes.chatMessage.fontSize,
    lineHeight: designSystem.typography.sizes.chatMessage.lineHeight,
    fontWeight: designSystem.typography.sizes.chatMessage.fontWeight,
    color: colors.textPrimary,
  };

  const timestampStyle = {
    fontSize: designSystem.typography.sizes.chatTime.fontSize,
    lineHeight: designSystem.typography.sizes.chatTime.lineHeight,
    color: colors.textTertiary,
    marginTop: designSystem.spacing['1'],
    textAlign: isFromUser ? 'right' : 'left',
  };

  return (
    <View style={[{ alignSelf: 'stretch' }, style]} {...props}>
      <View style={bubbleStyle}>
        {isLoading ? (
          <Text style={[textStyle, { fontStyle: 'italic', color: colors.textSecondary }]}>
            Typing...
          </Text>
        ) : (
          <>
            <Text style={textStyle}>
              {message}
            </Text>
            {timestamp && (
              <Text style={timestampStyle}>
                {timestamp}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
};
