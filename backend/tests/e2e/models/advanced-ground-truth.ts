/**
 * Advanced Ground Truth System
 *
 * Comprehensive labeling system for hyper-realistic inbox testing.
 * Captures temporal, relational, and content complexity.
 */

export type SenderType = 'boss' | 'report' | 'peer' | 'customer' | 'vendor' | 'investor' | 'external' | 'recruiter' | 'spam';
export type EmailFrequency = 'daily' | 'weekly' | 'monthly' | 'rare' | 'first';
export type ThreadPosition = 'first' | 'reply' | 'follow_up' | 'escalation' | 'reminder';
export type CommitmentType = 'deliverable' | 'response' | 'meeting' | 'decision' | 'none';
export type CommitmentStatus = 'pending' | 'completed' | 'overdue' | 'none';
export type Sentiment = 'neutral' | 'positive' | 'frustrated' | 'urgent' | 'angry';
export type FollowUpTone = 'polite' | 'firm' | 'frustrated' | 'escalating';
export type UrgencyType = 'always' | 'became_urgent' | 'deadline_approaching' | 'never';

/**
 * Comprehensive email ground truth label
 */
export interface AdvancedEmailLabel {
  // Basic metadata
  emailId: string;
  threadId: string;

  // Temporal analysis
  sentTimestamp: Date;
  ageInDays: number;
  deadlineDate?: Date;
  daysUntilDeadline?: number;
  isOverdue: boolean;
  urgencyType: UrgencyType;

  // Thread analysis
  threadPosition: ThreadPosition;
  threadLength: number;
  positionInThread: number;
  isDroppedBall: boolean;
  lastResponseFrom: 'user' | 'sender' | 'none';
  daysSinceLastResponse?: number;
  userNeedsToRespond: boolean;

  // Commitment tracking
  containsCommitment: boolean;
  commitmentType: CommitmentType;
  commitmentDeadline?: Date;
  commitmentStatus: CommitmentStatus;
  commitmentText?: string;
  commitmentMadeBy: 'user' | 'sender' | 'none';

  // Relationship context
  senderEmail: string;
  senderName: string;
  senderType: SenderType;
  senderImportance: number; // 1-10
  isFirstTimeContact: boolean;
  emailFrequencyWithSender: EmailFrequency;
  typicalResponseTime: number; // in hours
  isVIP: boolean;

  // Content analysis
  containsQuestions: boolean;
  questionCount: number;
  questions: string[];
  requiresDecision: boolean;
  hasActionItems: boolean;
  actionItems: string[];
  sentiment: Sentiment;

  // Follow-up detection
  isFollowUp: boolean;
  followUpIteration: number; // 1st, 2nd, 3rd reminder
  followUpTone?: FollowUpTone;
  referencesOlderEmail: boolean;
  olderEmailIds: string[];
  followUpKeywords: string[]; // "following up", "2nd reminder", etc.

  // Priority calculation
  isUrgent: boolean;
  isImportant: boolean;
  requiresResponse: boolean;
  calculatedPriority: number; // 1-10

  // Categories
  category: 'signal' | 'noise' | 'spam';
  subcategory: string; // 'customer_issue', 'internal_question', 'newsletter', etc.
  topics: string[];

  // Special flags
  isEscalated: boolean;
  blocksOthers: boolean;
  hasAttachments: boolean;
  isDeceptiveNoise: boolean; // Looks important but isn't
  requiresImmediateAction: boolean;
}

/**
 * Test query with expected results
 */
export interface TestQuery {
  // Query metadata
  queryId: string;
  query: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';

  // Expected results
  expectedEmailIds: string[];
  expectedCount?: number;
  minimumPrecision: number; // 0-1, how precise should results be
  minimumRecall: number; // 0-1, how many correct emails should be found

  // Reasoning
  reasoning: string;
  keyFactors: string[]; // What makes these emails match
  edgeCases?: string[]; // What could go wrong
}

/**
 * Complete advanced ground truth
 */
export interface AdvancedGroundTruth {
  // Email labels (comprehensive)
  emailLabels: Map<string, AdvancedEmailLabel>;

  // Thread metadata
  threadMetadata: Map<string, {
    threadId: string;
    participantEmails: string[];
    emailCount: number;
    isDroppedBall: boolean;
    hasEscalation: boolean;
    firstEmailDate: Date;
    lastEmailDate: Date;
    topic: string;
  }>;

  // Sender profiles
  senderProfiles: Map<string, {
    email: string;
    name: string;
    type: SenderType;
    importance: number;
    emailFrequency: EmailFrequency;
    typicalResponseTime: number;
    totalEmailsSent: number;
    unansweredCount: number;
  }>;

  // Test queries (organized by category)
  testQueries: {
    inboxTriage: TestQuery[];
    droppedBalls: TestQuery[];
    commitments: TestQuery[];
    relationships: TestQuery[];
    actionRequired: TestQuery[];
    searchRetrieval: TestQuery[];
    crossDomain: TestQuery[];
  };

  // Statistics
  stats: {
    totalEmails: number;
    urgentCount: number;
    droppedBallCount: number;
    overdueCommitmentCount: number;
    unansweredCount: number;
    escalatedCount: number;
    vipCount: number;
  };
}

/**
 * Helper functions for ground truth analysis
 */
export class GroundTruthAnalyzer {
  /**
   * Calculate if email is a dropped ball
   */
  static isDroppedBall(
    emailLabel: AdvancedEmailLabel,
    allLabels: Map<string, AdvancedEmailLabel>
  ): boolean {
    // Check if this is a follow-up with no response
    if (emailLabel.isFollowUp && emailLabel.lastResponseFrom === 'none') {
      return true;
    }

    // Check if sender asked question and user never responded
    if (
      emailLabel.containsQuestions &&
      emailLabel.userNeedsToRespond &&
      emailLabel.ageInDays > 3
    ) {
      return true;
    }

    // Check if user committed and didn't deliver
    if (
      emailLabel.commitmentMadeBy === 'user' &&
      emailLabel.commitmentStatus === 'overdue'
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate priority score (1-10)
   */
  static calculatePriority(emailLabel: AdvancedEmailLabel): number {
    let score = 5; // Base score

    // Urgency factors
    if (emailLabel.isOverdue) score += 3;
    if (emailLabel.urgencyType === 'became_urgent') score += 2;
    if (emailLabel.isEscalated) score += 2;
    if (emailLabel.blocksOthers) score += 2;

    // Relationship factors
    if (emailLabel.senderType === 'boss') score += 2;
    if (emailLabel.senderType === 'customer') score += 2;
    if (emailLabel.isVIP) score += 1;

    // Content factors
    if (emailLabel.requiresDecision) score += 1;
    if (emailLabel.containsQuestions) score += 1;
    if (emailLabel.sentiment === 'frustrated') score += 1;
    if (emailLabel.sentiment === 'angry') score += 2;

    // Follow-up factors
    if (emailLabel.followUpIteration >= 2) score += 1;
    if (emailLabel.followUpIteration >= 3) score += 2;
    if (emailLabel.followUpTone === 'escalating') score += 2;

    // Dropped ball penalty
    if (emailLabel.isDroppedBall) score += 3;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Detect commitment in text
   */
  static detectCommitment(text: string): {
    hasCommitment: boolean;
    commitmentText?: string;
    commitmentType?: CommitmentType;
  } {
    const commitmentPatterns = [
      // Deliverable commitments
      { pattern: /I'?ll send (?:the |this |that )?(.+?) by (.+)/i, type: 'deliverable' as CommitmentType },
      { pattern: /I'?ll have (.+?) to you by (.+)/i, type: 'deliverable' as CommitmentType },
      { pattern: /I'?ll deliver (.+?) by (.+)/i, type: 'deliverable' as CommitmentType },

      // Response commitments
      { pattern: /I'?ll get back to you (?:by |on |tomorrow|today|this week)/i, type: 'response' as CommitmentType },
      { pattern: /I'?ll respond (?:by |tomorrow|today|soon)/i, type: 'response' as CommitmentType },

      // Meeting commitments
      { pattern: /I'?ll schedule (?:a |the )?meeting/i, type: 'meeting' as CommitmentType },
      { pattern: /I'?ll set up (?:a |the )?(?:call|meeting)/i, type: 'meeting' as CommitmentType },

      // Decision commitments
      { pattern: /I'?ll decide (?:by |on |tomorrow|today)/i, type: 'decision' as CommitmentType },
      { pattern: /I'?ll make a decision/i, type: 'decision' as CommitmentType },
    ];

    for (const { pattern, type } of commitmentPatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          hasCommitment: true,
          commitmentText: match[0],
          commitmentType: type,
        };
      }
    }

    return { hasCommitment: false };
  }

  /**
   * Detect follow-up language
   */
  static detectFollowUp(text: string, subject: string): {
    isFollowUp: boolean;
    iteration: number;
    tone: FollowUpTone;
    keywords: string[];
  } {
    const combinedText = `${subject.toLowerCase()} ${text.toLowerCase()}`;
    const keywords: string[] = [];
    let iteration = 0;
    let tone: FollowUpTone = 'polite';

    // Check for follow-up keywords
    const followUpPatterns = [
      { keyword: 'following up', iter: 1, tone: 'polite' as FollowUpTone },
      { keyword: '2nd reminder', iter: 2, tone: 'firm' as FollowUpTone },
      { keyword: 'second reminder', iter: 2, tone: 'firm' as FollowUpTone },
      { keyword: '3rd reminder', iter: 3, tone: 'frustrated' as FollowUpTone },
      { keyword: 'third reminder', iter: 3, tone: 'frustrated' as FollowUpTone },
      { keyword: 'per my last email', iter: 2, tone: 'frustrated' as FollowUpTone },
      { keyword: 'bumping this up', iter: 2, tone: 'escalating' as FollowUpTone },
      { keyword: 'escalating', iter: 3, tone: 'escalating' as FollowUpTone },
      { keyword: 'haven\'t heard back', iter: 2, tone: 'firm' as FollowUpTone },
      { keyword: 'still waiting', iter: 2, tone: 'frustrated' as FollowUpTone },
      { keyword: 'checking in', iter: 1, tone: 'polite' as FollowUpTone },
    ];

    for (const { keyword, iter, tone: patternTone } of followUpPatterns) {
      if (combinedText.includes(keyword)) {
        keywords.push(keyword);
        iteration = Math.max(iteration, iter);
        tone = patternTone;
      }
    }

    return {
      isFollowUp: keywords.length > 0,
      iteration,
      tone,
      keywords,
    };
  }

  /**
   * Extract questions from text
   */
  static extractQuestions(text: string): string[] {
    const questions: string[] = [];

    // Split into sentences
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

    for (const sentence of sentences) {
      // Check if sentence is a question
      if (sentence.includes('?')) {
        questions.push(sentence + '?');
      }
      // Check for imperative questions
      else if (
        sentence.match(/^(can you|could you|would you|will you|please|do you)/i)
      ) {
        questions.push(sentence);
      }
    }

    return questions;
  }

  /**
   * Extract action items from text
   */
  static extractActionItems(text: string): string[] {
    const actionItems: string[] = [];

    const actionPatterns = [
      /please (.+?)(?:\.|$)/gi,
      /can you (.+?)(?:\?|\.)/gi,
      /need (?:you )?to (.+?)(?:\.|$)/gi,
      /(?:must|should) (.+?)(?:\.|$)/gi,
    ];

    for (const pattern of actionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          actionItems.push(match[1].trim());
        }
      }
    }

    return [...new Set(actionItems)]; // Remove duplicates
  }
}
