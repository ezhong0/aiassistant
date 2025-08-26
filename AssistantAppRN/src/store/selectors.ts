import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';

// Chat selectors
export const selectChatState = (state: RootState) => state.chat;
export const selectMessages = (state: RootState) => state.chat.messages;
export const selectIsLoading = (state: RootState) => state.chat.isLoading;
export const selectIsTyping = (state: RootState) => state.chat.isTyping;
export const selectError = (state: RootState) => state.chat.error;
export const selectSessionId = (state: RootState) => state.chat.sessionId;
export const selectConversationId = (state: RootState) => state.chat.conversationId;

// Memoized chat selectors
export const selectLastMessage = createSelector(
  [selectMessages],
  (messages) => messages.length > 0 ? messages[messages.length - 1] : null
);

export const selectUserMessages = createSelector(
  [selectMessages],
  (messages) => messages.filter(msg => msg.isUser)
);

export const selectAssistantMessages = createSelector(
  [selectMessages],
  (messages) => messages.filter(msg => !msg.isUser)
);

export const selectMessageCount = createSelector(
  [selectMessages],
  (messages) => messages.length
);

export const selectHasMessages = createSelector(
  [selectMessageCount],
  (count) => count > 0
);

// Actions selectors
export const selectActionsState = (state: RootState) => state.actions;
export const selectActionCards = (state: RootState) => state.actions.actionCards;
export const selectPendingActions = (state: RootState) => state.actions.pendingActions;
export const selectCompletedActions = (state: RootState) => state.actions.completedActions;
export const selectFailedActions = (state: RootState) => state.actions.failedActions;
export const selectSelectedActionId = (state: RootState) => state.actions.selectedActionId;
export const selectActionExecutionStatus = (state: RootState) => state.actions.actionExecutionStatus;
export const selectActionsError = (state: RootState) => state.actions.error;

// Memoized actions selectors
export const selectSelectedAction = createSelector(
  [selectActionCards, selectSelectedActionId],
  (actions, selectedId) => actions.find(action => action.id === selectedId) || null
);

export const selectActionCounts = createSelector(
  [selectActionCards, selectPendingActions, selectCompletedActions, selectFailedActions],
  (actions, pending, completed, failed) => ({
    total: actions.length,
    pending: pending.length,
    completed: completed.length,
    failed: failed.length,
  })
);

export const selectActionsByType = createSelector(
  [selectActionCards],
  (actions) => actions.reduce((acc, action) => {
    if (!acc[action.type]) {
      acc[action.type] = [];
    }
    acc[action.type].push(action);
    return acc;
  }, {} as Record<string, any[]>)
);

// User selectors
export const selectUserState = (state: RootState) => state.user;
export const selectIsAuthenticated = (state: RootState) => state.user.isAuthenticated;
export const selectUser = (state: RootState) => state.user.user;
export const selectToken = (state: RootState) => state.user.token;
export const selectRefreshToken = (state: RootState) => state.user.refreshToken;
export const selectIsSigningIn = (state: RootState) => state.user.isSigningIn;
export const selectIsUpdatingProfile = (state: RootState) => state.user.isUpdatingProfile;
export const selectUserError = (state: RootState) => state.user.error;
export const selectAuthError = (state: RootState) => state.user.authError;
export const selectUserSessionId = (state: RootState) => state.user.sessionId;
export const selectIsOnline = (state: RootState) => state.user.isOnline;

// Memoized user selectors
export const selectUserProfile = createSelector(
  [selectUser],
  (user) => user ? {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  } : null
);

export const selectIsTokenExpired = createSelector(
  [selectUserState],
  (userState) => {
    if (!userState.tokenExpiry) return true;
    return Date.now() > userState.tokenExpiry;
  }
);

export const selectNeedsTokenRefresh = createSelector(
  [selectIsTokenExpired, selectToken],
  (isExpired, token) => isExpired && !!token
);

// Voice selectors
export const selectVoiceState = (state: RootState) => state.voice;
export const selectIsRecording = (state: RootState) => state.voice.isRecording;
export const selectIsPaused = (state: RootState) => state.voice.isPaused;
export const selectRecordingDuration = (state: RootState) => state.voice.recordingDuration;
export const selectIsProcessing = (state: RootState) => state.voice.isProcessing;
export const selectIsTranscribing = (state: RootState) => state.voice.isTranscribing;
export const selectIsSending = (state: RootState) => state.voice.isSending;
export const selectAudioUri = (state: RootState) => state.voice.audioUri;
export const selectTranscription = (state: RootState) => state.voice.transcription;
export const selectVoiceError = (state: RootState) => state.voice.error;
export const selectVoiceSettings = createSelector(
  [selectVoiceState],
  (voice) => ({
    autoTranscribe: voice.autoTranscribe,
    voiceActivation: voice.voiceActivation,
    noiseReduction: voice.noiseReduction,
    audioQuality: voice.audioQuality,
  })
);

// Memoized voice selectors
export const selectCanRecord = createSelector(
  [selectIsRecording, selectIsProcessing, selectIsSending],
  (isRecording, isProcessing, isSending) => !isRecording && !isProcessing && !isSending
);

export const selectRecordingStatus = createSelector(
  [selectIsRecording, selectIsPaused, selectRecordingDuration],
  (isRecording, isPaused, duration) => {
    if (!isRecording) return 'stopped';
    if (isPaused) return 'paused';
    return 'recording';
  }
);

// Combined selectors
export const selectAppState = createSelector(
  [selectChatState, selectActionsState, selectUserState, selectVoiceState],
  (chat, actions, user, voice) => ({
    chat,
    actions,
    user,
    voice,
  })
);

export const selectIsAppReady = createSelector(
  [selectIsAuthenticated, selectUser, selectIsOnline],
  (isAuthenticated, user, isOnline) => isAuthenticated && !!user && isOnline
);

export const selectHasActiveActions = createSelector(
  [selectPendingActions, selectActionCards],
  (pending, actions) => pending.length > 0 || actions.length > 0
);

export const selectUnreadMessageCount = createSelector(
  [selectMessages],
  (messages) => {
    // Count messages that haven't been read (you can add a read flag to messages if needed)
    return messages.filter(msg => !msg.isUser).length;
  }
);

// Error selectors
export const selectAllErrors = createSelector(
  [selectError, selectActionsError, selectUserError, selectVoiceError],
  (chatError, actionsError, userError, voiceError) => ({
    chat: chatError,
    actions: actionsError,
    user: userError,
    voice: voiceError,
  })
);

export const selectHasErrors = createSelector(
  [selectAllErrors],
  (errors) => Object.values(errors).some(error => !!error)
);

// Loading selectors
export const selectAllLoadingStates = createSelector(
  [selectIsLoading, selectActionsState, selectUserState, selectVoiceState],
  (chatLoading, actions, user, voice) => ({
    chat: chatLoading,
    actions: actions.isLoading,
    user: user.isLoading || user.isSigningIn || user.isUpdatingProfile,
    voice: voice.isProcessing || voice.isTranscribing || voice.isSending,
  })
);

export const selectIsAnyLoading = createSelector(
  [selectAllLoadingStates],
  (loadingStates) => Object.values(loadingStates).some(loading => loading)
);
