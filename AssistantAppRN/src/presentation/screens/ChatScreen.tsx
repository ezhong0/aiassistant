import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCaseFactory } from '../../domain';
import type { Message, ActionCard } from '../../domain';
import { BaseComponent } from '../components/BaseComponent';

export const ChatScreen: React.FC = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<ActionCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingActions, setIsLoadingActions] = useState(false);

  // Get use case instances
  const chatUseCase = useCaseFactory.createChatUseCase();
  const actionUseCase = useCaseFactory.createActionUseCase();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoadingActions(true);
      
      // Load action cards
      const actionsResult = await actionUseCase.getActionCards();
      if (actionsResult.success && actionsResult.actions) {
        setActions(actionsResult.actions);
      }

      // Load conversation history
      const historyResult = await chatUseCase.getConversationHistory({});
      if (historyResult.success && historyResult.messages) {
        setMessages(historyResult.messages);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load initial data');
    } finally {
      setIsLoadingActions(false);
    }
  }, [actionUseCase, chatUseCase]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    try {
      const result = await chatUseCase.sendMessage({
        text: message.trim(),
      });
      
      if (result.success && result.message) {
        setMessages(prev => [...prev, result.message!]);
        setMessage('');
      } else {
        Alert.alert('Error', result.error || 'Failed to send message');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [message, chatUseCase]);

  const handleExecuteAction = useCallback(async (action: ActionCard) => {
    try {
      const result = await actionUseCase.executeAction({
        actionId: action.id,
        data: action.data,
        userId: 'current-user-id', // TODO: Get from auth context
      });
      
      if (result.success) {
        Alert.alert('Success', `Action "${action.title}" executed successfully`);
      } else {
        Alert.alert('Error', result.error || 'Failed to execute action');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to execute action');
    }
  }, [actionUseCase]);

  const handleClearConversation = useCallback(async () => {
    try {
      const result = await chatUseCase.clearConversation();
      
      if (result.success) {
        setMessages([]);
        Alert.alert('Success', 'Conversation cleared');
      } else {
        Alert.alert('Error', result.error || 'Failed to clear conversation');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to clear conversation');
    }
  }, [chatUseCase]);

  const renderMessage = useCallback((msg: Message, index: number) => (
    <View 
      key={index} 
      style={[
        styles.message, 
        msg.isUser ? styles.userMessage : styles.aiMessage
      ]}
    >
      <Text style={[
        styles.messageText,
        msg.isUser ? styles.userMessageText : styles.aiMessageText
      ]}>
        {msg.text}
      </Text>
      <Text style={styles.messageTime}>
        {msg.timestamp.toLocaleTimeString()}
      </Text>
    </View>
  ), []);

  const renderActionCard = useCallback((action: ActionCard) => (
    <TouchableOpacity
      key={action.id}
      style={styles.actionCard}
      onPress={() => handleExecuteAction(action)}
    >
      <Text style={styles.actionIcon}>{action.icon}</Text>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{action.title}</Text>
        <Text style={styles.actionDescription}>{action.description}</Text>
        <View style={styles.actionMeta}>
          <Text style={styles.actionPriority}>{action.priority}</Text>
          <Text style={styles.actionCategory}>{action.category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [handleExecuteAction]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BaseComponent style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={handleClearConversation}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView 
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, index) => renderMessage(msg, index))}
            {messages.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Start a conversation with your AI assistant
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions Section */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            {isLoadingActions ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionsScrollContent}
              >
                {actions.map(renderActionCard)}
              </ScrollView>
            )}
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Type your message..."
                multiline
                maxLength={1000}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  isLoading && styles.sendButtonDisabled
                ]}
                onPress={handleSendMessage}
                disabled={isLoading || !message.trim()}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BaseComponent>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  clearButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  message: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: '#212529',
  },
  messageTime: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  actionsScrollContent: {
    paddingRight: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginRight: 12,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  actionMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPriority: {
    fontSize: 10,
    color: '#6c757d',
    textTransform: 'uppercase',
  },
  actionCategory: {
    fontSize: 10,
    color: '#6c757d',
    textTransform: 'uppercase',
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChatScreen;
