import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './index';
import * as selectors from './selectors';
import * as actions from './slices';

// Typed hooks
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Chat hooks
export const useChat = () => {
  const dispatch = useAppDispatch();
  const chatState = useAppSelector(selectors.selectChatState);
  const messages = useAppSelector(selectors.selectMessages);
  const isLoading = useAppSelector(selectors.selectIsLoading);
  const isTyping = useAppSelector(selectors.selectIsTyping);
  const error = useAppSelector(selectors.selectError);
  const sessionId = useAppSelector(selectors.selectSessionId);

  const addMessage = useCallback((message: any) => {
    dispatch(actions.addMessage(message));
  }, [dispatch]);

  const addUserMessage = useCallback((text: string) => {
    dispatch(actions.addUserMessage(text));
  }, [dispatch]);

  const addAssistantMessage = useCallback((text: string) => {
    dispatch(actions.addAssistantMessage(text));
  }, [dispatch]);

  const clearMessages = useCallback(() => {
    dispatch(actions.clearMessages());
  }, [dispatch]);

  const setSessionId = useCallback((id: string) => {
    dispatch(actions.setSessionId(id));
  }, [dispatch]);

  const setLoading = useCallback((loading: boolean) => {
    dispatch(actions.setLoading(loading));
  }, [dispatch]);

  const setTyping = useCallback((typing: boolean) => {
    dispatch(actions.setTyping(typing));
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(actions.clearError());
  }, [dispatch]);

  return {
    ...chatState,
    messages,
    isLoading,
    isTyping,
    error,
    sessionId,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    clearMessages,
    setSessionId,
    setLoading,
    setTyping,
    clearError,
  };
};

// Actions hooks
export const useActions = () => {
  const dispatch = useAppDispatch();
  const actionsState = useAppSelector(selectors.selectActionsState);
  const actionCards = useAppSelector(selectors.selectActionCards);
  const pendingActions = useAppSelector(selectors.selectPendingActions);
  const completedActions = useAppSelector(selectors.selectCompletedActions);
  const failedActions = useAppSelector(selectors.selectFailedActions);
  const selectedActionId = useAppSelector(selectors.selectSelectedActionId);
  const executionStatus = useAppSelector(selectors.selectActionExecutionStatus);

  const addActionCard = useCallback((action: any) => {
    dispatch(actions.addActionCard(action));
  }, [dispatch]);

  const updateActionCard = useCallback((id: string, updates: any) => {
    dispatch(actions.updateActionCard({ id, updates }));
  }, [dispatch]);

  const removeActionCard = useCallback((id: string) => {
    dispatch(actions.removeActionCard(id));
  }, [dispatch]);

  const setSelectedAction = useCallback((id: string | null) => {
    dispatch(actions.setSelectedAction(id));
  }, [dispatch]);

  const moveToPending = useCallback((id: string) => {
    dispatch(actions.moveToPending(id));
  }, [dispatch]);

  const moveToCompleted = useCallback((id: string) => {
    dispatch(actions.moveToCompleted(id));
  }, [dispatch]);

  const moveToFailed = useCallback((id: string, error: string) => {
    dispatch(actions.moveToFailed({ actionId: id, error }));
  }, [dispatch]);

  const clearCompletedActions = useCallback(() => {
    dispatch(actions.clearCompletedActions());
  }, [dispatch]);

  const clearFailedActions = useCallback(() => {
    dispatch(actions.clearFailedActions());
  }, [dispatch]);

  return {
    ...actionsState,
    actionCards,
    pendingActions,
    completedActions,
    failedActions,
    selectedActionId,
    executionStatus,
    addActionCard,
    updateActionCard,
    removeActionCard,
    setSelectedAction,
    moveToPending,
    moveToCompleted,
    moveToFailed,
    clearCompletedActions,
    clearFailedActions,
  };
};

// User hooks
export const useUser = () => {
  const dispatch = useAppDispatch();
  const userState = useAppSelector(selectors.selectUserState);
  const isAuthenticated = useAppSelector(selectors.selectIsAuthenticated);
  const user = useAppSelector(selectors.selectUser);
  const token = useAppSelector(selectors.selectToken);
  const isSigningIn = useAppSelector(selectors.selectIsSigningIn);
  const isUpdatingProfile = useAppSelector(selectors.selectIsUpdatingProfile);
  const error = useAppSelector(selectors.selectUserError);
  const authError = useAppSelector(selectors.selectAuthError);
  const isOnline = useAppSelector(selectors.selectIsOnline);

  const signInStart = useCallback(() => {
    dispatch(actions.signInStart());
  }, [dispatch]);

  const signInSuccess = useCallback((data: { user: any; token: string; refreshToken?: string }) => {
    dispatch(actions.signInSuccess(data));
  }, [dispatch]);

  const signInFailure = useCallback((error: string) => {
    dispatch(actions.signInFailure(error));
  }, [dispatch]);

  const signOut = useCallback(() => {
    dispatch(actions.signOut());
  }, [dispatch]);

  const updateProfileStart = useCallback(() => {
    dispatch(actions.updateProfileStart());
  }, [dispatch]);

  const updateProfileSuccess = useCallback((user: any) => {
    dispatch(actions.updateProfileSuccess(user));
  }, [dispatch]);

  const updateProfileFailure = useCallback((error: string) => {
    dispatch(actions.updateProfileFailure(error));
  }, [dispatch]);

  const setOnlineStatus = useCallback((status: boolean) => {
    dispatch(actions.setOnlineStatus(status));
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(actions.clearUserError());
  }, [dispatch]);

  return {
    ...userState,
    isAuthenticated,
    user,
    token,
    isSigningIn,
    isUpdatingProfile,
    error,
    authError,
    isOnline,
    signInStart,
    signInSuccess,
    signInFailure,
    signOut,
    updateProfileStart,
    updateProfileSuccess,
    updateProfileFailure,
    setOnlineStatus,
    clearError,
  };
};

// Voice hooks
export const useVoice = () => {
  const dispatch = useAppDispatch();
  const voiceState = useAppSelector(selectors.selectVoiceState);
  const isRecording = useAppSelector(selectors.selectIsRecording);
  const isPaused = useAppSelector(selectors.selectIsPaused);
  const recordingDuration = useAppSelector(selectors.selectRecordingDuration);
  const isProcessing = useAppSelector(selectors.selectIsProcessing);
  const isTranscribing = useAppSelector(selectors.selectIsTranscribing);
  const isSending = useAppSelector(selectors.selectIsSending);
  const audioUri = useAppSelector(selectors.selectAudioUri);
  const transcription = useAppSelector(selectors.selectTranscription);
  const error = useAppSelector(selectors.selectVoiceError);

  const startRecording = useCallback(() => {
    dispatch(actions.startRecording());
  }, [dispatch]);

  const pauseRecording = useCallback(() => {
    dispatch(actions.pauseRecording());
  }, [dispatch]);

  const resumeRecording = useCallback(() => {
    dispatch(actions.resumeRecording());
  }, [dispatch]);

  const stopRecording = useCallback((data: { audioUri: string; audioBlob: Blob; format: any }) => {
    dispatch(actions.stopRecording(data));
  }, [dispatch]);

  const startProcessing = useCallback(() => {
    dispatch(actions.startProcessing());
  }, [dispatch]);

  const stopProcessing = useCallback(() => {
    dispatch(actions.stopProcessing());
  }, [dispatch]);

  const startTranscription = useCallback(() => {
    dispatch(actions.startTranscription());
  }, [dispatch]);

  const transcriptionSuccess = useCallback((data: { text: string; confidence: number; language: string }) => {
    dispatch(actions.transcriptionSuccess(data));
  }, [dispatch]);

  const transcriptionFailure = useCallback((error: string) => {
    dispatch(actions.transcriptionFailure(error));
  }, [dispatch]);

  const clearAudioData = useCallback(() => {
    dispatch(actions.clearAudioData());
  }, [dispatch]);

  const clearErrors = useCallback(() => {
    dispatch(actions.clearErrors());
  }, [dispatch]);

  return {
    ...voiceState,
    isRecording,
    isPaused,
    recordingDuration,
    isProcessing,
    isTranscribing,
    isSending,
    audioUri,
    transcription,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    startProcessing,
    stopProcessing,
    startTranscription,
    transcriptionSuccess,
    transcriptionFailure,
    clearAudioData,
    clearErrors,
  };
};

// App state hook
export const useAppState = () => {
  const appState = useAppSelector(selectors.selectAppState);
  const isAppReady = useAppSelector(selectors.selectIsAppReady);
  const hasActiveActions = useAppSelector(selectors.selectHasActiveActions);
  const hasErrors = useAppSelector(selectors.selectHasErrors);
  const isAnyLoading = useAppSelector(selectors.selectIsAnyLoading);

  return {
    ...appState,
    isAppReady,
    hasActiveActions,
    hasErrors,
    isAnyLoading,
  };
};

// Error handling hook
export const useErrorHandling = () => {
  const dispatch = useAppDispatch();
  const allErrors = useAppSelector(selectors.selectAllErrors);
  const hasErrors = useAppSelector(selectors.selectHasErrors);

  const clearAllErrors = useCallback(() => {
    dispatch(actions.clearError());
    dispatch(actions.clearActionsError());
    dispatch(actions.clearUserError());
    dispatch(actions.clearErrors());
  }, [dispatch]);

  return {
    errors: allErrors,
    hasErrors,
    clearAllErrors,
  };
};
