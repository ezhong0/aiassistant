import type { IChatRepository } from '../interfaces';
import type { APIResponse, Message } from '../../types';

export class MockChatRepository implements IChatRepository {
  private messages: Message[] = [];
  private messageId = 1;

  async sendMessage(message: string): Promise<APIResponse<Message>> {
    const newMessage: Message = {
      id: `msg_${this.messageId++}`,
      text: message,
      isUser: true,
      timestamp: new Date(),
    };
    
    this.messages.push(newMessage);
    
    // Simulate AI response
    const aiResponse: Message = {
      id: `msg_${this.messageId++}`,
      text: `Mock AI response to: "${message}"`,
      isUser: false,
      timestamp: new Date(),
    };
    
    this.messages.push(aiResponse);
    
    return { success: true, data: aiResponse };
  }

  async getConversationHistory(limit: number = 50): Promise<APIResponse<Message[]>> {
    const limitedMessages = this.messages.slice(-limit);
    return { success: true, data: limitedMessages };
  }

  async clearConversation(): Promise<APIResponse<boolean>> {
    this.messages = [];
    return { success: true, data: true };
  }

  // Helper method for testing
  getMessageCount(): number {
    return this.messages.length;
  }

  // Helper method to add test messages
  addTestMessage(message: Message): void {
    this.messages.push(message);
  }
}
