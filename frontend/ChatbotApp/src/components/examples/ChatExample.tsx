import React, { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { UserMessage, AssistantMessage, SystemMessage } from '../messages';
import { designSystem } from '../../design-system';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  loading?: boolean;
}

export const ChatExample: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'Connected to Work Gmail',
      timestamp: Date.now() - 120000,
    },
    {
      id: '2',
      type: 'system',
      content: 'Syncing recent emails...',
      timestamp: Date.now() - 90000,
    },
    {
      id: '3',
      type: 'assistant',
      content: "Hi! I'm your email intelligence assistant. I can help you find emails, analyze your inbox, and manage your calendar. What would you like to know?",
      timestamp: Date.now() - 60000,
    },
    {
      id: '4',
      type: 'user',
      content: 'Find emails from Sarah this week',
      timestamp: Date.now() - 30000,
    },
    {
      id: '5',
      type: 'assistant',
      content: "Found **3 emails** from Sarah Chen:\n\n• **Important:** *Budget review* meeting notes\n• Project update on Q4 deliverables  \n• Conference room booking for next week\n\nUse `detailed_view` to see full contents of any email.",
      timestamp: Date.now() - 15000,
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [addingMessage, setAddingMessage] = useState(false);

  const addMessage = (type: 'user' | 'assistant' | 'system', content: string, loading = false) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: Date.now(),
      loading,
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    // Add user message
    addMessage('user', inputText);
    const userMessage = inputText;
    setInputText('');
    setAddingMessage(true);

    // Simulate assistant response
    setTimeout(() => {
      let response: string;
      
      if (userMessage.includes('email') || userMessage.includes('Sarah')) {
        response = "Here are the search results for Sarah's emails:\n\n**This Week:**\n- Meeting notes from Monday\n- Budget proposal updates\n- Status report deadline\n\nWould you like me to show the content of any specific email?";
      } else if (userMessage.includes('calendar') || userMessage.includes('schedule')) {
        response = "Your calendar for **today**:\n\n• 9:00 AM - Team standup\n• 11:30 AM - Client call *important*\n• 2:00 PM - Project review\n• 4:00 PM - Free time\n\nNeed to schedule something new?";
      } else if (userMessage.includes('urgent') || userMessage.includes('priority')) {
        response = "⚠️ **High Priority Items Found:**\n\n1. **Deadline approaching**: Budget proposal due tomorrow\n2. **Action required**: Review contract from Sarah\n3. **Meeting prep**: Q4 planning session at 2 PM\n\nI recommend starting with the budget proposal.";
      } else {
        response = `I understand you're looking for "${userMessage}". Let me analyze your emails and calendar to find relevant information...`;
      }

      addMessage('assistant', response);
      setAddingMessage(false);
    }, 2000);

    // Add loading message
    setTimeout(() => {
      if (addingMessage) {
        addMessage('assistant', 'Searching your emails...', true);
      }
    }, 500);
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const animationDelay = index * 100; // Stagger animations

    switch (message.type) {
      case 'user':
        return (
          <UserMessage
            key={message.id}
            message={message.content}
            timestamp={message.timestamp}
            isLoading={message.loading}
            animationDelay={animationDelay}
            onLongPress={() => console.log('Long press options')}
          />
        );
        
      case 'assistant':
        return (
          <AssistantMessage
            key={message.id}
            message={message.content}
            timestamp={message.timestamp}
            animationDelay={animationDelay}
            onPress={() => console.log('View email details')}
          />
        );
        
      case 'system':
        return (
          <SystemMessage
            key={message.id}
            message={message.content}
            timestamp={message.timestamp}
            type="info"
            animationDelay={animationDelay}
            autoHideAfter={message.content.includes('Syncing') ? 3000 : 0}
          />
        );
        
      default:
        return null;
    }
  };

  const quickActions = [
    "Show urgent emails",
    "What's on my calendar?",
    "Find emails from John",
    "Schedule meeting tomorrow"
  ];

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: designSystem.colors.light.backgroundSecondary }} 
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
      }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{
            fontSize: designSystem.typography.sizes.h3.fontSize,
            fontWeight: designSystem.typography.sizes.h3.fontWeight,
            color: designSystem.colors.light.textPrimary,
          }}>
            Email Intelligence Assistant
          </Text>
          <Text style={{
            fontSize: designSystem.typography.sizes.caption.fontSize,
            color: designSystem.colors.light.textSecondary,
            marginTop: designSystem.spacing['1'],
          }}>
            Powered by AI • Always learning
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: designSystem.spacing['4'],
          paddingBottom: designSystem.spacing['8'],
        }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message, index) => renderMessage(message, index))}
      </ScrollView>

      {/* Quick Actions */}
      <View style={{
        backgroundColor: designSystem.colors.light.surface,
        paddingHorizontal: designSystem.spacing['4'],
        paddingVertical: designSystem.spacing['2'],
        borderTopWidth: 1,
        borderTopColor: designSystem.colors.light.borderSecondary,
      }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {quickActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setInputText(action)}
            style={{
              backgroundColor: designSystem.colors.light.primaryLight,
              paddingVertical: designSystem.spacing['1.5'],
              paddingHorizontal: designSystem.spacing['3'],
              borderRadius: designSystem.borderRadius.md,
              marginRight: designSystem.spacing['2'],
            }}
            activeOpacity={0.8}
          >
            <Text style={{
              fontSize: designSystem.typography.sizes.label.fontSize,
              color: designSystem.colors.light.primary,
              fontWeight: '500',
            }}>
              {action}
            </Text>
          </TouchableOpacity>
        ))}
        </ScrollView>
      </View>

      {/* Input Area */}
      <View style={{
        backgroundColor: designSystem.colors.light.surface,
        paddingHorizontal: designSystem.spacing['4'],
        paddingVertical: designSystem.spacing['4'],
        borderTopWidth: 1,
        borderTopColor: designSystem.colors.light.borderSecondary,
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
            editable={!addingMessage}
          />
          
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!inputText.trim() || addingMessage}
            style={{
              backgroundColor: inputText.trim() && !addingMessage 
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
            <Text style={{
              fontSize: designSystem.typography.sizes.label.fontSize,
              color: inputText.trim() && !addingMessage 
                ? '#FFFFFF' 
                : designSystem.colors.light.textTertiary,
              fontWeight: '600' as const,
            }}>
              {addingMessage ? '⌄' : '→'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
