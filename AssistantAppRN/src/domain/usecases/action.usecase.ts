import type { ActionCard } from '../entities';
import type { IActionRepository } from '../../repositories/interfaces';

export interface ExecuteActionRequest {
  actionId: string;
  data: any;
  userId: string;
}

export interface ExecuteActionResponse {
  success: boolean;
  result?: any;
  action?: ActionCard;
  error?: string;
}

export interface CreateActionRequest {
  type: ActionCard['type'];
  title: string;
  description: string;
  icon: string;
  data: any;
  priority?: ActionCard['priority'];
  category: string;
}

export interface CreateActionResponse {
  success: boolean;
  action?: ActionCard;
  error?: string;
}

export class ActionUseCase {
  constructor(private actionRepository: IActionRepository) {}

  async getActionCards(): Promise<{ success: boolean; actions?: ActionCard[]; error?: string }> {
    try {
      const result = await this.actionRepository.getActionCards();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get action cards',
        };
      }

      return {
        success: true,
        actions: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async executeAction(request: ExecuteActionRequest): Promise<ExecuteActionResponse> {
    try {
      // Validate input
      if (!request.actionId) {
        return {
          success: false,
          error: 'Action ID is required',
        };
      }

      if (!request.userId) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      // Get action details first
      const actionResult = await this.actionRepository.getActionById(request.actionId);
      if (!actionResult.success || !actionResult.data) {
        return {
          success: false,
          error: 'Action not found',
        };
      }

      const action = actionResult.data;

      // Execute action through repository
      const result = await this.actionRepository.executeAction(request.actionId, request.data);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to execute action',
        };
      }

      return {
        success: true,
        result: result.data,
        action,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getActionById(actionId: string): Promise<{ success: boolean; action?: ActionCard; error?: string }> {
    try {
      if (!actionId) {
        return {
          success: false,
          error: 'Action ID is required',
        };
      }

      const result = await this.actionRepository.getActionById(actionId);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Action not found',
        };
      }

      return {
        success: true,
        action: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async createCustomAction(request: CreateActionRequest): Promise<CreateActionResponse> {
    try {
      // Validate input
      if (!request.title.trim()) {
        return {
          success: false,
          error: 'Action title is required',
        };
      }

      if (!request.description.trim()) {
        return {
          success: false,
          error: 'Action description is required',
        };
      }

      if (!request.category.trim()) {
        return {
          success: false,
          error: 'Action category is required',
        };
      }

      const actionData: Partial<ActionCard> = {
        type: request.type,
        title: request.title,
        description: request.description,
        icon: request.icon,
        data: request.data,
        priority: request.priority || 'medium',
        category: request.category,
      };

      const result = await this.actionRepository.createCustomAction(actionData);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to create custom action',
        };
      }

      return {
        success: true,
        action: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
