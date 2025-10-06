/**
 * Onboarding Context - State management for onboarding flow
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingStep = 'welcome' | 'email-connection' | 'permissions' | 'tutorial' | 'complete';

export interface OnboardingState {
  currentStep: OnboardingStep;
  hasCompletedOnboarding: boolean;
  emailConnected: boolean;
  permissionsGranted: boolean;
}

interface OnboardingContextValue {
  state: OnboardingState;
  nextStep: () => void;
  previousStep: () => void;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  connectEmail: () => void;
  grantPermissions: () => void;
}

const ONBOARDING_STORAGE_KEY = '@onboarding_completed';

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const STEP_FLOW: OnboardingStep[] = ['welcome', 'email-connection', 'permissions', 'tutorial', 'complete'];

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 'welcome',
    hasCompletedOnboarding: false,
    emailConnected: false,
    permissionsGranted: false,
  });

  const nextStep = useCallback(() => {
    setState(prev => {
      const currentIndex = STEP_FLOW.indexOf(prev.currentStep);
      const nextIndex = Math.min(currentIndex + 1, STEP_FLOW.length - 1);
      return {
        ...prev,
        currentStep: STEP_FLOW[nextIndex],
      };
    });
  }, []);

  const previousStep = useCallback(() => {
    setState(prev => {
      const currentIndex = STEP_FLOW.indexOf(prev.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return {
        ...prev,
        currentStep: STEP_FLOW[prevIndex],
      };
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setState(prev => ({
        ...prev,
        hasCompletedOnboarding: true,
        currentStep: 'complete',
      }));
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, []);

  const skipOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setState(prev => ({
        ...prev,
        hasCompletedOnboarding: true,
      }));
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
      setState({
        currentStep: 'welcome',
        hasCompletedOnboarding: false,
        emailConnected: false,
        permissionsGranted: false,
      });
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  }, []);

  const connectEmail = useCallback(() => {
    setState(prev => ({
      ...prev,
      emailConnected: true,
    }));
  }, []);

  const grantPermissions = useCallback(() => {
    setState(prev => ({
      ...prev,
      permissionsGranted: true,
    }));
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        nextStep,
        previousStep,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding,
        connectEmail,
        grantPermissions,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

export const checkOnboardingComplete = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Failed to check onboarding status:', error);
    return false;
  }
};
