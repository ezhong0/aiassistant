import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { APIResponse, Message, ActionCard, User } from '../types';

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
  tagTypes: ['Chat', 'Actions', 'User'],
  endpoints: (builder) => ({
    // Chat endpoints
    sendMessage: builder.mutation<APIResponse<Message>, { message: string }>({
      query: (body) => ({
        url: '/assistant/chat',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Chat'],
    }),

    // Action endpoints
    getActionCards: builder.query<APIResponse<ActionCard[]>, void>({
      query: () => '/assistant/actions',
      providesTags: ['Actions'],
    }),

    executeAction: builder.mutation<APIResponse<any>, { actionId: string; data: any }>({
      query: ({ actionId, data }) => ({
        url: `/assistant/actions/${actionId}/execute`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Actions'],
    }),

    // Auth endpoints
    signInWithGoogle: builder.mutation<APIResponse<{ token: string; user: User }>, { idToken: string }>({
      query: (body) => ({
        url: '/auth/google',
        method: 'POST',
        body,
      }),
    }),

    // Health check
    healthCheck: builder.query<APIResponse<{ status: string }>, void>({
      query: () => '/health',
    }),
  }),
});

export const {
  useSendMessageMutation,
  useGetActionCardsQuery,
  useExecuteActionMutation,
  useSignInWithGoogleMutation,
  useHealthCheckQuery,
} = api;
