import { BaseService } from './base-service';
import { ServiceManager } from './service-manager';
import { SLACK_SERVICE_CONSTANTS } from '../config/slack-service-constants';
import logger from '../utils/logger';

/**
 * Slack draft management result
 */
export interface SlackDraftManagementResult {
  success: boolean;
  draft?: any;
  drafts?: any[];
  count?: number;
  error?: string;
}

/**
 * Slack draft interface
 */
export interface SlackDraft {
  id: string;
  channelId: string;
  text: string;
  threadTs?: string;
  scheduledTime?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * SlackDraftManager - Focused service for Slack draft management
 * Handles creation, updating, deletion, and listing of Slack drafts
 */
export class SlackDraftManager extends BaseService {
  private drafts: Map<string, SlackDraft> = new Map();

  constructor() {
    super(SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_DRAFT_MANAGER);
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    try {
      this.logInfo('Initializing SlackDraftManager...');
      this.logInfo('SlackDraftManager initialized successfully');
    } catch (error) {
      this.handleError(error, 'onInitialize');
    }
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    try {
      this.logInfo('Destroying SlackDraftManager...');
      this.drafts.clear();
      this.logInfo('SlackDraftManager destroyed successfully');
    } catch (error) {
      this.logError('Error during SlackDraftManager destruction', error);
    }
  }

  /**
   * Create a new Slack draft
   */
  async createDraft(
    channelId: string,
    text: string,
    options: {
      threadTs?: string;
      scheduledTime?: string;
    } = {}
  ): Promise<SlackDraftManagementResult> {
    try {
      if (!channelId || channelId.trim().length === 0) {
        throw new Error(SLACK_SERVICE_CONSTANTS.ERRORS.CHANNEL_ID_REQUIRED);
      }

      if (!text || text.trim().length === 0) {
        throw new Error(SLACK_SERVICE_CONSTANTS.ERRORS.MESSAGE_TEXT_REQUIRED);
      }

      this.logInfo('Creating Slack draft', {
        channelId,
        textLength: text.length,
        hasThreadTs: !!options.threadTs,
        hasScheduledTime: !!options.scheduledTime
      });

      const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const draft: SlackDraft = {
        id: draftId,
        channelId,
        text,
        threadTs: options.threadTs,
        scheduledTime: options.scheduledTime,
        createdAt: now,
        updatedAt: now
      };

      this.drafts.set(draftId, draft);

      this.logInfo('Slack draft created successfully', {
        draftId,
        channelId
      });

      return {
        success: true,
        draft
      };
    } catch (error) {
      this.logError('Error creating Slack draft', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_CREATION_FAILED
      };
    }
  }

  /**
   * Update an existing Slack draft
   */
  async updateDraft(
    draftId: string,
    updates: {
      text?: string;
      scheduledTime?: string;
    }
  ): Promise<SlackDraftManagementResult> {
    try {
      if (!draftId || draftId.trim().length === 0) {
        throw new Error('Draft ID is required');
      }

      const existingDraft = this.drafts.get(draftId);
      if (!existingDraft) {
        throw new Error('Draft not found');
      }

      this.logInfo('Updating Slack draft', {
        draftId,
        hasTextUpdate: !!updates.text,
        hasScheduledTimeUpdate: !!updates.scheduledTime
      });

      const updatedDraft: SlackDraft = {
        ...existingDraft,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.drafts.set(draftId, updatedDraft);

      this.logInfo('Slack draft updated successfully', {
        draftId
      });

      return {
        success: true,
        draft: updatedDraft
      };
    } catch (error) {
      this.logError('Error updating Slack draft', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_UPDATE_FAILED
      };
    }
  }

  /**
   * Delete a Slack draft
   */
  async deleteDraft(draftId: string): Promise<SlackDraftManagementResult> {
    try {
      if (!draftId || draftId.trim().length === 0) {
        throw new Error('Draft ID is required');
      }

      const existingDraft = this.drafts.get(draftId);
      if (!existingDraft) {
        throw new Error('Draft not found');
      }

      this.logInfo('Deleting Slack draft', { draftId });

      this.drafts.delete(draftId);

      this.logInfo('Slack draft deleted successfully', { draftId });

      return {
        success: true
      };
    } catch (error) {
      this.logError('Error deleting Slack draft', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_DELETION_FAILED
      };
    }
  }

  /**
   * List Slack drafts
   */
  async listDrafts(
    channelId?: string,
    options: {
      limit?: number;
      includeScheduled?: boolean;
    } = {}
  ): Promise<SlackDraftManagementResult> {
    try {
      this.logInfo('Listing Slack drafts', {
        channelId,
        limit: options.limit,
        includeScheduled: options.includeScheduled
      });

      let drafts = Array.from(this.drafts.values());

      // Filter by channel if specified
      if (channelId) {
        drafts = drafts.filter(draft => draft.channelId === channelId);
      }

      // Filter by scheduled status if specified
      if (options.includeScheduled === false) {
        drafts = drafts.filter(draft => !draft.scheduledTime);
      } else if (options.includeScheduled === true) {
        drafts = drafts.filter(draft => !!draft.scheduledTime);
      }

      // Sort by creation date (newest first)
      drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply limit
      if (options.limit) {
        drafts = drafts.slice(0, options.limit);
      }

      this.logInfo('Slack drafts listed successfully', {
        count: drafts.length,
        channelId
      });

      return {
        success: true,
        drafts,
        count: drafts.length
      };
    } catch (error) {
      this.logError('Error listing Slack drafts', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_LISTING_FAILED
      };
    }
  }

  /**
   * Get a specific Slack draft
   */
  async getDraft(draftId: string): Promise<SlackDraftManagementResult> {
    try {
      if (!draftId || draftId.trim().length === 0) {
        throw new Error('Draft ID is required');
      }

      this.logInfo('Getting Slack draft', { draftId });

      const draft = this.drafts.get(draftId);
      if (!draft) {
        throw new Error('Draft not found');
      }

      this.logInfo('Slack draft retrieved successfully', {
        draftId,
        channelId: draft.channelId
      });

      return {
        success: true,
        draft
      };
    } catch (error) {
      this.logError('Error getting Slack draft', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_LISTING_FAILED
      };
    }
  }

  /**
   * Get drafts scheduled for a specific time
   */
  async getScheduledDrafts(timeRange?: {
    start: string;
    end: string;
  }): Promise<SlackDraftManagementResult> {
    try {
      this.logInfo('Getting scheduled Slack drafts', { timeRange });

      let drafts = Array.from(this.drafts.values()).filter(draft => !!draft.scheduledTime);

      if (timeRange) {
        const startTime = new Date(timeRange.start);
        const endTime = new Date(timeRange.end);

        drafts = drafts.filter(draft => {
          if (!draft.scheduledTime) return false;
          const scheduledTime = new Date(draft.scheduledTime);
          return scheduledTime >= startTime && scheduledTime <= endTime;
        });
      }

      // Sort by scheduled time
      drafts.sort((a, b) => {
        const timeA = new Date(a.scheduledTime!).getTime();
        const timeB = new Date(b.scheduledTime!).getTime();
        return timeA - timeB;
      });

      this.logInfo('Scheduled Slack drafts retrieved successfully', {
        count: drafts.length
      });

      return {
        success: true,
        drafts,
        count: drafts.length
      };
    } catch (error) {
      this.logError('Error getting scheduled Slack drafts', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : SLACK_SERVICE_CONSTANTS.ERRORS.DRAFT_LISTING_FAILED
      };
    }
  }

  /**
   * Get service statistics
   */
  getManagerStats(): {
    serviceName: string;
    supportedOperations: string[];
    totalDrafts: number;
  } {
    return {
      serviceName: SLACK_SERVICE_CONSTANTS.SERVICE_NAMES.SLACK_DRAFT_MANAGER,
      supportedOperations: ['create_draft', 'update_draft', 'delete_draft', 'list_drafts', 'get_draft', 'get_scheduled_drafts'],
      totalDrafts: this.drafts.size
    };
  }
}
