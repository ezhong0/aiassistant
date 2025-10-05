/**
 * Storage Service - Local Conversation Persistence
 *
 * Manages conversation storage using AsyncStorage for offline-first architecture.
 * Implements conversation truncation and automatic cleanup.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  status?: 'sending' | 'sent' | 'failed';
  retryCount?: number;
}

export interface Conversation {
  id: string;
  messages: StoredMessage[];
  lastUpdated: number;
  synced: boolean;
}

export interface StorageData {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  pendingMessages: StoredMessage[];
}

const STORAGE_KEYS = {
  CONVERSATIONS: '@assistant:conversations',
  ACTIVE_CONVERSATION: '@assistant:activeConversation',
  PENDING_MESSAGES: '@assistant:pendingMessages',
};

const MAX_MESSAGES_PER_CONVERSATION = 100; // Keep last 100 messages locally
const MAX_CONVERSATIONS = 10; // Keep last 10 conversations

class StorageService {
  /**
   * Save a message to the active conversation
   */
  async saveMessage(message: StoredMessage): Promise<void> {
    try {
      const activeId = await this.getActiveConversationId();
      const conversationId = activeId || await this.createNewConversation();

      const conversation = await this.getConversation(conversationId);

      // Add message
      conversation.messages.push(message);

      // Truncate if exceeds limit
      if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
        conversation.messages = conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
      }

      conversation.lastUpdated = Date.now();
      conversation.synced = message.status === 'sent';

      await this.saveConversation(conversation);
    } catch (error) {
      console.error('Failed to save message:', error);
      throw error;
    }
  }

  /**
   * Get all messages from active conversation
   */
  async getMessages(): Promise<StoredMessage[]> {
    try {
      const activeId = await this.getActiveConversationId();
      if (!activeId) return [];

      const conversation = await this.getConversation(activeId);
      return conversation.messages;
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  /**
   * Get truncated messages for API (last 10 messages or 5000 tokens)
   */
  async getTruncatedMessages(): Promise<StoredMessage[]> {
    const messages = await this.getMessages();

    // Take last 10 messages
    let truncated = messages.slice(-10);

    // Estimate tokens (rough: 4 characters per token)
    let totalTokens = truncated.reduce((sum, msg) => {
      const contentLength = msg.text?.length || 0;
      return sum + Math.ceil(contentLength / 4);
    }, 0);

    // If still too large, remove oldest messages
    while (totalTokens > 5000 && truncated.length > 1) {
      const removed = truncated.shift();
      if (removed) {
        const removedTokens = Math.ceil((removed.text?.length || 0) / 4);
        totalTokens -= removedTokens;
      }
    }

    return truncated;
  }

  /**
   * Update message status (sending → sent/failed)
   */
  async updateMessageStatus(
    messageId: string,
    status: 'sending' | 'sent' | 'failed'
  ): Promise<void> {
    try {
      const activeId = await this.getActiveConversationId();
      if (!activeId) return;

      const conversation = await this.getConversation(activeId);

      const message = conversation.messages.find(m => m.id === messageId);
      if (message) {
        message.status = status;
        conversation.lastUpdated = Date.now();
        await this.saveConversation(conversation);
      }
    } catch (error) {
      console.error('Failed to update message status:', error);
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const activeId = await this.getActiveConversationId();
      if (!activeId) return;

      const conversation = await this.getConversation(activeId);
      conversation.messages = conversation.messages.filter(m => m.id !== messageId);
      conversation.lastUpdated = Date.now();

      await this.saveConversation(conversation);
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  }

  /**
   * Clear all messages in active conversation
   */
  async clearMessages(): Promise<void> {
    try {
      const activeId = await this.getActiveConversationId();
      if (!activeId) return;

      const conversation = await this.getConversation(activeId);
      conversation.messages = [];
      conversation.lastUpdated = Date.now();

      await this.saveConversation(conversation);
    } catch (error) {
      console.error('Failed to clear messages:', error);
      throw error;
    }
  }

  /**
   * Create a new conversation
   */
  async createNewConversation(): Promise<string> {
    const id = `conv_${Date.now()}`;
    const conversation: Conversation = {
      id,
      messages: [],
      lastUpdated: Date.now(),
      synced: true,
    };

    await this.saveConversation(conversation);
    await this.setActiveConversationId(id);

    // Cleanup old conversations
    await this.cleanupOldConversations();

    return id;
  }

  /**
   * Get conversation by ID
   */
  private async getConversation(id: string): Promise<Conversation> {
    try {
      const json = await AsyncStorage.getItem(`${STORAGE_KEYS.CONVERSATIONS}:${id}`);
      if (json) {
        return JSON.parse(json);
      }
    } catch (error) {
      console.error('Failed to get conversation:', error);
    }

    // Return empty conversation if not found
    return {
      id,
      messages: [],
      lastUpdated: Date.now(),
      synced: true,
    };
  }

  /**
   * Save conversation
   */
  private async saveConversation(conversation: Conversation): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.CONVERSATIONS}:${conversation.id}`,
        JSON.stringify(conversation)
      );
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  }

  /**
   * Get active conversation ID
   */
  private async getActiveConversationId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
    } catch (error) {
      console.error('Failed to get active conversation ID:', error);
      return null;
    }
  }

  /**
   * Set active conversation ID
   */
  private async setActiveConversationId(id: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, id);
    } catch (error) {
      console.error('Failed to set active conversation ID:', error);
      throw error;
    }
  }

  /**
   * Cleanup old conversations (keep last N)
   */
  private async cleanupOldConversations(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const conversationKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.CONVERSATIONS));

      if (conversationKeys.length > MAX_CONVERSATIONS) {
        // Get all conversations with timestamps
        const conversations = await Promise.all(
          conversationKeys.map(async key => {
            const json = await AsyncStorage.getItem(key);
            return json ? { key, data: JSON.parse(json) as Conversation } : null;
          })
        );

        // Sort by lastUpdated and remove oldest
        const sorted = conversations
          .filter(c => c !== null)
          .sort((a, b) => (b?.data.lastUpdated || 0) - (a?.data.lastUpdated || 0));

        const toDelete = sorted.slice(MAX_CONVERSATIONS);
        await Promise.all(toDelete.map(c => c && AsyncStorage.removeItem(c.key)));
      }
    } catch (error) {
      console.error('Failed to cleanup old conversations:', error);
    }
  }

  /**
   * Pending messages queue (for offline support)
   */
  async addPendingMessage(message: StoredMessage): Promise<void> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES);
      const pending: StoredMessage[] = json ? JSON.parse(json) : [];
      pending.push(message);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(pending));
    } catch (error) {
      console.error('Failed to add pending message:', error);
    }
  }

  async getPendingMessages(): Promise<StoredMessage[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES);
      return json ? JSON.parse(json) : [];
    } catch (error) {
      console.error('Failed to get pending messages:', error);
      return [];
    }
  }

  async removePendingMessage(messageId: string): Promise<void> {
    try {
      const pending = await this.getPendingMessages();
      const filtered = pending.filter(m => m.id !== messageId);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove pending message:', error);
    }
  }

  async clearPendingMessages(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify([]));
    } catch (error) {
      console.error('Failed to clear pending messages:', error);
    }
  }
}

export const storageService = new StorageService();
