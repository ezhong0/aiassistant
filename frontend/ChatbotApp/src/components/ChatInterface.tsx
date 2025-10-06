import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  TouchableOpacity,
  Alert
} from 'react-native';
import { designSystem } from '../design-system';
import { ChatInput } from './ChatInput';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
}

interface ChatInterfaceProps {
  onSendMessage?: (message: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  showWelcomeMessage?: boolean;
  welcomeMessage?: string;
  maxMessages?: number;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  isLoading = false,
  placeholder,
  autoFocus = false,
  showWelcomeMessage = true,
  welcomeMessage = "Hi! I'm your AI assistant. I can help you manage your emails and calendar. What would you like to know?",
  maxMessages = 100,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const colors = designSystem.colors.light;

  // Add welcome message on mount
  useEffect(() => {
    if (showWelcomeMessage && messages.length === 0) {
      const welcomeMsg: Message = {
        id: 'welcome',
        text: welcomeMessage,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages([welcomeMsg]);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle message sending
  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoadingMessage(true);

    try {
      // Call the provided onSendMessage function or simulate a response
      if (onSendMessage) {
        await onSendMessage(text);
        
        // Add assistant response (this would normally come from the API response)
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: `I've received your message: "${text}"`,
          sender: 'assistant',
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Simulate assistant thinking
        setTimeout(() => {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: `Thanks for your message! I'm working on: "${text}"`,
            sender: 'assistant',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }, 1500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoadingMessage(false);
    }

    // Trim messages if over limit
    setMessages(prev => {
      if (prev.length > maxMessages) {
        return prev.slice(-maxMessages);
      }
      return prev;
    });
  };

  // Clear chat
  const clearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            if (showWelcomeMessage) {
              const welcomeMsg: Message = {
                id: 'welcome',
                text: welcomeMessage,
                sender: 'assistant',
                timestamp: new Date(),
              };
              setMessages([welcomeMsg]);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={{
        paddingHorizontal: designSystem.spacing['6'],
        paddingVertical: designSystem.spacing['4'],
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSecondary,
      }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: designSystem.typography.sizes.h3.fontSize,
            fontWeight: designSystem.typography.sizes.h3.fontWeight as any,
            color: colors.textPrimary,
          }}>
            AI Assistant
          </Text>
          
          <TouchableOpacity
            onPress={clearChat}
            style={{
              paddingHorizontal: designSystem.spacing['3'],
              paddingVertical: designSystem.spacing['2'],
              borderRadius: 6,
              backgroundColor: colors.backgroundSecondary,
            }}
            accessible={true}
            accessibilityLabel="Clear chat"
            accessibilityHint="Tap to clear all messages"
            accessibilityRole="button"
          >
            <Text style={{
              fontSize: designSystem.typography.sizes.labelMedium.fontSize,
              color: colors.textSecondary,
              fontWeight: '500' as const,
            }}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: designSystem.spacing['4'],
          paddingBottom: designSystem.spacing['8'],
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLoading={isLoadingMessage && index === messages.length - 1}
          />
        ))}
      </ScrollView>

      {/* Chat Input */}
      <View style={{
        paddingHorizontal: designSystem.spacing['6'],
        paddingVertical: designSystem.spacing['4'],
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.borderSecondary,
      }}>
        <ChatInput
          onSendMessage={handleSendMessage}
          placeholder={placeholder}
          disabled={isLoadingMessage || isLoading}
          autoFocus={autoFocus}
          focusOnAppear={true}
          showCharacterCount={true}
          characterLimit={1000}
          onTextChange={(text) => {
            // Could add typing indicators or character count updates here
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
  isLoading?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLoading }) => {
  const colors = designSystem.colors.light;
  const isUser = message.sender === 'user';

  if (isLoading) {
    return (
      <View style={{
        flexDirection: 'row',
        marginBottom: designSystem.spacing['4'],
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}>
        {!isUser && (
          <View style={{
            width: 32,
            height: 32,
            borderRadius: designSystem.borderRadius.full,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: designSystem.spacing['3'],
          }}>
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              AI
            </Text>
          </View>
        )}
        
        <View style={{
          backgroundColor: colors.backgroundSecondary,
          padding: designSystem.spacing['3'],
          borderRadius: designSystem.borderRadius.lg,
          maxWidth: '70%',
        }}>
          <Text style={{
            fontSize: designSystem.typography.sizes.body.fontSize,
            color: colors.textSecondary,
            fontStyle: 'italic',
          }}>
            Thinking...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{
      flexDirection: 'row',
      marginBottom: designSystem.spacing['4'],
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      {!isUser && (
        <View style={{
          width: 32,
          height: 32,
          borderRadius: designSystem.borderRadius.full,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: designSystem.spacing['3'],
        }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
            AI
          </Text>
        </View>
      )}
      
      <View style={{
        backgroundColor: isUser ? colors.primary : colors.backgroundSecondary,
        padding: designSystem.spacing['4'],
        borderRadius: designSystem.borderRadius.lg,
        maxWidth: '80%', // Increased from 70% to 80% for better text visibility
        minWidth: '30%', // Added minimum width
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
      }}>
        <Text 
          style={{
            fontSize: designSystem.typography.sizes.body.fontSize,
            color: isUser ? '#FFFFFF' : colors.textPrimary,
            lineHeight: designSystem.typography.sizes.body.lineHeight,
          }}
          numberOfLines={0} // Allow unlimited lines for full message
        >
          {message.text}
        </Text>
        
        <Text style={{
          fontSize: designSystem.typography.sizes.labelSmall.fontSize,
          color: isUser ? 'rgba(255, 255, 255, 0.7)' : colors.textTertiary,
          marginTop: designSystem.spacing['2'],
        }}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
      
      {isUser && (
        <View style={{
          width: 32,
          height: 32,
          borderRadius: designSystem.borderRadius.full,
          backgroundColor: colors.backgroundTertiary,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: designSystem.spacing['3'],
        }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 'bold' }}>
            You
          </Text>
        </View>
      )}
    </View>
  );
};

/*
INTEGRATION EXAMPLE:
-------------------
<ChatInterface
  onSendMessage={async (message) => {
    // Call your API here
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return response.json();
  }}
  placeholder="Ask about your emails and calendar..."
  autoFocus={true}
  showWelcomeMessage={true}
/>

ACCESSIBILITY FEATURES:
----------------------
- All interactive elements have accessibility labels
- Keyboard navigation support
- Screen reader friendly
- Proper semantic roles
- Focus management
- Clear loading states

DESIGN FEATURES:
---------------
- Modern chat bubble design
- Smooth auto-scrolling
- Typing indicators
- Character count
- Auto-expanding input
- Clear chat functionality
- Responsive layout
- Keyboard avoidance
*/
