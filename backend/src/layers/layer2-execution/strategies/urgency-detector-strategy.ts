/**
 * Urgency Detector Strategy
 *
 * Detects urgent/important emails from subject keywords, Gmail importance markers,
 * and sender patterns.
 *
 * This replaces the ❌ `isUrgent` filter with real detection from email content.
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult } from '../execution.types';
import { IEmailDomainService } from '../../../services/domain/interfaces/email-domain.interface';
import { Strategy, StrategyType } from '../strategy-metadata';

interface UrgencyDetectorParams {
  input_email_ids: string[];
  threshold?: 'high' | 'medium' | 'low';
  signals?: string[]; // Which signals to use: subject_keywords, importance_markers, sender_type
}

interface UrgencyResult {
  email_id: string;
  urgency_score: number; // 0-100
  is_urgent: boolean;
  reasons: string[];
}

@Strategy({
  type: StrategyType.URGENCY_DETECTOR,
  name: 'Urgency Detector',
  description: 'Detects urgent emails from keywords, importance markers, and sender patterns'
})
export class UrgencyDetectorStrategy extends BaseStrategy {
  readonly type = 'urgency_detector';

  // Urgency keywords and their weights
  private static readonly URGENCY_KEYWORDS = new Map([
    ['urgent', 40],
    ['asap', 40],
    ['critical', 35],
    ['emergency', 45],
    ['immediate', 35],
    ['time sensitive', 30],
    ['deadline', 25],
    ['priority', 20],
    ['important', 15],
    ['please help', 20],
    ['blocked', 25],
    ['blocker', 25],
    ['production', 30],
    ['down', 30],
    ['outage', 35],
    ['issue affecting', 25],
    ['security', 25],
    ['breach', 40],
    ['alert', 20]
  ]);

  constructor(private emailService: IEmailDomainService) {
    super();
  }

  async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
    const urgencyParams = params as unknown as UrgencyDetectorParams;
    const nodeId = (params as any).node_id || 'urgency_detector';

    try {
      this.log('Analyzing emails for urgency', {
        emailCount: urgencyParams.input_email_ids.length,
        threshold: urgencyParams.threshold || 'medium'
      });

      // Get email details one by one (TODO: optimize with batch fetch)
      const emails = await Promise.all(
        urgencyParams.input_email_ids.map(id => this.emailService.getEmail(userId, id))
      );

      // Analyze each email for urgency
      const results: UrgencyResult[] = [];
      for (const email of emails) {
        const urgency = this.analyzeUrgency(email);
        results.push(urgency);
      }

      // Filter by threshold
      const threshold = this.getThresholdScore(urgencyParams.threshold || 'medium');
      const urgentEmails = results.filter(r => r.urgency_score >= threshold);

      this.log('Urgency analysis complete', {
        total: results.length,
        urgent: urgentEmails.length,
        threshold
      });

      return this.createSuccessResult(nodeId, {
        count: urgentEmails.length,
        items: urgentEmails.map(r => ({
          id: r.email_id,
          urgency_score: r.urgency_score,
          is_urgent: r.is_urgent,
          reasons: r.reasons
        })),
        metadata: {
          tokens_used: 0, // No LLM needed
          llm_calls: 0,
          analysis_stats: {
            total_analyzed: results.length,
            urgent_count: urgentEmails.length,
            threshold_used: threshold
          }
        }
      }, 0);
    } catch (error: any) {
      this.log('Error detecting urgency', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Analyze a single email for urgency signals
   */
  private analyzeUrgency(email: any): UrgencyResult {
    let score = 0;
    const reasons: string[] = [];

    const subject = (email.subject || '').toLowerCase();
    const body = (email.body || email.snippet || '').toLowerCase();
    const combinedText = `${subject} ${body}`;

    // 1. Check subject keywords (highest weight)
    for (const [keyword, weight] of UrgencyDetectorStrategy.URGENCY_KEYWORDS.entries()) {
      if (subject.includes(keyword)) {
        score += weight;
        reasons.push(`Subject contains "${keyword}"`);
      } else if (body.includes(keyword)) {
        // Lower weight for body mentions
        score += Math.floor(weight * 0.6);
        reasons.push(`Body contains "${keyword}"`);
      }
    }

    // 2. Check Gmail importance markers
    if (email.labels?.includes('IMPORTANT')) {
      score += 25;
      reasons.push('Gmail marked as important');
    }

    if (email.labels?.includes('STARRED')) {
      score += 15;
      reasons.push('Email is starred');
    }

    // 3. Check for time pressure phrases
    const timePhrases = [
      'by end of day',
      'by eod',
      'by tomorrow',
      'before',
      'within',
      'by friday',
      'needs to be done',
      'today',
      'this morning',
      'this afternoon'
    ];

    for (const phrase of timePhrases) {
      if (combinedText.includes(phrase)) {
        score += 15;
        reasons.push(`Time-sensitive phrase: "${phrase}"`);
        break; // Only count once
      }
    }

    // 4. Check for escalation/follow-up language
    const escalationPhrases = [
      'following up',
      'still waiting',
      'haven\'t heard',
      'bumping this',
      'second request',
      'third time',
      'escalating'
    ];

    for (const phrase of escalationPhrases) {
      if (combinedText.includes(phrase)) {
        score += 20;
        reasons.push(`Follow-up/escalation: "${phrase}"`);
        break;
      }
    }

    // 5. Check for high impact language
    const impactPhrases = [
      'affecting',
      'users impacted',
      'customers',
      'revenue',
      'broken',
      'not working',
      'failed',
      'error'
    ];

    let impactCount = 0;
    for (const phrase of impactPhrases) {
      if (combinedText.includes(phrase)) {
        impactCount++;
      }
    }

    if (impactCount >= 2) {
      score += 25;
      reasons.push('High impact language detected');
    }

    // 6. Check for exclamation marks (moderate signal)
    const exclamationCount = (subject.match(/!/g) || []).length;
    if (exclamationCount > 0) {
      score += Math.min(exclamationCount * 5, 15);
      reasons.push(`${exclamationCount} exclamation marks`);
    }

    // Cap score at 100
    score = Math.min(score, 100);

    return {
      email_id: email.id,
      urgency_score: score,
      is_urgent: score >= this.getThresholdScore('medium'),
      reasons
    };
  }

  /**
   * Get numeric threshold from string
   */
  private getThresholdScore(threshold: string): number {
    switch (threshold) {
      case 'high':
        return 60; // Very urgent only
      case 'medium':
        return 35; // Moderately urgent
      case 'low':
        return 20; // Mildly urgent
      default:
        return 35;
    }
  }
}
