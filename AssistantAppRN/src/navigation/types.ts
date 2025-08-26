import type { NavigatorScreenParams } from '@react-navigation/native';

// Root Stack Navigator
export type RootStackParamList = {
  Loading: undefined;
  SignIn: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Main Tab Navigator
export type MainTabParamList = {
  Chat: undefined;
  Actions: undefined;
  Profile: undefined;
};

// Chat Stack Navigator
export type ChatStackParamList = {
  ChatList: undefined;
  ChatDetail: {
    conversationId: string;
    title?: string;
  };
};

// Action Stack Navigator
export type ActionStackParamList = {
  ActionList: undefined;
  ActionDetail: {
    actionId: string;
  };
  CreateAction: undefined;
};

// Profile Stack Navigator
export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Settings: undefined;
  About: undefined;
};

// Combined navigation types
export type AppNavigationParamList = 
  & RootStackParamList
  & MainTabParamList
  & ChatStackParamList
  & ActionStackParamList
  & ProfileStackParamList;
