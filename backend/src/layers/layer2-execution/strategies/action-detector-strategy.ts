/**
 * Action Detector Strategy
 *
 * Detects emails that require user response or action based on:
 * - Question marks
 * - Request phrases
 * - Last sender in thread
 * - Call-to-action language
 *
 * This replaces the ❌ `requiresResponse` filter with real detection.
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult } from '../execution.types';
import { IEmailDomainService } from '../../../services/domain/interfaces/email-domain.interface';
import { Strategy, StrategyType } from '../strategy-metadata';

interface ActionDetectorParams {
  input_email_ids: string[];
}

interface ActionResult {
  email_id: string;
  requires_response: boolean;
  action_type: 'reply' | 'review' | 'decide' | 'none';
  confidence: number;
  reasons: string[];
}

@Strategy({
  type: StrategyType.ACTION_DETECTOR,
  name: 'Action Detector',
  description: 'Detects emails requiring response or action'
})
export class ActionDetectorStrategy extends BaseStrategy {
  readonly type = 'action_detector';

  // Request phrases that indicate action needed
  private static readonly REQUEST_PHRASES = [
    'can you',
    'could you',
    'would you',
    'please',
    'let me know',
    'waiting for',
    'need your',
    'require your',
    'looking for',
    'thoughts on',
    'feedback on',
    'input on',
    'review',
    'approve',
    'confirm',
    'respond',
    'reply'
  ];

  constructor(private emailService: IEmailDomainService) {
    super();
  }

  async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
    const detectorParams = params as unknown as ActionDetectorParams;
    const nodeId = (params as any).node_id || 'action_detector';

    try {
      this.log('Detecting action-required emails', {
        emailCount: detectorParams.input_email_ids.length
      });

      // Get email details one by one (TODO: optimize with batch fetch)
      const emails = await Promise.all(
        detectorParams.input_email_ids.map(id => this.emailService.getEmail(userId, id))
      );

      // Analyze each email
      const results: ActionResult[] = [];
      for (const email of emails) {
        const action = this.detectAction(email, userId);
        results.push(action);
      }

      // Filter to only emails requiring action
      const actionRequired = results.filter(r => r.requires_response);

      this.log('Action detection complete', {
        total: results.length,
        actionRequired: actionRequired.length
      });

      return this.createSuccessResult(nodeId, {
        count: actionRequired.length,
        items: actionRequired.map(r => ({
          id: r.email_id,
          requires_response: r.requires_response,
          action_type: r.action_type,
          confidence: r.confidence,
          reasons: r.reasons
        })),
        metadata: {
          tokens_used: 0,
          llm_calls: 0,
          detection_stats: {
            total_analyzed: results.length,
            action_required: actionRequired.length
          }
        }
      }, 0);
    } catch (error: any) {
      this.log('Error detecting actions', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Detect if email requires action
   */
  private detectAction(email: any, userId: string): ActionResult {
    const subject = (email.subject || '').toLowerCase();
    const body = (email.body || email.snippet || '').toLowerCase();
    const combinedText = `${subject} ${body}`;
    let reasons: string[] = [];
    let score = 0;
    let actionType: 'reply' | 'review' | 'decide' | 'none' = 'none';

    // 1. Check for questions (strong signal)
    const questionCount = (combinedText.match(/\?/g) || []).length;
    if (questionCount > 0) {
      score += questionCount * 20;
      actionType = 'reply';
      reasons.push(`${questionCount} question(s) asked`);
    }

    // 2. Check for request phrases
    let requestCount = 0;
    for (const phrase of ActionDetectorStrategy.REQUEST_PHRASES) {
      if (combinedText.includes(phrase)) {
        requestCount++;
        score += 15;
      }
    }

    if (requestCount > 0) {
      if (!actionType || actionType === 'none') {
        actionType = 'reply';
      }
      reasons.push(`${requestCount} request phrase(s) found`);
    }

    // 3. Check if user is in TO field (not CC)
    // If user is primary recipient, more likely to need action
    const to = (email.to || '').toLowerCase();
    const cc = (email.cc || '').toLowerCase();
    const userEmail = userId.toLowerCase();

    if (to.includes(userEmail)) {
      score += 10;
      reasons.push('User is primary recipient');
    }

    // 4. Check for approval/review language
    const reviewWords = ['approve', 'approval', 'review', 'sign off', 'authorize'];
    for (const word of reviewWords) {
      if (combinedText.includes(word)) {
        score += 20;
        actionType = 'review';
        reasons.push(`Review/approval language: "${word}"`);
        break;
      }
    }

    // 5. Check for decision language
    const decisionWords = ['decide', 'decision', 'choose', 'option', 'which should'];
    for (const word of decisionWords) {
      if (combinedText.includes(word)) {
        score += 15;
        actionType = 'decide';
        reasons.push(`Decision language: "${word}"`);
        break;
      }
    }

    // 6. Check if email is unread (moderate signal)
    if (email.labels?.includes('UNREAD')) {
      score += 5;
      reasons.push('Email is unread');
    }

    // 7. Penalty for automated/no-reply senders
    const from = (email.from || '').toLowerCase();
    if (from.includes('no-reply') || from.includes('noreply') || from.includes('donotreply')) {
      score = 0;
      actionType = 'none';
      reasons = ['Automated no-reply sender'];
    }

    // Determine if action required
    const requiresResponse = score >= 25; // Threshold
    const confidence = Math.min(score, 100);

    return {
      email_id: email.id,
      requires_response: requiresResponse,
      action_type: requiresResponse ? actionType : 'none',
      confidence,
      reasons
    };
  }
}
