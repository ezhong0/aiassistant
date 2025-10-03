import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { 
  FadeInUp, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';
import { designSystem } from '../../design-system';
import { formatTimestamp, type FormattedTime } from '../../utils/messageUtils';

interface UserMessageProps {
  message: string;
  timestamp: number | Date;
  onPress?: () => void;
  onLongPress?: () => void;
  isLoading?: boolean;
  animationDelay?: number;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  timestamp,
  onPress,
  onLongPress,
  isLoading = false,
  animationDelay = 0,
}) => {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [formattedTime, setFormattedTime] = useState<FormattedTime>(() => 
    formatTimestamp(timestamp)
  );

  // Update timestamp periodically for relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setFormattedTime(formatTimestamp(timestamp));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [timestamp]);

  // Animated bubble style
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isLoading ? 0.7 : 1, { duration: 200 }),
  }));

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
          alignSelf: 'flex-end',
          maxWidth: '80%',
          marginVertical: designSystem.spacing.chatMessageMargin,
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          {
            backgroundColor: colors.messageSent,
            borderRadius: designSystem.borderRadius.message,
            paddingVertical: designSystem.spacing.chatMessagePadding,
            paddingHorizontal: designSystem.spacing['4'],
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Animated.View style={bubbleStyle}>
          {/* Message Content */}
          <Text style={{
            fontSize: designSystem.typography.sizes.chatMessage.fontSize,
            lineHeight: designSystem.typography.sizes.chatMessage.lineHeight,
            color: colors.textPrimary,
            fontWeight: '400' as const,
          }}>
            {isLoading ? 'Sending...' : message}
          </Text>
          
          {/* Timestamp */}
          <View style={{
            marginTop: designSystem.spacing['1'],
            alignItems: 'flex-end',
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
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

/* 
USAGE EXAMPLE:
--------------
<UserMessage
  message="Find emails from Sarah this week"
  timestamp={Date.now() - 300000} // 5 minutes ago
  onPress={() => console.log('Quick action')}
  onLongPress={() => console.log('Show options')}
  isLoading={false}
/>
*/

/* 
STYLING EXPLANATION:
-------------------
- Aligned right (alignSelf: 'flex-end') for user messages
- Max width 80% to prevent overly wide messages
- Background uses messageSent color from design system for subtle differentiation
- Message radius uses the semantic 'message' radius (16px) for chat bubbles
- Padding uses semantic chat message padding (12px) for consistency
- Typography uses chat-specific sizes for optimal mobile readability
- Timestamp shows relative time by default, absolute time on press
- Loading state reduces opacity (70%) with smooth animation
- Press feedback uses native Pressable opacity change (80% when pressed)
- Subtle fade-in animation (FadeInUp) with customizable delay for staggered appearance
*/
