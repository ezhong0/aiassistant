import type { IActionRepository } from '../interfaces';
import type { APIResponse, ActionCard, BackendResponse } from '../../types';

export class MockActionRepository implements IActionRepository {
  private mockActionCards: ActionCard[] = [];
  private mockResponses: BackendResponse[] = [];

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Mock action cards
    this.mockActionCards = [
      {
        id: 'action_1',
        type: 'email',
        title: 'Send Email',
        description: 'Send a new email to john@example.com',
        icon: '📧',
        data: {
          to: 'john@example.com',
          subject: 'Meeting Follow-up',
          body: 'Hi John, following up on our meeting...',
        },
        timestamp: new Date(Date.now() - 300000),
      },
      {
        id: 'action_2',
        type: 'calendar',
        title: 'Schedule Meeting',
        description: 'Schedule a team meeting for tomorrow',
        icon: '📅',
        data: {
          title: 'Team Standup',
          date: new Date(Date.now() + 86400000).toISOString(),
          duration: 30,
          attendees: ['team@company.com'],
        },
        timestamp: new Date(Date.now() - 600000),
      },
      {
        id: 'action_3',
        type: 'contact',
        title: 'Add Contact',
        description: 'Add Sarah Johnson to contacts',
        icon: '👤',
        data: {
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          phone: '+1-555-0123',
          company: 'Tech Corp',
        },
        timestamp: new Date(Date.now() - 900000),
      },
    ];

    // Mock backend responses
    this.mockResponses = [
      {
        success: true,
        message: 'Action executed successfully',
        responseType: 'action_completed',
        sessionId: 'mock_session_123',
        context: { actionId: 'action_1', result: 'email_sent' },
      },
    ];
  }

  async getActionCards(): Promise<APIResponse<ActionCard[]>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return { success: true, data: [...this.mockActionCards] };
  }

  async executeAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Find the action
    const action = this.mockActionCards.find(a => a.id === actionId);
    if (!action) {
      return {
        success: false,
        error: 'Action not found',
      };
    }

    // Generate mock response based on action type
    let response: BackendResponse;
    switch (action.type) {
      case 'email':
        response = {
          success: true,
          message: 'Email sent successfully',
          responseType: 'action_completed',
          sessionId: sessionId || 'mock_session_123',
          context: { actionId, result: 'email_sent', recipient: data.to },
        };
        break;
      case 'calendar':
        response = {
          success: true,
          message: 'Meeting scheduled successfully',
          responseType: 'action_completed',
          sessionId: sessionId || 'mock_session_123',
          context: { actionId, result: 'meeting_scheduled', meetingId: 'meeting_123' },
        };
        break;
      case 'contact':
        response = {
          success: true,
          message: 'Contact added successfully',
          responseType: 'action_completed',
          sessionId: sessionId || 'mock_session_123',
          context: { actionId, result: 'contact_added', contactId: 'contact_456' },
        };
        break;
      default:
        response = {
          success: true,
          message: 'Action executed successfully',
          responseType: 'action_completed',
          sessionId: sessionId || 'mock_session_123',
          context: { actionId, result: 'action_completed' },
        };
    }

    return { success: true, data: response };
  }

  async getActionById(actionId: string): Promise<APIResponse<ActionCard>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    const action = this.mockActionCards.find(a => a.id === actionId);
    if (!action) {
      return {
        success: false,
        error: 'Action not found',
      };
    }

    return { success: true, data: action };
  }

  async createCustomAction(data: Partial<ActionCard>): Promise<APIResponse<ActionCard>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 150));

    const newAction: ActionCard = {
      id: `action_${Date.now()}`,
      type: data.type || 'general',
      title: data.title || 'Custom Action',
      description: data.description || 'A custom action',
      icon: data.icon || '⚡',
      data: data.data || {},
      timestamp: new Date(),
    };

    this.mockActionCards.push(newAction);
    return { success: true, data: newAction };
  }

  async confirmAction(actionId: string, data: any, sessionId?: string): Promise<APIResponse<BackendResponse>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Find the action
    const action = this.mockActionCards.find(a => a.id === actionId);
    if (!action) {
      return {
        success: false,
        error: 'Action not found',
      };
    }

    // Generate confirmation response
    const response: BackendResponse = {
      success: true,
      message: `Action "${action.title}" confirmed and ready for execution`,
      responseType: 'confirmation_required',
      actions: [action],
      sessionId: sessionId || 'mock_session_123',
      context: { actionId, confirmed: true, data },
    };

    return { success: true, data: response };
  }

  // Helper methods for testing
  getMockActionCards(): ActionCard[] {
    return [...this.mockActionCards];
  }

  setMockActionCards(actions: ActionCard[]): void {
    this.mockActionCards = [...actions];
  }

  getMockResponses(): BackendResponse[] {
    return [...this.mockResponses];
  }

  setMockResponses(responses: BackendResponse[]): void {
    this.mockResponses = [...responses];
  }

  addMockAction(action: ActionCard): void {
    this.mockActionCards.push(action);
  }

  removeMockAction(actionId: string): void {
    this.mockActionCards = this.mockActionCards.filter(a => a.id !== actionId);
  }

  resetMockData(): void {
    this.mockActionCards = [];
    this.mockResponses = [];
  }
}
