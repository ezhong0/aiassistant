import { configureStore } from '@reduxjs/toolkit';
import { chatSlice, actionsSlice, userSlice, voiceSlice } from '../slices';
import { api } from '../api';

// Create a test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      chat: chatSlice,
      actions: actionsSlice,
      user: userSlice,
      voice: voiceSlice,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  });
};

describe('Redux Store Configuration', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should have the correct initial state structure', () => {
    const state = store.getState();
    
    expect(state).toHaveProperty('chat');
    expect(state).toHaveProperty('actions');
    expect(state).toHaveProperty('user');
    expect(state).toHaveProperty('voice');
    expect(state).toHaveProperty('api');
  });

  it('should have chat slice with correct initial state', () => {
    const state = store.getState();
    
    expect(state.chat.messages).toEqual([]);
    expect(state.chat.isLoading).toBe(false);
    expect(state.chat.error).toBe(null);
    expect(state.chat.sessionId).toBe(null);
    expect(state.chat.isTyping).toBe(false);
  });

  it('should have actions slice with correct initial state', () => {
    const state = store.getState();
    
    expect(state.actions.actionCards).toEqual([]);
    expect(state.actions.pendingActions).toEqual([]);
    expect(state.actions.completedActions).toEqual([]);
    expect(state.actions.failedActions).toEqual([]);
    expect(state.actions.selectedActionId).toBe(null);
    expect(state.actions.actionExecutionStatus).toBe('idle');
  });

  it('should have user slice with correct initial state', () => {
    const state = store.getState();
    
    expect(state.user.isAuthenticated).toBe(false);
    expect(state.user.user).toBe(null);
    expect(state.user.token).toBe(null);
    expect(state.user.isLoading).toBe(false);
    expect(state.user.isSigningIn).toBe(false);
  });

  it('should have voice slice with correct initial state', () => {
    const state = store.getState();
    
    expect(state.voice.isRecording).toBe(false);
    expect(state.voice.isPaused).toBe(false);
    expect(state.voice.recordingDuration).toBe(0);
    expect(state.voice.isProcessing).toBe(false);
    expect(state.voice.audioUri).toBe(null);
  });
});

describe('Chat Slice Actions', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should add user message', () => {
    const message = 'Hello, world!';
    store.dispatch({ type: 'chat/addUserMessage', payload: message });
    
    const state = store.getState();
    expect(state.chat.messages).toHaveLength(1);
    expect(state.chat.messages[0].text).toBe(message);
    expect(state.chat.messages[0].isUser).toBe(true);
  });

  it('should add assistant message', () => {
    const message = 'Hello! How can I help you?';
    store.dispatch({ type: 'chat/addAssistantMessage', payload: message });
    
    const state = store.getState();
    expect(state.chat.messages).toHaveLength(1);
    expect(state.chat.messages[0].text).toBe(message);
    expect(state.chat.messages[0].isUser).toBe(false);
  });

  it('should clear messages', () => {
    // Add some messages first
    store.dispatch({ type: 'chat/addUserMessage', payload: 'Test message' });
    store.dispatch({ type: 'chat/clearMessages' });
    
    const state = store.getState();
    expect(state.chat.messages).toHaveLength(0);
  });

  it('should set session ID', () => {
    const sessionId = 'test-session-123';
    store.dispatch({ type: 'chat/setSessionId', payload: sessionId });
    
    const state = store.getState();
    expect(state.chat.sessionId).toBe(sessionId);
  });
});

describe('Actions Slice Actions', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should add action card', () => {
    const actionCard = {
      id: 'action-1',
      type: 'email' as const,
      title: 'Send Email',
      description: 'Send an email to John',
      icon: 'email',
      data: { recipient: 'john@example.com' },
      timestamp: new Date(),
    };
    
    store.dispatch({ type: 'actions/addActionCard', payload: actionCard });
    
    const state = store.getState();
    expect(state.actions.actionCards).toHaveLength(1);
    expect(state.actions.actionCards[0].id).toBe('action-1');
  });

  it('should set selected action', () => {
    const actionId = 'action-1';
    store.dispatch({ type: 'actions/setSelectedAction', payload: actionId });
    
    const state = store.getState();
    expect(state.actions.selectedActionId).toBe(actionId);
  });

  it('should move action to pending', () => {
    // Add an action card first
    const actionCard = {
      id: 'action-1',
      type: 'email' as const,
      title: 'Send Email',
      description: 'Send an email',
      icon: 'email',
      data: {},
      timestamp: new Date(),
    };
    
    store.dispatch({ type: 'actions/addActionCard', payload: actionCard });
    store.dispatch({ type: 'actions/moveToPending', payload: 'action-1' });
    
    const state = store.getState();
    expect(state.actions.actionCards).toHaveLength(0);
    expect(state.actions.pendingActions).toHaveLength(1);
    expect(state.actions.pendingActions[0].id).toBe('action-1');
  });
});

describe('User Slice Actions', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should start sign in process', () => {
    store.dispatch({ type: 'user/signInStart' });
    
    const state = store.getState();
    expect(state.user.isSigningIn).toBe(true);
    expect(state.user.authError).toBe(null);
  });

  it('should handle successful sign in', () => {
    const userData = {
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
      token: 'test-token',
      refreshToken: 'refresh-token',
    };
    
    store.dispatch({ type: 'user/signInSuccess', payload: userData });
    
    const state = store.getState();
    expect(state.user.isAuthenticated).toBe(true);
    expect(state.user.user).toEqual(userData.user);
    expect(state.user.token).toBe(userData.token);
    expect(state.user.isSigningIn).toBe(false);
  });

  it('should handle sign out', () => {
    // First sign in
    const userData = {
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
      token: 'test-token',
    };
    store.dispatch({ type: 'user/signInSuccess', payload: userData });
    
    // Then sign out
    store.dispatch({ type: 'user/signOut' });
    
    const state = store.getState();
    expect(state.user.isAuthenticated).toBe(false);
    expect(state.user.user).toBe(null);
    expect(state.user.token).toBe(null);
  });
});

describe('Voice Slice Actions', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should start recording', () => {
    store.dispatch({ type: 'voice/startRecording' });
    
    const state = store.getState();
    expect(state.voice.isRecording).toBe(true);
    expect(state.voice.isPaused).toBe(false);
    expect(state.voice.recordingStartTime).toBeTruthy();
  });

  it('should pause and resume recording', () => {
    store.dispatch({ type: 'voice/startRecording' });
    store.dispatch({ type: 'voice/pauseRecording' });
    
    let state = store.getState();
    expect(state.voice.isPaused).toBe(true);
    
    store.dispatch({ type: 'voice/resumeRecording' });
    state = store.getState();
    expect(state.voice.isPaused).toBe(false);
  });

  it('should stop recording with audio data', () => {
    store.dispatch({ type: 'voice/startRecording' });
    
    const audioData = {
      audioUri: 'file://test.wav',
      audioBlob: new Blob(['test'], { type: 'audio/wav' }),
      format: 'wav' as const,
    };
    
    store.dispatch({ type: 'voice/stopRecording', payload: audioData });
    
    const state = store.getState();
    expect(state.voice.isRecording).toBe(false);
    expect(state.voice.audioUri).toBe(audioData.audioUri);
    expect(state.voice.audioFormat).toBe(audioData.format);
  });
});
