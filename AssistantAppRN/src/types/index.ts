// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

// Message types
export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  metadata?: {
    type?: 'text' | 'action' | 'error';
    actionData?: any;
  };
}

// Action types (similar to your Swift ActionCard)
export interface ActionCard {
  id: string;
  type: 'email' | 'calendar' | 'contact' | 'general';
  title: string;
  description: string;
  icon: string;
  data: any;
  timestamp: Date;
}

// API response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Authentication types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

// Navigation types
export interface RootStackParamList {
  Loading: undefined;
  SignIn: undefined;
  Chat: undefined;
}
