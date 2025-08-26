import type { IChatRepository } from '../interfaces';
import type { APIResponse, Message, BackendResponse } from '../../types';

export class MockChatRepository implements IChatRepository {
  private mockMessages: Message[] = [];
  private mockResponses: BackendResponse[] = [];

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Mock conversation history
    this.mockMessages = [
      {
        id: '1',
        text: 'Hello, how can I help you today?',
        isUser: false,
        timestamp: new Date(Date.now() - 60000),
        metadata: { type: 'text' },
      },
      {
        id: '2',
        text: 'I need to schedule a meeting',
        isUser: true,
        timestamp: new Date(Date.now() - 30000),
        metadata: { type: 'text' },
      },
    ];

    // Mock backend responses
    this.mockResponses = [
      {
        success: true,
        message: 'I can help you schedule a meeting. When would you like to meet?',
        responseType: 'confirmation_required',
        actions: [
          {
            id: 'action_1',
            type: 'calendar',
            title: 'Schedule Meeting',
            description: 'Schedule a new meeting in your calendar',
            icon: '📅',
            data: { type: 'meeting_scheduling' },
            timestamp: new Date(),
          },
        ],
        sessionId: 'mock_session_123',
        context: { intent: 'schedule_meeting' },
      },
    ];
  }

  async sendMessage(message: string, sessionId?: string): Promise<APIResponse<BackendResponse>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Add user message to mock history
    const userMessage: Message = {
      id: Date.now().toString(),
      text: message,
      isUser: true,
      timestamp: new Date(),
      metadata: { type: 'text' },
    };
    this.mockMessages.push(userMessage);

    // Generate mock response based on message content
    let response: BackendResponse;
    if (message.toLowerCase().includes('meeting') || message.toLowerCase().includes('schedule')) {
      response = {
        success: true,
        message: 'I can help you schedule a meeting. When would you like to meet?',
        responseType: 'confirmation_required',
        actions: [
          {
            id: `action_${Date.now()}`,
            type: 'calendar',
            title: 'Schedule Meeting',
            description: 'Schedule a new meeting in your calendar',
            icon: '📅',
            data: { type: 'meeting_scheduling' },
            timestamp: new Date(),
          },
        ],
        sessionId: sessionId || 'mock_session_123',
        context: { intent: 'schedule_meeting' },
      };
    } else if (message.toLowerCase().includes('email') || message.toLowerCase().includes('send')) {
      response = {
        success: true,
        message: 'I can help you send an email. What would you like to say?',
        responseType: 'confirmation_required',
        actions: [
          {
            id: `action_${Date.now()}`,
            type: 'email',
            title: 'Send Email',
            description: 'Send a new email',
            icon: '📧',
            data: { type: 'email_composition' },
            timestamp: new Date(),
          },
        ],
        sessionId: sessionId || 'mock_session_123',
        context: { intent: 'send_email' },
      };
    } else {
      response = {
        success: true,
        message: 'I understand you said: ' + message,
        responseType: 'session_data',
        sessionId: sessionId || 'mock_session_123',
        context: { intent: 'general_conversation' },
      };
    }

    // Add AI response to mock history
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: response.message || 'I understand your request.',
      isUser: false,
      timestamp: new Date(),
      metadata: { type: 'text', actionData: response.actions },
    };
    this.mockMessages.push(aiMessage);

    return { success: true, data: response };
  }

  async getConversationHistory(limit: number = 50): Promise<APIResponse<Message[]>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    const limitedMessages = this.mockMessages.slice(-limit);
    return { success: true, data: limitedMessages };
  }

  async clearConversation(): Promise<APIResponse<boolean>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    this.mockMessages = [];
    return { success: true, data: true };
  }

  async getSession(sessionId: string): Promise<APIResponse<BackendResponse>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    const mockSession: BackendResponse = {
      success: true,
      message: 'Session retrieved successfully',
      responseType: 'session_data',
      sessionId,
      context: { lastActivity: new Date().toISOString() },
    };

    return { success: true, data: mockSession };
  }

  // Helper methods for testing
  getMockMessages(): Message[] {
    return [...this.mockMessages];
  }

  setMockMessages(messages: Message[]): void {
    this.mockMessages = [...messages];
  }

  getMockResponses(): BackendResponse[] {
    return [...this.mockResponses];
  }

  setMockResponses(responses: BackendResponse[]): void {
    this.mockResponses = [...responses];
  }
}
