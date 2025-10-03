import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import Animated, { 
  FadeInUp, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';
import { designSystem } from '../../design-system';
import { formatTimestamp, parseMarkdown, type FormattedTime } from '../../utils/messageUtils';

interface AssistantMessageProps {
  message: string;
  timestamp: number | Date;
  onPress?: () => void;
  onLongPress?: () => void;
  showAvatar?: boolean;
  avatar?: React.ReactNode;
  animationDelay?: number;
  customContent?: React.ReactNode;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  timestamp,
  onPress,
  onLongPress,
  showAvatar = true,
  avatar,
  animationDelay = 0,
  customContent,
}) => {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [formattedTime, setFormattedTime] = useState<FormattedTime>(() => 
    formatTimestamp(timestamp)
  );

  // Update timestamp periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setFormattedTime(formatTimestamp(timestamp));
    }, 30000);

    return () => clearInterval(interval);
  }, [timestamp]);

  // Parse markdown for text formatting
  const parsedTokens = parseMarkdown(message);

  // Default assistant avatar
  const defaultAvatar = (
    <View style={{
      width: 28,
      height: 28,
      borderRadius: designSystem.borderRadius.avatar,
      backgroundColor: designSystem.colors.light.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: designSystem.spacing['2'],
    }}>
      <Text style={{
        fontSize: 12,
        color: designSystem.colors.light.primary,
        fontWeight: '600' as const,
      }}>
        AI
      </Text>
    </View>
  );

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setShowTimestamp(!showTimestamp);
    }
  };

  const colors = designSystem.colors.light;

  return (
    <Animated.View
      entering={FadeInUp.duration(designSystem.animations.duration.fast).delay(animationDelay)}
      style={[
        {
          alignSelf: 'flex-start',
          maxWidth: '85%', // Slightly wider than user messages for readability
          marginVertical: designSystem.spacing.chatMessageMargin,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Avatar */}
        {showAvatar && (
          <View style={{ marginTop: designSystem.spacing['1'] }}>
            {avatar || defaultAvatar}
          </View>
        )}
        
        {/* Message Bubble */}
        <Pressable
          onPress={handlePress}
          onLongPress={onLongPress}
          style={({ pressed }) => [
            {
              backgroundColor: colors.messageReceived,
              borderRadius: designSystem.borderRadius.message,
              paddingVertical: designSystem.spacing.chatMessagePadding,
              paddingHorizontal: designSystem.spacing['4'],
              flex: 1,
              opacity: pressed ? 0.95 : 1,
            },
          ]}
        >
          {/* Custom Content or Parsed Message */}
          {customContent ? (
            customContent
          ) : (
            <View>
              {/* Markdown Parsed Content */}
              <Text style={{
                fontSize: designSystem.typography.sizes.chatMessage.fontSize,
                lineHeight: designSystem.typography.sizes.chatMessage.lineHeight,
                color: colors.textPrimary,
                fontWeight: '400' as const,
              }}>
                {parsedTokens.map((token, index) => {
                  switch (token.type) {
                    case 'bold':
                      return (
                        <Text key={index} style={{ fontWeight: '600' as const }}>
                          {token.content}
                        </Text>
                      );
                    case 'italic':
                      return (
                        <Text key={index} style={{ fontStyle: 'italic' }}>
                          {token.content}
                        </Text>
                      );
                    case 'code':
                      return (
                        <Text key={index} style={{
                          backgroundColor: colors.surfaceSecondary,
                          fontFamily: 'monospace',
                          fontSize: 14,
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}>
                          {token.content}
                        </Text>
                      );
                    default:
                      return token.content;
                  }
                })}
              </Text>
              
              {/* Timestamp */}
              <View style={{
                marginTop: designSystem.spacing['1'],
                alignItems: 'flex-start',
              }}>
                <Text style={{
                  fontSize: designSystem.typography.sizes.chatTime.fontSize,
                  lineHeight: designSystem.typography.sizes.chatTime.lineHeight,
                  color: showTimestamp ? colors.textSecondary : colors.textTertiary,
                  fontWeight: '400' as const,
                }}>
                  {formattedTime.relative}
                </Text>
                
                {showTimestamp && (
                  <Text style={{
                    fontSize: designSystem.typography.sizes.label.fontSize,
                    color: colors.textTertiary,
                    marginTop: designSystem.spacing['0.5'],
                  }}>
                    {formattedTime.absolute}
                  </Text>
                )}
              </View>
            </View>
          )}
          
          {/* Action Button Container */}
          {onPress && (
            <View style={{
              flexDirection: 'row',
              marginTop: designSystem.spacing['3'],
              gap: designSystem.spacing['2'],
            }}>
              <TouchableOpacity
                onPress={onPress}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: designSystem.spacing['1.5'],
                  paddingHorizontal: designSystem.spacing['3'],
                  borderRadius: designSystem.borderRadius.sm,
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: designSystem.typography.sizes.label.fontSize,
                  color: '#FFFFFF',
                  fontWeight: '500' as const,
                }}>
                  View Details
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
};

/* 
USAGE EXAMPLES:
--------------
Basic usage:
<AssistantMessage
  message="Found **3 emails** from Sarah Chen this week"
  timestamp={Date.now()}
/>

With markdown:
<AssistantMessage
  message="Here are your recent emails:\n\n**Important:** *Budget review* needed\n- Meeting notes\n- Q4 proposal\n\nUse `get_emails` to fetch more"
  timestamp={Date.now()}
/>

With custom content:
<AssistantMessage
  message="Found emails"
  timestamp={Date.now()}
  customContent={
    <View>
      <Text>Email List:</Text>
      {/* Custom email list component */}
    </View>
  }
/>
*/

/* 
STYLING EXPLANATION:
-------------------
- Aligned left (alignSelf: 'flex-start') for assistant messages
- Max width 85% (vs 80% for user) to accommodate longer responses
- Background uses messageReceived color for differentiation from user messages
- Avatar on left side (28px) with AI initials, customizable via prop
- Markdown parsing supports **bold**, *italic*, and `code` formatting
- Code blocks get subtle background styling with monospace font
- Action buttons appear below message content when onPress is provided
- Smooth fade-in animation with configurable delay
- Avatar stays fixed during message bubble animations
- Typography optimized for readability with chat-specific font sizes
*/
