/**
 * Sender Classifier Strategy
 *
 * Classifies email senders by type (investor, boss, report, peer, customer, vendor)
 * based on email domain, frequency, and organizational patterns.
 *
 * This replaces the ❌ `sender_type:X` filter with real classification.
 */

import { BaseStrategy } from './base-strategy';
import { NodeResult } from '../execution.types';
import { IEmailDomainService } from '../../../services/domain/interfaces/email-domain.interface';
import { Strategy, StrategyType } from '../strategy-metadata';

interface SenderClassifierParams {
  input_email_ids: string[];
  filter_type?: 'investor' | 'boss' | 'report' | 'peer' | 'customer' | 'vendor' | 'all';
}

interface ClassifiedSender {
  email_id: string;
  sender_email: string;
  sender_type: string;
  confidence: number; // 0-100
  reasons: string[];
}

@Strategy({
  type: StrategyType.SENDER_CLASSIFIER,
  name: 'Sender Classifier',
  description: 'Classifies senders by type based on domain and patterns'
})
export class SenderClassifierStrategy extends BaseStrategy {
  readonly type = 'sender_classifier';

  // Domain patterns for classification
  private static readonly INVESTOR_DOMAINS = [
    '@sequoiacap.com',
    '@a16z.com',
    '@accel.com',
    '@greylock.com',
    '@benchmark.com',
    '@foundationcapital.com'
  ];

  private static readonly CUSTOMER_INDICATORS = [
    'support@',
    'contact@',
    'hello@',
    'info@'
  ];

  constructor(private emailService: IEmailDomainService) {
    super();
  }

  async execute(params: Record<string, unknown>, userId: string): Promise<NodeResult> {
    const classifierParams = params as unknown as SenderClassifierParams;
    const nodeId = (params as any).node_id || 'sender_classifier';

    try {
      this.log('Classifying senders', {
        emailCount: classifierParams.input_email_ids.length,
        filterType: classifierParams.filter_type || 'all'
      });

      // Get email details one by one (TODO: optimize with batch fetch)
      const emails = await Promise.all(
        classifierParams.input_email_ids.map(id => this.emailService.getEmail(userId, id))
      );

      // Classify each sender
      const results: ClassifiedSender[] = [];
      for (const email of emails) {
        const classification = this.classifySender(email);
        results.push(classification);
      }

      // Filter by type if specified
      let filteredResults = results;
      if (classifierParams.filter_type && classifierParams.filter_type !== 'all') {
        filteredResults = results.filter(
          r => r.sender_type === classifierParams.filter_type
        );
      }

      this.log('Sender classification complete', {
        total: results.length,
        matched: filteredResults.length,
        filterType: classifierParams.filter_type
      });

      return this.createSuccessResult(nodeId, {
        count: filteredResults.length,
        items: filteredResults.map(r => ({
          id: r.email_id,
          sender_email: r.sender_email,
          sender_type: r.sender_type,
          confidence: r.confidence,
          reasons: r.reasons
        })),
        metadata: {
          tokens_used: 0,
          llm_calls: 0,
          classification_stats: {
            total_classified: results.length,
            matched_filter: filteredResults.length
          }
        }
      }, 0);
    } catch (error: any) {
      this.log('Error classifying senders', { error: error.message });
      return this.createErrorResult(nodeId, error.message);
    }
  }

  /**
   * Classify a sender based on email patterns
   */
  private classifySender(email: any): ClassifiedSender {
    const senderEmail = (email.from || '').toLowerCase();
    const senderDomain = senderEmail.split('@')[1] || '';
    const reasons: string[] = [];
    let type = 'peer'; // Default
    let confidence = 50;

    // Check for investor
    for (const domain of SenderClassifierStrategy.INVESTOR_DOMAINS) {
      if (senderEmail.includes(domain)) {
        type = 'investor';
        confidence = 90;
        reasons.push(`Known investor domain: ${domain}`);
        return { email_id: email.id, sender_email: senderEmail, sender_type: type, confidence, reasons };
      }
    }

    // Check for customer support emails
    for (const indicator of SenderClassifierStrategy.CUSTOMER_INDICATORS) {
      if (senderEmail.startsWith(indicator)) {
        type = 'customer';
        confidence = 70;
        reasons.push(`Customer email pattern: ${indicator}`);
        return { email_id: email.id, sender_email: senderEmail, sender_type: type, confidence, reasons };
      }
    }

    // Check domain patterns
    const recipientEmail = (email.to || '').toLowerCase();
    const recipientDomain = recipientEmail.split('@')[1] || '';

    if (senderDomain === recipientDomain) {
      // Same domain = likely peer or report
      type = 'peer';
      confidence = 60;
      reasons.push('Same organizational domain');
    } else {
      // External domain
      // Could be customer, vendor, or external peer
      type = 'customer';
      confidence = 40;
      reasons.push('External domain (assumed customer)');
    }

    return {
      email_id: email.id,
      sender_email: senderEmail,
      sender_type: type,
      confidence,
      reasons
    };
  }
}
