import React from 'react';
import { View, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import { Message, ThemeColors } from '../types';

interface MessageProps {
  message: Message;
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
}

const MessageBubble: React.FC<MessageProps> = ({ message, colors, style }) => {
  const isUser = message.sender === 'user';
  
  return (
    <View 
      style={[
        styles.container,
        {
          alignSelf: isUser ? 'flex-end' : 'flex-start',
        },
        style,
      ]}
    >
      <View 
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.messageSent : colors.messageReceived,
            borderTopLeftRadius: isUser ? 12 : 4,
            borderTopRightRadius: isUser ? 4 : 12,
            marginLeft: isUser ? '15%' : 0,
            marginRight: isUser ? 0 : '15%',
          },
        ]}
      >
        <Text 
          style={[
            styles.text,
            {
              color: isUser ? colors.textPrimary : colors.textPrimary,
              textAlign: isUser ? 'right' : 'left',
            },
          ]}
          textBreakStrategy="highQuality"
          allowFontScaling={true}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '85%',
    minWidth: '20%',
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
});

export default MessageBubble;
