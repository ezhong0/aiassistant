import type { Message, Conversation } from '../entities';
import type { IChatRepository } from '../../repositories/interfaces';

export interface SendMessageRequest {
  text: string;
  conversationId?: string;
  metadata?: any;
}

export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  conversation?: Conversation;
  error?: string;
}

export interface GetConversationHistoryRequest {
  conversationId?: string;
  limit?: number;
  offset?: number;
}

export interface GetConversationHistoryResponse {
  success: boolean;
  messages?: Message[];
  conversation?: Conversation;
  error?: string;
}

export class ChatUseCase {
  constructor(private chatRepository: IChatRepository) {}

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Validate input
      if (!request.text.trim()) {
        return {
          success: false,
          error: 'Message text cannot be empty',
        };
      }

      // Send message through repository
      const result = await this.chatRepository.sendMessage(request.text);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to send message',
        };
      }

      return {
        success: true,
        message: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getConversationHistory(request: GetConversationHistoryRequest): Promise<GetConversationHistoryResponse> {
    try {
      const result = await this.chatRepository.getConversationHistory(request.limit);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get conversation history',
        };
      }

      return {
        success: true,
        messages: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async clearConversation(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.chatRepository.clearConversation();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to clear conversation',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
