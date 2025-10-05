/**
 * Main App Component - Redesigned & Enhanced
 *
 * Features:
 * - Conversation persistence with AsyncStorage
 * - Offline-first with sync queue
 * - Enhanced message components
 * - Better loading/empty/error states
 * - Accessibility support
 * - Network status monitoring
 * - Auto-retry failed messages
 */

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
  Alert,
  Clipboard,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import type { Session } from '@supabase/supabase-js';

// Services
import { supabase, isAuthEnabled } from './src/config/supabase';
import { apiService } from './src/services/api.service';
import { storageService, StoredMessage } from './src/services/storage.service';
import { offlineService, NetworkStatus } from './src/services/offline.service';

// Components
import EnhancedMessage from './src/components/EnhancedMessage';
import EmptyState from './src/components/EmptyState';
import LoadingIndicator from './src/components/LoadingIndicator';

// Design System & Types
import { designSystem } from './src/design-system';
import { ExampleQuery } from './src/types';

const EXAMPLE_QUERIES: ExampleQuery[] = [
  { id: '1', text: 'Show me urgent emails', icon: '⚡' },
  { id: '2', text: 'What emails need replies?', icon: '✉️' },
  { id: '3', text: "Today's meetings and events", icon: '📅' },
  { id: '4', text: 'Upcoming deadlines this week', icon: '📋' },
];

const { colors, spacing, typography } = designSystem;

const App = () => {
  // State
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    type: null,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const themeColors = isDarkMode ? colors.dark : colors.light;

  // Initialize services on mount
  useEffect(() => {
    const init = async () => {
      try {
        // If Supabase is not configured, skip auth and go straight to chat
        if (!isAuthEnabled) {
          console.log('Authentication disabled - Supabase not configured');
          setSession({ user: null } as any); // Fake session to skip auth screen
          setAuthLoading(false);

          // Initialize API service
          await apiService.initialize();

          // Initialize offline service
          await offlineService.initialize();

          // Subscribe to network status
          const unsubscribe = offlineService.subscribe(status => {
            setNetworkStatus(status);
          });

          // Load persisted messages
          const stored = await storageService.getMessages();
          setMessages(stored);

          return () => {
            unsubscribe();
            offlineService.destroy();
          };
        }

        // Initialize Supabase session
        const { data: { session } } = await supabase!.auth.getSession();
        setSession(session);

        // Initialize API service
        await apiService.initialize();

        // Initialize offline service
        await offlineService.initialize();

        // Subscribe to network status
        const unsubscribe = offlineService.subscribe(status => {
          setNetworkStatus(status);
        });

        // Load persisted messages
        if (session) {
          const stored = await storageService.getMessages();
          setMessages(stored);

          // Sync pending messages
          if (offlineService.isNetworkOnline()) {
            syncPendingMessages();
          }
        }

        setAuthLoading(false);

        return () => {
          unsubscribe();
          offlineService.destroy();
        };
      } catch (error) {
        console.error('Initialization error:', error);
        setAuthLoading(false);
      }
    };

    init();

    // Listen for auth changes (only if Supabase is configured)
    if (!isAuthEnabled) {
      return;
    }

    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session) {
        // Load messages when user signs in
        const stored = await storageService.getMessages();
        setMessages(stored);
      } else {
        // Clear messages when user signs out
        setMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Sync pending messages
  const syncPendingMessages = async () => {
    if (isSyncing || !networkStatus.isConnected) return;

    setIsSyncing(true);
    try {
      const result = await offlineService.syncPendingMessages();

      if (result.succeeded > 0 || result.failed > 0) {
        // Reload messages from storage
        const stored = await storageService.getMessages();
        setMessages(stored);

        if (result.failed > 0) {
          Alert.alert(
            'Some messages failed',
            `${result.failed} message(s) failed to send. They have been marked for retry.`
          );
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle send message
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const messageId = uuidv4();
      const userMessage: StoredMessage = {
        id: messageId,
        text: text.trim(),
        sender: 'user',
        timestamp: Date.now(),
        status: 'sending',
      };

      // Save to storage
      await storageService.saveMessage(userMessage);

      // Update UI immediately (optimistic update)
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);

      try {
        if (!networkStatus.isConnected) {
          // Offline - queue for later
          await offlineService.queueMessage(userMessage);
          await storageService.updateMessageStatus(messageId, 'sending');

          // Update UI
          setMessages(prev =>
            prev.map(msg => (msg.id === messageId ? { ...msg, status: 'sending' as const } : msg))
          );

          Alert.alert(
            'Offline',
            'Your message will be sent when you\'re back online.',
            [{ text: 'OK' }]
          );
        } else {
          // Online - send immediately
          const truncated = await storageService.getTruncatedMessages();
          const conversationHistory = truncated.map(msg => ({
            role: msg.sender as 'user' | 'assistant' | 'system',
            content: msg.text,
            timestamp: msg.timestamp,
          }));

          const response = await apiService.sendMessage(text.trim(), {
            conversationHistory,
          });

          // Mark user message as sent
          await storageService.updateMessageStatus(messageId, 'sent');

          // Save assistant response
          const assistantMessage: StoredMessage = {
            id: uuidv4(),
            text: response.message,
            sender: 'assistant',
            timestamp: Date.now(),
            status: 'sent',
          };
          await storageService.saveMessage(assistantMessage);

          // Update UI
          const stored = await storageService.getMessages();
          setMessages(stored);
        }
      } catch (error) {
        console.error('Send message error:', error);

        // Mark as failed
        await storageService.updateMessageStatus(messageId, 'failed');

        // Update UI
        setMessages(prev =>
          prev.map(msg => (msg.id === messageId ? { ...msg, status: 'failed' as const } : msg))
        );

        // Show error
        Alert.alert(
          'Failed to send',
          error instanceof Error ? error.message : 'An error occurred',
          [
            {
              text: 'Retry',
              onPress: () => handleRetryMessage(messageId),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, networkStatus.isConnected]
  );

  // Handle retry failed message
  const handleRetryMessage = async (messageId: string) => {
    try {
      await offlineService.retryFailedMessage(messageId);

      // Reload messages
      const stored = await storageService.getMessages();
      setMessages(stored);

      // Try to sync
      if (networkStatus.isConnected) {
        syncPendingMessages();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to retry message');
    }
  };

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await storageService.deleteMessage(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  // Handle copy message
  const handleCopyMessage = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  // Handle example query
  const handleExampleQuery = (query: ExampleQuery) => {
    handleSendMessage(query.text);
  };

  // Auth handlers
  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.signInWithPassword(email, password);
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
    if (!isAuthEnabled) {
      Alert.alert('Info', 'Authentication is not configured');
      return;
    }

    try {
      await apiService.signOut();
      await storageService.clearMessages();
      setMessages([]);
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  // Loading screen
  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <EmptyState type="loading" isDarkMode={isDarkMode} />
      </SafeAreaView>
    );
  }

  // Auth screen
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
              Your AI-powered email & calendar assistant
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
              accessible={true}
              accessibilityLabel="Email input"
              accessibilityHint="Enter your email address"
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
              accessible={true}
              accessibilityLabel="Password input"
              accessibilityHint="Enter your password"
            />

            <TouchableOpacity
              style={[
                styles.authButton,
                { backgroundColor: themeColors.primary },
                isLoading && styles.authButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={isLoading}
              accessible={true}
              accessibilityLabel="Sign in button"
              accessibilityRole="button"
            >
              <Text style={styles.authButtonText}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.authSecondaryButton}
              onPress={handleSignUp}
              disabled={isLoading}
              accessible={true}
              accessibilityLabel="Create account button"
              accessibilityRole="button"
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

  // Main chat interface
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
        translucent={false}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Assistant</Text>
          {/* Network Status */}
          {!networkStatus.isConnected && (
            <Text style={[styles.offlineBadge, { color: themeColors.error }]}>Offline</Text>
          )}
          {isSyncing && (
            <Text style={[styles.syncingBadge, { color: themeColors.warning }]}>Syncing...</Text>
          )}
        </View>
        {isAuthEnabled && (
          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutButton}
            accessible={true}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
          >
            <Text style={[styles.signOutText, { color: themeColors.primary }]}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages List */}
        {messages.length === 0 ? (
          <EmptyState
            type={networkStatus.isConnected ? 'first-conversation' : 'offline'}
            isDarkMode={isDarkMode}
            onAction={networkStatus.isConnected ? undefined : syncPendingMessages}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <EnhancedMessage
                message={item}
                isDarkMode={isDarkMode}
                onRetry={handleRetryMessage}
                onDelete={handleDeleteMessage}
                onCopy={handleCopyMessage}
              />
            )}
            contentContainerStyle={styles.messagesContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Loading Indicator */}
        {isLoading && <LoadingIndicator type="typing" isDarkMode={isDarkMode} />}

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
            accessible={true}
            accessibilityLabel="Message input"
            accessibilityHint="Type your message here"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: themeColors.primary },
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            accessible={true}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Text style={styles.sendButtonText}>{isLoading ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>

        {/* Example Queries */}
        {messages.length === 0 && networkStatus.isConnected && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exampleQueriesContainer}
          >
            {EXAMPLE_QUERIES.map(query => (
              <TouchableOpacity
                key={query.id}
                style={[
                  styles.exampleQueryButton,
                  { backgroundColor: themeColors.backgroundSecondary },
                ]}
                onPress={() => handleExampleQuery(query)}
                accessible={true}
                accessibilityLabel={`Try example: ${query.text}`}
                accessibilityRole="button"
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flexGrow: 1,
    paddingVertical: spacing.md,
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
    color: '#FFFFFF',
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
  offlineBadge: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  syncingBadge: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
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
