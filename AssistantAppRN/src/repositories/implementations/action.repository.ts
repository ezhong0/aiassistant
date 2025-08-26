import type { IActionRepository } from '../interfaces';
import type { APIResponse, ActionCard } from '../../types';
import { api } from '../../store/api';

export class ActionRepository implements IActionRepository {
  async getActionCards(): Promise<APIResponse<ActionCard[]>> {
    try {
      // Use RTK Query hook result
      const response = await fetch('http://localhost:3000/assistant/actions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      return { success: response.ok, data, error: response.ok ? undefined : data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get action cards',
      };
    }
  }

  async executeAction(actionId: string, data: any): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`http://localhost:3000/assistant/actions/${actionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      return { success: response.ok, data: result, error: response.ok ? undefined : result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute action',
      };
    }
  }

  async getActionById(actionId: string): Promise<APIResponse<ActionCard>> {
    try {
      const response = await fetch(`http://localhost:3000/assistant/actions/${actionId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      return { success: response.ok, data, error: response.ok ? undefined : data.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get action by ID',
      };
    }
  }

  async createCustomAction(data: Partial<ActionCard>): Promise<APIResponse<ActionCard>> {
    try {
      const response = await fetch('http://localhost:3000/assistant/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      return { success: response.ok, data: result, error: response.ok ? undefined : result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create custom action',
      };
    }
  }
}
