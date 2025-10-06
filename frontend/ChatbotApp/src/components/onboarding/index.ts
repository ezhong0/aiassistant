/**
 * Onboarding Components - Centralized exports
 */
export { default as OnboardingFlow } from './OnboardingFlow';
export { default as WelcomeScreen } from './WelcomeScreen';
export { default as EmailConnectionScreen } from './EmailConnectionScreen';
export { default as PermissionsScreen } from './PermissionsScreen';
export { default as OnboardingCompleteScreen } from './OnboardingCompleteScreen';
export { default as ProgressIndicator } from './ProgressIndicator';
export { default as Tooltip } from './Tooltip';
export { default as TutorialManager, resetTutorial, checkTutorialComplete, type TutorialStep } from './TutorialManager';
export {
  OnboardingProvider,
  useOnboarding,
  checkOnboardingComplete,
  type OnboardingState,
  type OnboardingStep,
} from './OnboardingContext';
