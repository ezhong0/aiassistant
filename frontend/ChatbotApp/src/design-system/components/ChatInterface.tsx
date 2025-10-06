import React, { useState } from 'react';
import { View, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { designSystem } from '../index';
import { ChatMessage } from './ChatMessage';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

interface Message {
  id: string;
  text: string;
  isFromUser: boolean;
  timestamp: string;
}

interface ChatInterfaceResponse {
  success: boolean;
  message: string;
  conversation_id: string;
  tools_used: string[];
  requires_confirmation: boolean;
  metadata: any;
}

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your email intelligence assistant. I can help you find emails, analyze your inbox, and manage your calendar. What would you like to know?",
      isFromUser: false,
      timestamp: '12:34 PM',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isFromUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      // const response = await chatAPI.sendMessage({
      //   message: inputText,
      //   conversation_history: messages.map(msg => ({
      //     role: msg.isFromUser ? 'user' : 'assistant',
      //     content: msg.text,
      //     timestamp: msg.timestamp
      //   }))
      // });

      // Mock response for now
      const mockResponse: ChatInterfaceResponse = {
        success: true,
        message: `I found 3 emails related to "${inputText}" in your inbox. Would you like me to summarize them or show specific details?`,
        conversation_id: 'conv_123',
        tools_used: ['email_search'],
        requires_confirmation: false,
        metadata: { processing_time: 1.2 }
      };

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: mockResponse.message,
        isFromUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setTimeout(() => {
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1500);

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isFromUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        backgroundColor: designSystem.colors.light.surface,
        paddingTop: Platform.OS === 'ios' ? 44 : 24,
        paddingBottom: designSystem.spacing['4'],
        paddingHorizontal: designSystem.spacing['4'],
        borderBottomWidth: 1,
        borderBottomColor: designSystem.colors.light.borderSecondary,
        ...designSystem.shadows.subtle,
      }}>
        <Card variant="flat" padding="none" style={{ backgroundColor: 'transparent' }}>
          <Text variant="h3" color="primary">Email Assistant</Text>
          <Text variant="caption" color="secondary">Powered by AI • Always learning</Text>
        </Card>
      </View>

      {/* Messages List */}
      <ScrollView 
        style={{ 
          flex: 1,
          backgroundColor: designSystem.colors.light.backgroundSecondary,
        }}
        contentContainerStyle={{
          padding: designSystem.spacing['4'],
          paddingBottom: designSystem.spacing['8'],
        }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message.text}
            isFromUser={message.isFromUser}
            timestamp={message.timestamp}
          />
        ))}
        {isLoading && (
          <ChatMessage
            message=""
            isFromUser={false}
            isLoading={true}
          />
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={{
        backgroundColor: designSystem.colors.light.surface,
        paddingHorizontal: designSystem.spacing['4'],
        paddingVertical: designSystem.spacing['4'],
        borderTopWidth: 1,
        borderTopColor: designSystem.colors.light.borderSecondary,
        ...designSystem.shadows.subtle,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: designSystem.spacing['3'],
        }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: designSystem.colors.light.backgroundSecondary,
              borderRadius: designSystem.borderRadius.input,
              paddingVertical: designSystem.spacing['3'],
              paddingHorizontal: designSystem.spacing['4'],
              fontSize: designSystem.typography.sizes.body.fontSize,
              color: designSystem.colors.light.textPrimary,
              borderWidth: 1,
              borderColor: designSystem.colors.light.borderSecondary,
              minHeight: designSystem.spacing.chatInputHeight,
              maxHeight: 100,
            }}
            placeholder="Ask me about your emails..."
            placeholderTextColor={designSystem.colors.light.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!isLoading}
          />
          
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
            style={{
              backgroundColor: inputText.trim() && !isLoading 
                ? designSystem.colors.light.primary 
                : designSystem.colors.light.borderSecondary,
              borderRadius: designSystem.borderRadius.input,
              padding: designSystem.spacing['3'],
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: designSystem.spacing.chatInputHeight,
              minHeight: designSystem.spacing.chatInputHeight,
            }}
            activeOpacity={0.8}
          >
            <Text 
              variant="label" 
              color={inputText.trim() && !isLoading ? "primary" : "disabled"}
              style={{ fontWeight: '600' }}
            >
              {isLoading ? '⌄' : '→'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Quick Actions */}
        <View style={{
          flexDirection: 'row',
          marginTop: designSystem.spacing['3'],
          gap: designSystem.spacing['2'],
        }}>
          <Button
            title="My emails"
            variant="secondary"
            size="sm"
            onPress={() => setInputText('Show me my emails from today')}
          />
          <Button
            title="Schedule"
            variant="secondary"
            size="sm"
            onPress={() => setInputText('What\'s on my calendar today?')}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
