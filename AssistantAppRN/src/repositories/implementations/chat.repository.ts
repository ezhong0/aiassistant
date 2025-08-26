import type { IChatRepository } from '../interfaces';
import type { APIResponse, Message } from '../../types';
import { api } from '../../store/api';

export class ChatRepository implements IChatRepository {
  async sendMessage(message: string): Promise<APIResponse<Message>> {
    try {
      // Use RTK Query mutation
      const result = await api.util.getRunningQueryThunk('sendMessage', { message });
      if (result?.fulfilledTimeStamp) {
        return { success: true, data: result.data };
      }
      
      // Fallback to direct API call if needed
      const response = await fetch('http://localhost:3000/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      
      const data = await response.json();
      return { success: response.ok, data, error: response.ok ? undefined : data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  }

  async getConversationHistory(limit: number = 50): Promise<APIResponse<Message[]>> {
    try {
      // TODO: Implement conversation history endpoint
      // For now, return empty array
      return { success: true, data: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversation history',
      };
    }
  }

  async clearConversation(): Promise<APIResponse<boolean>> {
    try {
      // TODO: Implement clear conversation endpoint
      // For now, just invalidate cache
      api.util.invalidateTags(['Chat']);
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear conversation',
      };
    }
  }
}
