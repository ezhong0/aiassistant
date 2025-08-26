import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Message, BackendResponse } from '../../types';

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  isTyping: boolean;
  lastMessageTimestamp: number | null;
  conversationId: string | null;
}

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  sessionId: null,
  isTyping: false,
  lastMessageTimestamp: null,
  conversationId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Message management
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
      state.lastMessageTimestamp = Date.now();
    },
    
    addUserMessage: (state, action: PayloadAction<string>) => {
      const message: Message = {
        id: `user-${Date.now()}`,
        text: action.payload,
        isUser: true,
        timestamp: new Date(),
        metadata: { type: 'text' },
      };
      state.messages.push(message);
      state.lastMessageTimestamp = Date.now();
    },
    
    addAssistantMessage: (state, action: PayloadAction<string>) => {
      const message: Message = {
        id: `assistant-${Date.now()}`,
        text: action.payload,
        isUser: false,
        timestamp: new Date(),
        metadata: { type: 'text' },
      };
      state.messages.push(message);
      state.lastMessageTimestamp = Date.now();
    },
    
    updateLastMessage: (state, action: PayloadAction<Partial<Message>>) => {
      if (state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        Object.assign(lastMessage, action.payload);
      }
    },
    
    clearMessages: (state) => {
      state.messages = [];
      state.lastMessageTimestamp = null;
    },
    
    // Session management
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload;
    },
    
    setConversationId: (state, action: PayloadAction<string>) => {
      state.conversationId = action.payload;
    },
    
    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },
    
    // Error handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    // Process backend response
    processBackendResponse: (state, action: PayloadAction<BackendResponse>) => {
      const response = action.payload;
      
      if (response.sessionId) {
        state.sessionId = response.sessionId;
      }
      
      if (response.message) {
        const message: Message = {
          id: `assistant-${Date.now()}`,
          text: response.message,
          isUser: false,
          timestamp: new Date(),
          metadata: { 
            type: response.responseType === 'error' ? 'error' : 'text',
            actionData: response.actions,
          },
        };
        state.messages.push(message);
        state.lastMessageTimestamp = Date.now();
      }
      
      state.isTyping = false;
      state.isLoading = false;
    },
    
    // Reset state
    resetChat: (state) => {
      return { ...initialState };
    },
  },
});

export const {
  addMessage,
  addUserMessage,
  addAssistantMessage,
  updateLastMessage,
  clearMessages,
  setSessionId,
  setConversationId,
  setLoading,
  setTyping,
  setError,
  clearError,
  processBackendResponse,
  resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;
