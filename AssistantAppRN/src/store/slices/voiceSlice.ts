import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface VoiceState {
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number; // in milliseconds
  
  // Processing state
  isProcessing: boolean;
  isTranscribing: boolean;
  isSending: boolean;
  
  // Audio data
  audioUri: string | null;
  audioBlob: Blob | null;
  audioFormat: 'wav' | 'mp3' | 'm4a' | null;
  audioQuality: 'low' | 'medium' | 'high';
  
  // Transcription
  transcription: string | null;
  transcriptionConfidence: number | null;
  transcriptionLanguage: string | null;
  
  // Error handling
  error: string | null;
  recordingError: string | null;
  transcriptionError: string | null;
  
  // Settings
  autoTranscribe: boolean;
  voiceActivation: boolean;
  noiseReduction: boolean;
  
  // Performance metrics
  recordingStartTime: number | null;
  processingStartTime: number | null;
  totalProcessingTime: number | null;
  
  // Offline support
  isOfflineMode: boolean;
  pendingVoiceActions: string[];
}

const initialState: VoiceState = {
  isRecording: false,
  isPaused: false,
  recordingDuration: 0,
  isProcessing: false,
  isTranscribing: false,
  isSending: false,
  audioUri: null,
  audioBlob: null,
  audioFormat: null,
  audioQuality: 'medium',
  transcription: null,
  transcriptionConfidence: null,
  transcriptionLanguage: null,
  error: null,
  recordingError: null,
  transcriptionError: null,
  autoTranscribe: true,
  voiceActivation: false,
  noiseReduction: true,
  recordingStartTime: null,
  processingStartTime: null,
  totalProcessingTime: null,
  isOfflineMode: false,
  pendingVoiceActions: [],
};

const voiceSlice = createSlice({
  name: 'voice',
  initialState,
  reducers: {
    // Recording control
    startRecording: (state) => {
      state.isRecording = true;
      state.isPaused = false;
      state.recordingStartTime = Date.now();
      state.recordingDuration = 0;
      state.error = null;
      state.recordingError = null;
    },
    
    pauseRecording: (state) => {
      state.isPaused = true;
    },
    
    resumeRecording: (state) => {
      state.isPaused = false;
    },
    
    stopRecording: (state, action: PayloadAction<{ audioUri: string; audioBlob: Blob; format: VoiceState['audioFormat'] }>) => {
      const { audioUri, audioBlob, format } = action.payload;
      state.isRecording = false;
      state.isPaused = false;
      state.audioUri = audioUri;
      state.audioBlob = audioBlob;
      state.audioFormat = format;
      state.recordingDuration = state.recordingStartTime ? Date.now() - state.recordingStartTime : 0;
      state.recordingStartTime = null;
    },
    
    updateRecordingDuration: (state, action: PayloadAction<number>) => {
      state.recordingDuration = action.payload;
    },
    
    // Audio processing
    startProcessing: (state) => {
      state.isProcessing = true;
      state.processingStartTime = Date.now();
      state.error = null;
    },
    
    stopProcessing: (state) => {
      state.isProcessing = false;
      state.processingStartTime = null;
    },
    
    // Transcription
    startTranscription: (state) => {
      state.isTranscribing = true;
      state.transcriptionError = null;
    },
    
    transcriptionSuccess: (state, action: PayloadAction<{ text: string; confidence: number; language: string }>) => {
      const { text, confidence, language } = action.payload;
      state.transcription = text;
      state.transcriptionConfidence = confidence;
      state.transcriptionLanguage = language;
      state.isTranscribing = false;
      state.transcriptionError = null;
    },
    
    transcriptionFailure: (state, action: PayloadAction<string>) => {
      state.isTranscribing = false;
      state.transcriptionError = action.payload;
      state.transcription = null;
      state.transcriptionConfidence = null;
    },
    
    // Sending audio
    startSending: (state) => {
      state.isSending = true;
      state.error = null;
    },
    
    sendingSuccess: (state) => {
      state.isSending = false;
      state.totalProcessingTime = state.processingStartTime ? Date.now() - state.processingStartTime : null;
    },
    
    sendingFailure: (state, action: PayloadAction<string>) => {
      state.isSending = false;
      state.error = action.payload;
    },
    
    // Audio data management
    setAudioData: (state, action: PayloadAction<{ uri: string; blob: Blob; format: VoiceState['audioFormat'] }>) => {
      const { uri, blob, format } = action.payload;
      state.audioUri = uri;
      state.audioBlob = blob;
      state.audioFormat = format;
    },
    
    clearAudioData: (state) => {
      state.audioUri = null;
      state.audioBlob = null;
      state.audioFormat = null;
      state.transcription = null;
      state.transcriptionConfidence = null;
      state.transcriptionLanguage = null;
    },
    
    // Settings
    updateAudioQuality: (state, action: PayloadAction<VoiceState['audioQuality']>) => {
      state.audioQuality = action.payload;
    },
    
    toggleAutoTranscribe: (state) => {
      state.autoTranscribe = !state.autoTranscribe;
    },
    
    toggleVoiceActivation: (state) => {
      state.voiceActivation = !state.voiceActivation;
    },
    
    toggleNoiseReduction: (state) => {
      state.noiseReduction = !state.noiseReduction;
    },
    
    // Error handling
    setVoiceError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    setRecordingError: (state, action: PayloadAction<string | null>) => {
      state.recordingError = action.payload;
    },
    
    clearErrors: (state) => {
      state.error = null;
      state.recordingError = null;
      state.transcriptionError = null;
    },
    
    // Offline support
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.isOfflineMode = action.payload;
    },
    
    addPendingVoiceAction: (state, action: PayloadAction<string>) => {
      if (!state.pendingVoiceActions.includes(action.payload)) {
        state.pendingVoiceActions.push(action.payload);
      }
    },
    
    removePendingVoiceAction: (state, action: PayloadAction<string>) => {
      state.pendingVoiceActions = state.pendingVoiceActions.filter(action => action !== action.payload);
    },
    
    clearPendingVoiceActions: (state) => {
      state.pendingVoiceActions = [];
    },
    
    // Reset state
    resetVoice: (state) => {
      return { ...initialState };
    },
    
    // Performance tracking
    updateTotalProcessingTime: (state, action: PayloadAction<number>) => {
      state.totalProcessingTime = action.payload;
    },
  },
});

export const {
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  updateRecordingDuration,
  startProcessing,
  stopProcessing,
  startTranscription,
  transcriptionSuccess,
  transcriptionFailure,
  startSending,
  sendingSuccess,
  sendingFailure,
  setAudioData,
  clearAudioData,
  updateAudioQuality,
  toggleAutoTranscribe,
  toggleVoiceActivation,
  toggleNoiseReduction,
  setVoiceError,
  setRecordingError,
  clearErrors,
  setOfflineMode,
  addPendingVoiceAction,
  removePendingVoiceAction,
  clearPendingVoiceActions,
  resetVoice,
  updateTotalProcessingTime,
} = voiceSlice.actions;

export default voiceSlice.reducer;
