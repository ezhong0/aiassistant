// Core domain entities
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  metadata?: MessageMetadata;
  conversationId: string;
}

export interface MessageMetadata {
  type: 'text' | 'action' | 'error' | 'system';
  actionData?: any;
  attachments?: Attachment[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface Attachment {
  id: string;
  type: 'image' | 'document' | 'audio' | 'video';
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ActionCard {
  id: string;
  type: 'email' | 'calendar' | 'contact' | 'general' | 'custom';
  title: string;
  description: string;
  icon: string;
  data: any;
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  category: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  tags: string[];
  summary?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  actionItems?: string[];
}
