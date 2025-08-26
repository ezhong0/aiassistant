import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API
import { api } from './api';

// Slices
import { chatSlice, actionsSlice, userSlice, voiceSlice } from './slices';

// Root reducer
const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  chat: chatSlice,
  actions: actionsSlice,
  user: userSlice,
  voice: voiceSlice,
});

// Persistence configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['user', 'chat', 'actions'], // Don't persist voice state
  blacklist: ['voice'], // Exclude voice state from persistence
  // Transform dates back to Date objects
  transforms: [
    {
      in: (state: any) => {
        // Transform dates in messages
        if (state.chat?.messages) {
          state.chat.messages = state.chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        }
        // Transform dates in action cards
        if (state.actions?.actionCards) {
          state.actions.actionCards = state.actions.actionCards.map((action: any) => ({
            ...action,
            timestamp: new Date(action.timestamp),
          }));
        }
        return state;
      },
      out: (state: any) => {
        // Transform dates to ISO strings for storage
        if (state.chat?.messages) {
          state.chat.messages = state.chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp.toISOString(),
          }));
        }
        if (state.actions?.actionCards) {
          state.actions.actionCards = state.actions.actionCards.map((action: any) => ({
            ...action,
            timestamp: action.timestamp.toISOString(),
          }));
        }
        return state;
      },
    },
  ],
};

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Store configuration
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore non-serializable values in specific actions
        ignoredActionPaths: [
          'voice.audioBlob',
          'voice.audioUri',
        ],
        // Ignore non-serializable values in state
        ignoredPaths: [
          'voice.audioBlob',
          'voice.audioUri',
        ],
      },
    }).concat(api.middleware),
  devTools: __DEV__,
});

// Persistor for persistence
export const persistor = persistStore(store);

// Setup listeners for RTK Query
setupListeners(store.dispatch);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store and persistor
export { store as default, persistor };
