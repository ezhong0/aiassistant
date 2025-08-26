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

// Backend response types from multi-agent system
export interface BackendResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  responseType?: 'confirmation_required' | 'action_completed' | 'partial_success' | 'session_data';
  actions?: ActionCard[];
  sessionId?: string;
  context?: any;
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

// Error types for proper error handling
export interface AppError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

// Retry configuration for repository operations
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

// Offline support types
export interface OfflineQueueItem {
  id: string;
  action: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}

// Cache configuration
export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of items in cache
}
