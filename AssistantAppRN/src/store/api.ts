import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { APIResponse, Message, ActionCard, User, BackendResponse } from '../types';

// Base API configuration
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:3000',
    prepareHeaders: (headers, { getState }) => {
      // TODO: Get token from auth state
      const token = ''; // getState().auth?.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Chat', 'Actions', 'User', 'Session'],
  endpoints: (builder) => ({
    // Main AI processing endpoint - all user interactions go through this
    sendTextCommand: builder.mutation<BackendResponse, { message: string; sessionId?: string }>({
      query: (body) => ({
        url: '/api/assistant/text-command',
        method: 'POST',
        body,
      }),
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

    // Health check
    healthCheck: builder.query<APIResponse<{ status: string }>, void>({
      query: () => '/health',
    }),
  }),
});

export const {
  useSendTextCommandMutation,
  useConfirmActionMutation,
  useGetSessionQuery,
  useValidateSessionQuery,
  useSignInWithGoogleMutation,
  useGetCurrentUserQuery,
  useUpdateProfileMutation,
  useRefreshTokenMutation,
  useHealthCheckQuery,
} = api;
