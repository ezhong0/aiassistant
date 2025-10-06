/**
 * Tutorial Manager - Orchestrates in-app tutorials
 */
import React, { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tooltip from './Tooltip';

const TUTORIAL_STORAGE_KEY = '@tutorial_completed';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'center';
}

interface TutorialManagerProps {
  steps: TutorialStep[];
  onComplete: () => void;
  isDarkMode?: boolean;
  autoStart?: boolean;
}

const TutorialManager: React.FC<TutorialManagerProps> = ({
  steps,
  onComplete,
  isDarkMode = false,
  autoStart = true,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
        if (completed === 'true') {
          setHasCompleted(true);
        } else if (autoStart) {
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Failed to check tutorial status:', error);
        if (autoStart) {
          setIsVisible(true);
        }
      }
    };

    checkTutorialStatus();
  }, [autoStart]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStepIndex, steps.length]);

  const handleComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      setHasCompleted(true);
      setIsVisible(false);
      onComplete();
    } catch (error) {
      console.error('Failed to save tutorial status:', error);
      setIsVisible(false);
      onComplete();
    }
  }, [onComplete]);

  const handleSkip = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      setHasCompleted(true);
      setIsVisible(false);
      onComplete();
    } catch (error) {
      console.error('Failed to skip tutorial:', error);
      setIsVisible(false);
      onComplete();
    }
  }, [onComplete]);

  if (hasCompleted || !isVisible || steps.length === 0) {
    return null;
  }

  const currentStep = steps[currentStepIndex];

  return (
    <Tooltip
      visible={isVisible}
      title={currentStep.title}
      description={currentStep.description}
      position={currentStep.position}
      onDismiss={handleSkip}
      onNext={handleNext}
      isDarkMode={isDarkMode}
      showSkip={true}
      currentStep={currentStepIndex}
      totalSteps={steps.length}
    />
  );
};

export const resetTutorial = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset tutorial:', error);
  }
};

export const checkTutorialComplete = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Failed to check tutorial status:', error);
    return false;
  }
};

export default TutorialManager;
