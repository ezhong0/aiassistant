import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ActionCard, BackendResponse } from '../../types';

export interface ActionState {
  actionCards: ActionCard[];
  pendingActions: ActionCard[];
  completedActions: ActionCard[];
  failedActions: ActionCard[];
  isLoading: boolean;
  error: string | null;
  selectedActionId: string | null;
  actionExecutionStatus: 'idle' | 'pending' | 'executing' | 'completed' | 'failed';
  lastActionTimestamp: number | null;
}

const initialState: ActionState = {
  actionCards: [],
  pendingActions: [],
  completedActions: [],
  failedActions: [],
  isLoading: false,
  error: null,
  selectedActionId: null,
  actionExecutionStatus: 'idle',
  lastActionTimestamp: null,
};

const actionsSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    // Action card management
    setActionCards: (state, action: PayloadAction<ActionCard[]>) => {
      state.actionCards = action.payload;
      state.lastActionTimestamp = Date.now();
    },
    
    addActionCard: (state, action: PayloadAction<ActionCard>) => {
      state.actionCards.push(action.payload);
      state.lastActionTimestamp = Date.now();
    },
    
    updateActionCard: (state, action: PayloadAction<{ id: string; updates: Partial<ActionCard> }>) => {
      const { id, updates } = action.payload;
      const actionIndex = state.actionCards.findIndex(action => action.id === id);
      if (actionIndex !== -1) {
        state.actionCards[actionIndex] = { ...state.actionCards[actionIndex], ...updates };
      }
    },
    
    removeActionCard: (state, action: PayloadAction<string>) => {
      state.actionCards = state.actionCards.filter(action => action.id !== action.payload);
    },
    
    // Action execution states
    setSelectedAction: (state, action: PayloadAction<string | null>) => {
      state.selectedActionId = action.payload;
    },
    
    setActionExecutionStatus: (state, action: PayloadAction<ActionState['actionExecutionStatus']>) => {
      state.actionExecutionStatus = action.payload;
    },
    
    // Action lifecycle management
    moveToPending: (state, action: PayloadAction<string>) => {
      const actionId = action.payload;
      const actionCard = state.actionCards.find(a => a.id === actionId);
      if (actionCard) {
        state.pendingActions.push(actionCard);
        state.actionCards = state.actionCards.filter(a => a.id !== actionId);
      }
    },
    
    moveToCompleted: (state, action: PayloadAction<string>) => {
      const actionId = action.payload;
      const actionCard = state.pendingActions.find(a => a.id === actionId) || 
                        state.actionCards.find(a => a.id === actionId);
      if (actionCard) {
        state.completedActions.push(actionCard);
        state.pendingActions = state.pendingActions.filter(a => a.id !== actionId);
        state.actionCards = state.actionCards.filter(a => a.id !== actionId);
        state.actionExecutionStatus = 'completed';
      }
    },
    
    moveToFailed: (state, action: PayloadAction<{ actionId: string; error: string }>) => {
      const { actionId, error } = action.payload;
      const actionCard = state.pendingActions.find(a => a.id === actionId) || 
                        state.actionCards.find(a => a.id === actionId);
      if (actionCard) {
        state.failedActions.push(actionCard);
        state.pendingActions = state.pendingActions.filter(a => a.id !== actionId);
        state.actionCards = state.actionCards.filter(a => a.id !== actionId);
        state.actionExecutionStatus = 'failed';
        state.error = error;
      }
    },
    
    // Process backend response for actions
    processActionResponse: (state, action: PayloadAction<BackendResponse>) => {
      const response = action.payload;
      
      if (response.actions && response.actions.length > 0) {
        // Add new action cards from backend response
        response.actions.forEach(action => {
          if (!state.actionCards.find(existing => existing.id === action.id)) {
            state.actionCards.push(action);
          }
        });
        state.lastActionTimestamp = Date.now();
      }
      
      // Handle different response types
      switch (response.responseType) {
        case 'confirmation_required':
          state.actionExecutionStatus = 'pending';
          break;
        case 'action_completed':
          state.actionExecutionStatus = 'completed';
          break;
        case 'partial_success':
          state.actionExecutionStatus = 'completed';
          break;
      }
    },
    
    // Loading states
    setActionsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // Error handling
    setActionsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearActionsError: (state) => {
      state.error = null;
    },
    
    // Reset state
    resetActions: (state) => {
      return { ...initialState };
    },
    
    // Clear completed/failed actions
    clearCompletedActions: (state) => {
      state.completedActions = [];
    },
    
    clearFailedActions: (state) => {
      state.failedActions = [];
    },
  },
});

export const {
  setActionCards,
  addActionCard,
  updateActionCard,
  removeActionCard,
  setSelectedAction,
  setActionExecutionStatus,
  moveToPending,
  moveToCompleted,
  moveToFailed,
  processActionResponse,
  setActionsLoading,
  setActionsError,
  clearActionsError,
  resetActions,
  clearCompletedActions,
  clearFailedActions,
} = actionsSlice.actions;

export default actionsSlice.reducer;
