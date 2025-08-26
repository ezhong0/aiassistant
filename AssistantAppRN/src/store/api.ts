import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';
import type { APIResponse, Message, ActionCard, User, BackendResponse } from '../types';

// Enhanced base query with retry logic and offline support
const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:3000',
  prepareHeaders: (headers, { getState }) => {
    // Get token from user state
    const state = getState() as any;
    const token = state.user?.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    
    // Add content type for JSON requests
    headers.set('content-type', 'application/json');
    
    return headers;
  },
});

// Enhanced base query with retry logic
const baseQueryWithRetry = retry(baseQuery, {
  maxRetries: 3,
  retryCondition: (error, { attempt }) => {
    // Retry on network errors or 5xx server errors
    if (error.status >= 500 || error.status === 0) {
      return attempt < 3;
    }
    return false;
  },
});

// Base API configuration
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Chat', 'Actions', 'User', 'Session', 'Voice'],
  endpoints: (builder) => ({
    // Main AI processing endpoint - all user interactions go through this
    sendTextCommand: builder.mutation<BackendResponse, { message: string; sessionId?: string }>({
      query: (body) => ({
        url: '/api/assistant/text-command',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Chat', 'Actions'],
      // Optimistic update for better UX
      async onQueryStarted({ message }, { dispatch, queryFulfilled, getState }) {
        // Add user message immediately
        const state = getState() as any;
        if (state.chat) {
          dispatch({ type: 'chat/addUserMessage', payload: message });
          dispatch({ type: 'chat/setTyping', payload: true });
        }
      },
    }),

    // Voice command endpoint
    sendVoiceCommand: builder.mutation<BackendResponse, { audioBlob: Blob; sessionId?: string; transcription?: string }>({
      query: (body) => {
        const formData = new FormData();
        formData.append('audio', body.audioBlob, 'voice-command.wav');
        if (body.sessionId) {
          formData.append('sessionId', body.sessionId);
        }
        if (body.transcription) {
          formData.append('transcription', body.transcription);
        }
        
        return {
          url: '/api/assistant/voice-command',
          method: 'POST',
          body: formData,
          // Don't set content-type for FormData
          prepareHeaders: (headers) => {
            headers.delete('content-type');
            return headers;
          },
        };
      },
      invalidatesTags: ['Chat', 'Actions'],
    }),

    // Action confirmation endpoint
    confirmAction: builder.mutation<BackendResponse, { actionId: string; data: any; sessionId?: string }>({
      query: (body) => ({
        url: '/api/assistant/confirm-action',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Actions', 'Chat'],
    }),

    // Session management endpoints
    getSession: builder.query<BackendResponse, string>({
      query: (sessionId) => `/api/assistant/session/${sessionId}`,
      providesTags: (result, error, sessionId) => [{ type: 'Session', id: sessionId }],
    }),

    validateSession: builder.query<{ valid: boolean }, string>({
      query: (sessionId) => `/api/assistant/session/${sessionId}/validate`,
      providesTags: (result, error, sessionId) => [{ type: 'Session', id: sessionId }],
    }),

    // Authentication endpoints
    signInWithGoogle: builder.mutation<APIResponse<{ token: string; user: User }>, { idToken: string }>({
      query: (body) => ({
        url: '/api/auth/google',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    getCurrentUser: builder.query<User, void>({
      query: () => '/api/auth/me',
      providesTags: ['User'],
    }),

    updateProfile: builder.mutation<User, Partial<User>>({
      query: (body) => ({
        url: '/api/auth/profile',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    refreshToken: builder.mutation<{ token: string }, void>({
      query: () => ({
        url: '/api/auth/refresh',
        method: 'POST',
      }),
    }),

    // Voice processing endpoints
    transcribeAudio: builder.mutation<{ text: string; confidence: number; language: string }, Blob>({
      query: (audioBlob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.wav');
        
        return {
          url: '/api/voice/transcribe',
          method: 'POST',
          body: formData,
          prepareHeaders: (headers) => {
            headers.delete('content-type');
            return headers;
          },
        };
      },
    }),

    // Health check
    healthCheck: builder.query<APIResponse<{ status: string }>, void>({
      query: () => '/health',
    }),

    // Offline queue sync endpoint
    syncOfflineActions: builder.mutation<{ success: boolean; syncedCount: number }, { actions: any[] }>({
      query: (body) => ({
        url: '/api/sync/offline-actions',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useSendTextCommandMutation,
  useSendVoiceCommandMutation,
  useConfirmActionMutation,
  useGetSessionQuery,
  useValidateSessionQuery,
  useSignInWithGoogleMutation,
  useGetCurrentUserQuery,
  useUpdateProfileMutation,
  useRefreshTokenMutation,
  useTranscribeAudioMutation,
  useHealthCheckQuery,
  useSyncOfflineActionsMutation,
} = api;
