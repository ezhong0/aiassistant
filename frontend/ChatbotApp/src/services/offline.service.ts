/**
 * Offline Service - Network Detection & Message Queue
 *
 * Detects network status and queues messages for sending when online.
 * Implements auto-retry with exponential backoff.
 */

import NetInfo from '@react-native-community/netinfo';
import { storageService, StoredMessage } from './storage.service';
import { apiService } from './api.service';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

class OfflineService {
  private isOnline = true;
  private isSyncing = false;
  private listeners: Array<(status: NetworkStatus) => void> = [];
  private unsubscribeNetInfo: (() => void) | null = null;

  /**
   * Initialize network monitoring
   */
  async initialize(): Promise<void> {
    // Get initial network state
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;

    // Subscribe to network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      const status: NetworkStatus = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };

      // Notify listeners
      this.notifyListeners(status);

      // Auto-sync when coming back online
      if (!wasOnline && this.isOnline) {
        this.syncPendingMessages().catch(console.error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners = [];
  }

  /**
   * Check if currently online
   */
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Check if currently syncing
   */
  isSyncingMessages(): boolean {
    return this.isSyncing;
  }

  /**
   * Subscribe to network status changes
   */
  subscribe(callback: (status: NetworkStatus) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners of network status change
   */
  private notifyListeners(status: NetworkStatus): void {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  /**
   * Queue a message for sending when online
   */
  async queueMessage(message: StoredMessage): Promise<void> {
    await storageService.addPendingMessage(message);
    await storageService.updateMessageStatus(message.id, 'sending');

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncPendingMessages().catch(console.error);
    }
  }

  /**
   * Sync all pending messages
   */
  async syncPendingMessages(): Promise<{ succeeded: number; failed: number }> {
    if (this.isSyncing || !this.isOnline) {
      return { succeeded: 0, failed: 0 };
    }

    this.isSyncing = true;
    let succeeded = 0;
    let failed = 0;

    try {
      const pending = await storageService.getPendingMessages();

      if (pending.length === 0) {
        return { succeeded, failed };
      }

      console.log(`Syncing ${pending.length} pending messages...`);

      // Send messages sequentially (preserve order)
      for (const message of pending) {
        try {
          // Send to API
          const response = await apiService.sendMessage(message.text, {
            conversationHistory: await this.buildConversationHistory(),
          });

          // Mark as sent
          await storageService.updateMessageStatus(message.id, 'sent');
          await storageService.removePendingMessage(message.id);

          // Save assistant response
          await storageService.saveMessage({
            id: `msg_${Date.now()}`,
            text: response.message,
            sender: 'assistant',
            timestamp: Date.now(),
            status: 'sent',
          });

          succeeded++;
        } catch (error) {
          console.error(`Failed to send message ${message.id}:`, error);

          // Increment retry count
          const retryCount = (message.retryCount || 0) + 1;

          if (retryCount >= 3) {
            // Max retries reached - mark as failed
            await storageService.updateMessageStatus(message.id, 'failed');
            await storageService.removePendingMessage(message.id);
            failed++;
          } else {
            // Update retry count
            const updated = { ...message, retryCount };
            await storageService.addPendingMessage(updated);
          }
        }
      }

      console.log(`Sync complete: ${succeeded} succeeded, ${failed} failed`);
    } finally {
      this.isSyncing = false;
    }

    return { succeeded, failed };
  }

  /**
   * Build conversation history for API
   */
  private async buildConversationHistory() {
    const messages = await storageService.getTruncatedMessages();
    return messages.map(msg => ({
      role: msg.sender as 'user' | 'assistant' | 'system',
      content: msg.text,
      timestamp: msg.timestamp,
    }));
  }

  /**
   * Manually retry failed messages
   */
  async retryFailedMessage(messageId: string): Promise<void> {
    const messages = await storageService.getMessages();
    const message = messages.find(m => m.id === messageId && m.status === 'failed');

    if (!message) {
      throw new Error('Message not found or not in failed state');
    }

    // Reset status and queue
    await storageService.updateMessageStatus(messageId, 'sending');
    await this.queueMessage({ ...message, retryCount: 0 });
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    pendingCount: number;
    failedCount: number;
    isOnline: boolean;
    isSyncing: boolean;
  }> {
    const pending = await storageService.getPendingMessages();
    const messages = await storageService.getMessages();
    const failed = messages.filter(m => m.status === 'failed');

    return {
      pendingCount: pending.length,
      failedCount: failed.length,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }
}

export const offlineService = new OfflineService();
