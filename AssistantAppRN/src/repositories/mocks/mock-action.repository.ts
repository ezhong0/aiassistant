import type { IActionRepository } from '../interfaces';
import type { APIResponse, ActionCard } from '../../types';

export class MockActionRepository implements IActionRepository {
  private actions: ActionCard[] = [
    {
      id: 'action_1',
      type: 'email',
      title: 'Send Email',
      description: 'Send an email to a contact',
      icon: '📧',
      data: { recipient: '', subject: '', body: '' },
      timestamp: new Date(),
    },
    {
      id: 'action_2',
      type: 'calendar',
      title: 'Schedule Meeting',
      description: 'Schedule a new meeting',
      icon: '📅',
      data: { title: '', date: '', attendees: [] },
      timestamp: new Date(),
    },
    {
      id: 'action_3',
      type: 'contact',
      title: 'Add Contact',
      description: 'Add a new contact to your list',
      icon: '👤',
      data: { name: '', email: '', phone: '' },
      timestamp: new Date(),
    },
  ];

  async getActionCards(): Promise<APIResponse<ActionCard[]>> {
    return { success: true, data: [...this.actions] };
  }

  async executeAction(actionId: string, data: any): Promise<APIResponse<any>> {
    const action = this.actions.find(a => a.id === actionId);
    if (!action) {
      return { success: false, error: 'Action not found' };
    }

    // Simulate action execution
    const result = {
      actionId,
      actionType: action.type,
      executedAt: new Date(),
      data,
      status: 'completed',
    };

    return { success: true, data: result };
  }

  async getActionById(actionId: string): Promise<APIResponse<ActionCard>> {
    const action = this.actions.find(a => a.id === actionId);
    if (!action) {
      return { success: false, error: 'Action not found' };
    }
    return { success: true, data: action };
  }

  async createCustomAction(data: Partial<ActionCard>): Promise<APIResponse<ActionCard>> {
    const newAction: ActionCard = {
      id: `action_${Date.now()}`,
      type: data.type || 'general',
      title: data.title || 'Custom Action',
      description: data.description || 'A custom action',
      icon: data.icon || '⚡',
      data: data.data || {},
      timestamp: new Date(),
    };

    this.actions.push(newAction);
    return { success: true, data: newAction };
  }

  // Helper method for testing
  getActionCount(): number {
    return this.actions.length;
  }

  // Helper method to add test actions
  addTestAction(action: ActionCard): void {
    this.actions.push(action);
  }
}
