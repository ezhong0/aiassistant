/**
 * Onboarding Flow - Main orchestrator for onboarding screens
 */
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboarding, OnboardingStep } from './OnboardingContext';
import WelcomeScreen from './WelcomeScreen';
import EmailConnectionScreen from './EmailConnectionScreen';
import PermissionsScreen from './PermissionsScreen';
import OnboardingCompleteScreen from './OnboardingCompleteScreen';
import ProgressIndicator from './ProgressIndicator';
import { designSystem } from '../../design-system';

const { colors } = designSystem;

interface OnboardingFlowProps {
  onComplete: () => void;
  isDarkMode?: boolean;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  isDarkMode = false,
}) => {
  const {
    state,
    nextStep,
    previousStep,
    completeOnboarding,
    skipOnboarding,
    connectEmail,
    grantPermissions,
  } = useOnboarding();

  const themeColors = isDarkMode ? colors.dark : colors.light;

  const handleWelcomeContinue = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const handleEmailConnect = useCallback(() => {
    connectEmail();
    nextStep();
  }, [connectEmail, nextStep]);

  const handlePermissionsGrant = useCallback(() => {
    grantPermissions();
    nextStep();
  }, [grantPermissions, nextStep]);

  const handleSkipToApp = useCallback(async () => {
    await skipOnboarding();
    onComplete();
  }, [skipOnboarding, onComplete]);

  const handleComplete = useCallback(async () => {
    await completeOnboarding();
    onComplete();
  }, [completeOnboarding, onComplete]);

  const getCurrentStepIndex = (): number => {
    const steps: OnboardingStep[] = ['welcome', 'email-connection', 'permissions', 'complete'];
    return steps.indexOf(state.currentStep);
  };

  const renderCurrentScreen = () => {
    switch (state.currentStep) {
      case 'welcome':
        return (
          <WelcomeScreen
            onContinue={handleWelcomeContinue}
            onSkip={handleSkipToApp}
            isDarkMode={isDarkMode}
          />
        );

      case 'email-connection':
        return (
          <EmailConnectionScreen
            onConnect={handleEmailConnect}
            onSkip={nextStep}
            isDarkMode={isDarkMode}
          />
        );

      case 'permissions':
        return (
          <PermissionsScreen
            onGrant={handlePermissionsGrant}
            onSkip={nextStep}
            isDarkMode={isDarkMode}
          />
        );

      case 'complete':
        return (
          <OnboardingCompleteScreen
            onComplete={handleComplete}
            isDarkMode={isDarkMode}
          />
        );

      default:
        return (
          <WelcomeScreen
            onContinue={handleWelcomeContinue}
            onSkip={handleSkipToApp}
            isDarkMode={isDarkMode}
          />
        );
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      {/* Progress Indicator */}
      {state.currentStep !== 'complete' && (
        <ProgressIndicator
          currentStep={getCurrentStepIndex()}
          totalSteps={3}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Current Screen */}
      <View style={styles.content}>
        {renderCurrentScreen()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default OnboardingFlow;
