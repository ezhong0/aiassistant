import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  placeholder = "Type a message..."
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  return (
    <View style={{
      flexDirection: 'row',
      padding: 16,
      backgroundColor: 'white',
      borderTopWidth: 1,
      borderTopColor: '#E5E5E5',
    }}>
      <TextInput
        style={{
          flex: 1,
          height: 40,
          borderWidth: 1,
          borderColor: '#DDD',
          borderRadius: 20,
          paddingHorizontal: 16,
          marginRight: 12,
          fontSize: 16,
        }}
        placeholder={placeholder}
        value={text}
        onChangeText={setText}
        multiline={false}
      />
      
      <TouchableOpacity
        onPress={handleSend}
        disabled={!text.trim()}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: text.trim() ? '#007AFF' : '#DDD',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
        }}>
          ↑
        </Text>
      </TouchableOpacity>
    </View>
  );
};
