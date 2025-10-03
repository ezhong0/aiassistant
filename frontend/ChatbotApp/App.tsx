import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { designSystem } from './src/design-system';
import { Message, ExampleQuery } from './src/types';
import MessageBubble from './src/components/MessageBubble';

const EXAMPLE_QUERIES: ExampleQuery[] = [
  { id: '1', text: 'Show me urgent emails', icon: '⚡' },
  { id: '2', text: 'What emails need replies?', icon: '✉️' },
  { id: '3', text: "Today's meetings and events", icon: '📅' },
  { id: '4', text: 'Upcoming deadlines this week', icon: '📋' },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Hello! How can I help you today?',
    sender: 'assistant',
    timestamp: new Date(),
  },
];

const { colors, spacing, typography } = designSystem;

const App = () => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isDarkMode] = useState(false);
  
  const themeColors = isDarkMode ? colors.dark : colors.light;

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: uuidv4(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: uuidv4(),
        text: `I received your message: "${text.trim()}"`,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  }, []);

  const handleExampleQuery = (query: ExampleQuery) => {
    handleSendMessage(query.text);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
        translucent={false}
      />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages List */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble 
              message={item} 
              colors={themeColors}
              style={styles.messageBubble}
            />
          )}
          contentContainerStyle={styles.messagesContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: themeColors.background }]}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: themeColors.backgroundSecondary,
                color: themeColors.textPrimary,
                borderColor: themeColors.border,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={themeColors.textSecondary}
            onSubmitEditing={() => handleSendMessage(inputText)}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: themeColors.primary },
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage(inputText)}
            disabled={!inputText.trim()}
          >
            <Text style={[styles.sendButtonText, { color: 'white' }]}>
              Send
            </Text>
          </TouchableOpacity>
        </View>

        {/* Example Queries */}
        {messages.length <= 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exampleQueriesContainer}
          >
            {EXAMPLE_QUERIES.map((query) => (
              <TouchableOpacity
                key={query.id}
                style={[
                  styles.exampleQueryButton,
                  { backgroundColor: themeColors.backgroundSecondary },
                ]}
                onPress={() => handleExampleQuery(query)}
              >
                <Text style={[styles.exampleQueryText, { color: themeColors.textPrimary }]}>
                  {query.icon} {query.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flexGrow: 1,
    padding: spacing.md,
  },
  messageBubble: {
    marginVertical: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    fontSize: 16,
    borderWidth: 1,
  },
  sendButton: {
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  exampleQueriesContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    flexDirection: 'row',
  },
  exampleQueryButton: {
    padding: spacing.md,
    borderRadius: 12,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  exampleQueryText: {
    fontSize: 16,
  },
});

export default App;