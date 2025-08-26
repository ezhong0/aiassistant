import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthState } from '../../types';

export interface UserState {
  // Authentication state
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  
  // Loading states
  isLoading: boolean;
  isSigningIn: boolean;
  isUpdatingProfile: boolean;
  
  // Error handling
  error: string | null;
  authError: string | null;
  
  // Session management
  sessionId: string | null;
  lastActivity: number | null;
  tokenExpiry: number | null;
  
  // Offline support
  isOnline: boolean;
  pendingAuthActions: string[];
}

const initialState: UserState = {
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  isSigningIn: false,
  isUpdatingProfile: false,
  error: null,
  authError: null,
  sessionId: null,
  lastActivity: null,
  tokenExpiry: null,
  isOnline: true,
  pendingAuthActions: [],
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    // Authentication actions
    signInStart: (state) => {
      state.isSigningIn = true;
      state.authError = null;
    },
    
    signInSuccess: (state, action: PayloadAction<{ user: User; token: string; refreshToken?: string }>) => {
      const { user, token, refreshToken } = action.payload;
      state.isAuthenticated = true;
      state.user = user;
      state.token = token;
      state.refreshToken = refreshToken || null;
      state.isSigningIn = false;
      state.authError = null;
      state.lastActivity = Date.now();
      state.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours default
    },
    
    signInFailure: (state, action: PayloadAction<string>) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isSigningIn = false;
      state.authError = action.payload;
      state.lastActivity = null;
      state.tokenExpiry = null;
    },
    
    signOut: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.sessionId = null;
      state.lastActivity = null;
      state.tokenExpiry = null;
      state.authError = null;
      state.pendingAuthActions = [];
    },
    
    // Token management
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.lastActivity = Date.now();
    },
    
    setRefreshToken: (state, action: PayloadAction<string>) => {
      state.refreshToken = action.payload;
    },
    
    updateTokenExpiry: (state, action: PayloadAction<number>) => {
      state.tokenExpiry = action.payload;
    },
    
    // User profile management
    updateProfileStart: (state) => {
      state.isUpdatingProfile = true;
      state.error = null;
    },
    
    updateProfileSuccess: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isUpdatingProfile = false;
      state.error = null;
      state.lastActivity = Date.now();
    },
    
    updateProfileFailure: (state, action: PayloadAction<string>) => {
      state.isUpdatingProfile = false;
      state.error = action.payload;
    },
    
    // Session management
    setUserSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload;
      state.lastActivity = Date.now();
    },
    
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    
    // Online/offline status
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    
    // Pending actions for offline scenarios
    addPendingAuthAction: (state, action: PayloadAction<string>) => {
      if (!state.pendingAuthActions.includes(action.payload)) {
        state.pendingAuthActions.push(action.payload);
      }
    },
    
    removePendingAuthAction: (state, action: PayloadAction<string>) => {
      state.pendingAuthActions = state.pendingAuthActions.filter(action => action !== action.payload);
    },
    
    clearPendingAuthActions: (state) => {
      state.pendingAuthActions = [];
    },
    
    // Loading states
    setUserLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // Error handling
    setUserError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    setAuthError: (state, action: PayloadAction<string | null>) => {
      state.authError = action.payload;
    },
    
    clearUserError: (state) => {
      state.error = null;
      state.authError = null;
    },
    
    // Reset state
    resetUser: (state) => {
      return { ...initialState };
    },
    
    // Token refresh
    refreshTokenStart: (state) => {
      state.isLoading = true;
      state.authError = null;
    },
    
    refreshTokenSuccess: (state, action: PayloadAction<{ token: string; refreshToken?: string }>) => {
      const { token, refreshToken } = action.payload;
      state.token = token;
      state.refreshToken = refreshToken || state.refreshToken;
      state.isLoading = false;
      state.authError = null;
      state.lastActivity = Date.now();
      state.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours default
    },
    
    refreshTokenFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.authError = action.payload;
      // If refresh fails, user should re-authenticate
      state.isAuthenticated = false;
      state.token = null;
      state.refreshToken = null;
    },
  },
});

export const {
  signInStart,
  signInSuccess,
  signInFailure,
  signOut,
  setToken,
  setRefreshToken,
  updateTokenExpiry,
  updateProfileStart,
  updateProfileSuccess,
  updateProfileFailure,
  setUserSessionId,
  updateLastActivity,
  setOnlineStatus,
  addPendingAuthAction,
  removePendingAuthAction,
  clearPendingAuthActions,
  setUserLoading,
  setUserError,
  setAuthError,
  clearUserError,
  resetUser,
  refreshTokenStart,
  refreshTokenSuccess,
  refreshTokenFailure,
} = userSlice.actions;

export default userSlice.reducer;
