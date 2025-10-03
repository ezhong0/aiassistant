import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  colors: any;
  style?: any;
}

export default function MessageBubble({ message, colors, style }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  
  return (
    <View 
      style={[
        styles.container,
        {
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          backgroundColor: isUser ? colors.primary : colors.backgroundSecondary,
        },
        style
      ]}
    >
      <Text 
        style={[
          styles.text,
          {
            color: isUser ? 'white' : colors.textPrimary,
          }
        ]}
      >
        {message.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
});
