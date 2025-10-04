import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { designSystem } from './src/design-system';
import { Message, ExampleQuery } from './src/types';
import MessageBubble from './src/components/Message';
import { apiService, ChatContext } from './src/services/api.service';
import { supabase } from './src/config/supabase';
import type { Session } from '@supabase/supabase-js';

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
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<ChatContext>({ conversationHistory: [] });
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const themeColors = isDarkMode ? colors.dark : colors.light;

  // Initialize Supabase session
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Initialize API service
    apiService.initialize().catch(error => {
      console.error('Failed to initialize API service:', error);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessageId = uuidv4();
    const userMessage: Message = {
      id: userMessageId,
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Update user message status to sent
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessageId ? { ...msg, status: 'sent' as const } : msg
        )
      );

      // Send message to backend
      const response = await apiService.sendMessage(text.trim(), context);

      // Update context with response
      setContext(response.context);

      // Add assistant response
      const assistantMessage: Message = {
        id: uuidv4(),
        text: response.message,
        sender: 'assistant',
        timestamp: new Date(),
        status: 'sent',
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);

      // Update user message status to failed
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessageId ? { ...msg, status: 'failed' as const } : msg
        )
      );

      // Show error message
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send message. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => handleSendMessage(text.trim()),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  }, [context, isLoading]);

  const handleExampleQuery = (query: ExampleQuery) => {
    handleSendMessage(query.text);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.signInWithPassword(email, password);
      // Session will be updated via onAuthStateChange listener
    } catch (error) {
      Alert.alert('Sign In Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.signUp(email, password);
      Alert.alert('Success', 'Account created! Please sign in.');
    } catch (error) {
      Alert.alert('Sign Up Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await apiService.signOut();
      setMessages(INITIAL_MESSAGES);
      setContext({ conversationHistory: [] });
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  // Show loading screen
  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show auth screen if not signed in
  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={themeColors.background}
        />
        <KeyboardAvoidingView
          style={styles.authContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.authContent}>
            <Text style={[styles.authTitle, { color: themeColors.textPrimary }]}>
              Welcome to Assistant
            </Text>
            <Text style={[styles.authSubtitle, { color: themeColors.textSecondary }]}>
              Sign in to continue
            </Text>

            <TextInput
              style={[
                styles.authInput,
                {
                  backgroundColor: themeColors.backgroundSecondary,
                  color: themeColors.textPrimary,
                  borderColor: themeColors.border,
                },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={themeColors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />

            <TextInput
              style={[
                styles.authInput,
                {
                  backgroundColor: themeColors.backgroundSecondary,
                  color: themeColors.textPrimary,
                  borderColor: themeColors.border,
                },
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={themeColors.textSecondary}
              secureTextEntry
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[
                styles.authButton,
                { backgroundColor: themeColors.primary },
                isLoading && styles.authButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.authButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.authSecondaryButton]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              <Text style={[styles.authSecondaryButtonText, { color: themeColors.primary }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Main chat interface (when authenticated)
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
        translucent={false}
      />

      {/* Header with sign out */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          Assistant
        </Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={[styles.signOutText, { color: themeColors.primary }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Thinking...
            </Text>
          </View>
        )}

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
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: themeColors.primary },
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={[styles.sendButtonText, { color: 'white' }]}>
                Send
              </Text>
            )}
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  authContent: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  authTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    marginBottom: spacing.xxl,
    textAlign: 'center',
  },
  authInput: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  authButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  authButtonDisabled: {
    opacity: 0.5,
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  authSecondaryButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  authSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  signOutButton: {
    padding: spacing.sm,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default App;