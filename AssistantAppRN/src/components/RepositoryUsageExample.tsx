import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { repositoryFactory } from '../repositories';
import type { Message, ActionCard } from '../types';

/**
 * Example component demonstrating repository pattern usage
 * This shows how to use repositories directly in components
 */
export const RepositoryUsageExample: React.FC = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<ActionCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get repository instances
  const chatRepo = repositoryFactory.createChatRepository();
  const actionRepo = repositoryFactory.createActionRepository();
  const userRepo = repositoryFactory.createUserRepository();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load action cards
      const actionsResult = await actionRepo.getActionCards();
      if (actionsResult.success && actionsResult.data) {
        setActions(actionsResult.data);
      }

      // Load conversation history
      const historyResult = await chatRepo.getConversationHistory();
      if (historyResult.success && historyResult.data) {
        setMessages(historyResult.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load initial data');
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    try {
      const result = await chatRepo.sendMessage(message.trim());
      
      if (result.success && result.data) {
        setMessages(prev => [...prev, result.data!]);
        setMessage('');
      } else {
        Alert.alert('Error', result.error || 'Failed to send message');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: ActionCard) => {
    try {
      const result = await actionRepo.executeAction(action.id, action.data);
      
      if (result.success) {
        Alert.alert('Success', `Action "${action.title}" executed successfully`);
      } else {
        Alert.alert('Error', result.error || 'Failed to execute action');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to execute action');
    }
  };

  const handleSignIn = async () => {
    try {
      // Simulate Google sign-in
      const result = await userRepo.signInWithGoogle('mock_google_token');
      
      if (result.success) {
        Alert.alert('Success', `Welcome, ${result.data?.user.name}!`);
      } else {
        Alert.alert('Error', result.error || 'Failed to sign in');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in');
    }
  };

  const handleClearConversation = async () => {
    try {
      const result = await chatRepo.clearConversation();
      
      if (result.success) {
        setMessages([]);
        Alert.alert('Success', 'Conversation cleared');
      } else {
        Alert.alert('Error', result.error || 'Failed to clear conversation');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to clear conversation');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Repository Pattern Example</Text>
      
      {/* Authentication Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Authentication</Text>
        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In with Google (Mock)</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chat</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            multiline
          />
          <TouchableOpacity
            style={[styles.button, styles.sendButton]}
            onPress={handleSendMessage}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Sending...' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.clearButton} onPress={handleClearConversation}>
          <Text style={styles.clearButtonText}>Clear Conversation</Text>
        </TouchableOpacity>

        <View style={styles.messagesContainer}>
          {messages.map((msg, index) => (
            <View key={index} style={[styles.message, msg.isUser ? styles.userMessage : styles.aiMessage]}>
              <Text style={styles.messageText}>{msg.text}</Text>
              <Text style={styles.messageTime}>
                {msg.timestamp.toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Actions</Text>
        
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={() => handleExecuteAction(action)}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    minWidth: 80,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  messagesContainer: {
    maxHeight: 300,
  },
  message: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
  },
});

export default RepositoryUsageExample;
