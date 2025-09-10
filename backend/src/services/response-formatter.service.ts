import { BaseService } from './base-service';
import { 
  SlackConfirmationMessage, 
  SlackMessageFormatOptions,
  ConfirmationFlow
} from '../types/confirmation.types';
import { 
  ActionPreview, 
  EmailPreviewData, 
  CalendarPreviewData,
  ActionRiskAssessment
} from '../types/api.types';

/**
 * ResponseFormatterService - Formats Slack messages for confirmation flows
 * 
 * This service generates consistent Slack message formatting that matches the
 * specification in outputs.md, providing rich previews with proper formatting,
 * risk assessment, and action buttons.
 */
export class ResponseFormatterService extends BaseService {

  constructor() {
    super('responseFormatterService');
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('ResponseFormatterService initialized');
  }

  /**
   * Service-specific cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('ResponseFormatterService destroyed');
  }

  /**
   * Format a confirmation flow as a Slack message
   */
  formatConfirmationMessage(
    confirmationFlow: ConfirmationFlow,
    options: SlackMessageFormatOptions = {}
  ): SlackConfirmationMessage {
    this.assertReady();

    try {
      const { actionPreview } = confirmationFlow;
      const { 
        includeRiskAssessment = true,
        includeExecutionTime = true,
        showDetailedPreview = true,
        useCompactFormat = false
      } = options;

      // Generate main text for fallback
      const fallbackText = this.generateFallbackText(actionPreview);

      // Generate blocks based on action type
      const blocks = this.generateActionBlocks(
        actionPreview,
        confirmationFlow,
        {
          includeRiskAssessment,
          includeExecutionTime,
          showDetailedPreview,
          useCompactFormat
        }
      );

      return {
        text: fallbackText,
        blocks
      };
    } catch (error) {
      this.logError('Error formatting confirmation message', error, {
        confirmationId: confirmationFlow.confirmationId,
        actionType: confirmationFlow.actionPreview.actionType
      });
      
      // Return fallback message
      return this.generateFallbackMessage(confirmationFlow);
    }
  }

  /**
   * Format completion message after action execution
   */
  formatCompletionMessage(confirmationFlow: ConfirmationFlow): SlackConfirmationMessage {
    this.assertReady();

    const { executionResult } = confirmationFlow;
    const success = executionResult?.success || false;
    
    const icon = success ? '✅' : '❌';
    const statusText = success ? 'Action Completed Successfully' : 'Action Failed';
    const message = success 
      ? `${confirmationFlow.actionPreview.title} completed successfully.`
      : `${confirmationFlow.actionPreview.title} failed to execute.`;

    return {
      text: `${icon} ${statusText}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${icon} **${statusText}**\n${message}`
          }
        }
      ]
    };
  }

  /**
   * Format cancellation message
   */
  formatCancellationMessage(confirmationFlow: ConfirmationFlow): SlackConfirmationMessage {
    return {
      text: '🚫 Action Cancelled',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚫 **Action Cancelled**\n${confirmationFlow.actionPreview.title} was not executed.`
          }
        }
      ]
    };
  }

  // PRIVATE HELPER METHODS

  private generateFallbackText(actionPreview: ActionPreview): string {
    return `${this.getActionIcon(actionPreview.actionType)} Action Preview: ${actionPreview.title}`;
  }

  private generateActionBlocks(
    actionPreview: ActionPreview,
    confirmationFlow: ConfirmationFlow,
    options: {
      includeRiskAssessment: boolean;
      includeExecutionTime: boolean;
      showDetailedPreview: boolean;
      useCompactFormat: boolean;
    }
  ): any[] {
    const blocks = [];

    // Header block
    blocks.push(this.createHeaderBlock(actionPreview));

    // Preview details block based on action type
    if (options.showDetailedPreview) {
      const detailsBlock = this.createDetailsBlock(actionPreview);
      if (detailsBlock) {
        blocks.push(detailsBlock);
      }
    }

    // Risk assessment block
    if (options.includeRiskAssessment) {
      blocks.push(this.createRiskAssessmentBlock(actionPreview.riskAssessment));
    }

    // Metadata block
    blocks.push(this.createMetadataBlock(actionPreview, options.includeExecutionTime));

    // Divider
    blocks.push({ type: 'divider' });

    // Confirmation prompt
    blocks.push(this.createConfirmationPromptBlock());

    // Action buttons
    blocks.push(this.createActionButtonsBlock(confirmationFlow.confirmationId));

    return blocks;
  }

  private createHeaderBlock(actionPreview: ActionPreview): any {
    const icon = this.getActionIcon(actionPreview.actionType);
    
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon} **Action Preview**\n*${actionPreview.title}*\n\n${actionPreview.description}`
      }
    };
  }

  private createDetailsBlock(actionPreview: ActionPreview): any | null {
    switch (actionPreview.actionType) {
      case 'email':
        return this.createEmailDetailsBlock(actionPreview.previewData as EmailPreviewData);
      case 'calendar':
        return this.createCalendarDetailsBlock(actionPreview.previewData as CalendarPreviewData);
      default:
        return this.createGenericDetailsBlock(actionPreview.previewData);
    }
  }

  private createEmailDetailsBlock(emailData: EmailPreviewData): any {
    const fields = [];

    // Recipients
    const toList = emailData.recipients.to.join(', ');
    fields.push({
      type: 'mrkdwn',
      text: `*To:* ${toList}`
    });

    if (emailData.recipients.cc && emailData.recipients.cc.length > 0) {
      fields.push({
        type: 'mrkdwn',
        text: `*CC:* ${emailData.recipients.cc.join(', ')}`
      });
    }

    // Subject
    fields.push({
      type: 'mrkdwn',
      text: `*Subject:* ${emailData.subject}`
    });

    // Content summary
    fields.push({
      type: 'mrkdwn',
      text: `*Content:* ${emailData.contentSummary}`
    });

    return {
      type: 'section',
      fields
    };
  }

  private createCalendarDetailsBlock(calendarData: CalendarPreviewData): any {
    const fields = [];

    fields.push({
      type: 'mrkdwn',
      text: `*Title:* ${calendarData.title}`
    });

    fields.push({
      type: 'mrkdwn',
      text: `*Time:* ${calendarData.startTime} - ${calendarData.endTime}`
    });

    if (calendarData.attendees && calendarData.attendees.length > 0) {
      fields.push({
        type: 'mrkdwn',
        text: `*Attendees:* ${calendarData.attendees.join(', ')}`
      });
    }

    if (calendarData.location) {
      fields.push({
        type: 'mrkdwn',
        text: `*Location:* ${calendarData.location}`
      });
    }

    return {
      type: 'section',
      fields
    };
  }

  private createGenericDetailsBlock(previewData: Record<string, unknown>): any {
    const fields = [];
    
    // Show key details from preview data
    for (const [key, value] of Object.entries(previewData)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const displayKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        fields.push({
          type: 'mrkdwn',
          text: `*${displayKey}:* ${value}`
        });
      }
      
      // Limit to 6 fields to avoid overcrowding
      if (fields.length >= 6) break;
    }

    return fields.length > 0 ? {
      type: 'section',
      fields
    } : null;
  }

  private createRiskAssessmentBlock(riskAssessment: ActionRiskAssessment): any {
    const riskIcon = this.getRiskIcon(riskAssessment.level);
    const riskText = `${riskIcon} **Risk Level: ${riskAssessment.level.toUpperCase()}**`;
    
    let factorsText = '';
    if (riskAssessment.factors && riskAssessment.factors.length > 0) {
      factorsText = `\n*Risk Factors:* ${riskAssessment.factors.join(', ')}`;
    }

    let warningsText = '';
    if (riskAssessment.warnings && riskAssessment.warnings.length > 0) {
      warningsText = `\n⚠️ *Warnings:* ${riskAssessment.warnings.join(', ')}`;
    }

    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${riskText}${factorsText}${warningsText}`
      }
    };
  }

  private createMetadataBlock(actionPreview: ActionPreview, includeExecutionTime: boolean): any {
    const fields = [];

    // Recipients count for emails
    if (actionPreview.actionType === 'email') {
      const emailData = actionPreview.previewData as EmailPreviewData;
      fields.push({
        type: 'mrkdwn',
        text: `*Recipients:* ${emailData.recipientCount}`
      });
    }

    // Attendees count for calendar
    if (actionPreview.actionType === 'calendar') {
      const calendarData = actionPreview.previewData as CalendarPreviewData;
      if (calendarData.attendeeCount) {
        fields.push({
          type: 'mrkdwn',
          text: `*Attendees:* ${calendarData.attendeeCount}`
        });
      }
    }

    // Execution time
    if (includeExecutionTime && actionPreview.estimatedExecutionTime) {
      fields.push({
        type: 'mrkdwn',
        text: `*Estimated Execution Time:* ${actionPreview.estimatedExecutionTime}`
      });
    }

    // Reversible status
    fields.push({
      type: 'mrkdwn',
      text: `*Reversible:* ${actionPreview.reversible ? 'Yes' : 'No'}`
    });

    return {
      type: 'section',
      fields
    };
  }

  private createConfirmationPromptBlock(): any {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Do you want to proceed with this action?*\nReply with "yes" to confirm or "no" to cancel.'
      }
    };
  }

  private createActionButtonsBlock(confirmationId: string): any {
    return {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Yes, proceed',
            emoji: true
          },
          value: `confirm_${confirmationId}`,
          action_id: `confirm_${confirmationId}`,
          style: 'primary'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'No, cancel',
            emoji: true
          },
          value: `reject_${confirmationId}`,
          action_id: `reject_${confirmationId}`,
          style: 'danger'
        }
      ]
    };
  }

  private getActionIcon(actionType: ActionPreview['actionType']): string {
    switch (actionType) {
      case 'email':
        return '📧';
      case 'calendar':
        return '📅';
      case 'contact':
        return '👤';
      case 'slack':
        return '💬';
      default:
        return '⚙️';
    }
  }

  private getRiskIcon(level: 'low' | 'medium' | 'high'): string {
    switch (level) {
      case 'low':
        return '🟢';
      case 'medium':
        return '🟡';
      case 'high':
        return '🔴';
      default:
        return '⚪';
    }
  }

  private generateFallbackMessage(confirmationFlow: ConfirmationFlow): SlackConfirmationMessage {
    const { actionPreview } = confirmationFlow;
    
    return {
      text: `Action Preview: ${actionPreview.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚙️ **Action Preview**\n*${actionPreview.title}*\n\n${actionPreview.description}\n\n*Do you want to proceed with this action?*\nReply with "yes" to confirm or "no" to cancel.`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Yes, proceed'
              },
              value: `confirm_${confirmationFlow.confirmationId}`,
              action_id: `confirm_${confirmationFlow.confirmationId}`,
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'No, cancel'
              },
              value: `reject_${confirmationFlow.confirmationId}`,
              action_id: `reject_${confirmationFlow.confirmationId}`,
              style: 'danger'
            }
          ]
        }
      ]
    };
  }

  /**
   * Generate a simple text-only confirmation message for environments that don't support blocks
   */
  formatSimpleConfirmationMessage(confirmationFlow: ConfirmationFlow): string {
    const { actionPreview } = confirmationFlow;
    const icon = this.getActionIcon(actionPreview.actionType);
    
    let message = `${icon} Action Preview\n${actionPreview.title}\n\n`;
    
    // Add key details based on action type
    if (actionPreview.actionType === 'email') {
      const emailData = actionPreview.previewData as EmailPreviewData;
      message += `To: ${emailData.recipients.to.join(', ')}\n`;
      message += `Subject: ${emailData.subject}\n`;
      message += `Content: ${emailData.contentSummary}\n\n`;
      message += `Recipients: ${emailData.recipientCount}\n`;
    } else if (actionPreview.actionType === 'calendar') {
      const calendarData = actionPreview.previewData as CalendarPreviewData;
      message += `Title: ${calendarData.title}\n`;
      message += `Time: ${calendarData.startTime} - ${calendarData.endTime}\n`;
      if (calendarData.attendees) {
        message += `Attendees: ${calendarData.attendees.join(', ')}\n`;
      }
    }
    
    // Add risk assessment
    const riskIcon = this.getRiskIcon(actionPreview.riskAssessment.level);
    message += `${riskIcon} Risk Level: ${actionPreview.riskAssessment.level.toUpperCase()}\n`;
    message += `Risk Factors: ${actionPreview.riskAssessment.factors.join(', ')}\n`;
    
    if (actionPreview.estimatedExecutionTime) {
      message += `Estimated Execution Time: ${actionPreview.estimatedExecutionTime}\n`;
    }
    
    message += `Reversible: ${actionPreview.reversible ? 'Yes' : 'No'}\n\n`;
    message += `Do you want to proceed with this action?\nReply with "yes" to confirm or "no" to cancel.`;
    
    return message;
  }
}