/**
 * Hyper-Realistic Inbox Generator
 *
 * Orchestrates all components to generate highly realistic inbox scenarios
 * with complex threads, temporal dynamics, and comprehensive ground truth.
 */

import {
  AdvancedEmailLabel,
  AdvancedGroundTruth,
  TestQuery,
  GroundTruthAnalyzer,
  SenderType,
  EmailFrequency,
  ThreadPosition,
  CommitmentType,
  Sentiment,
  FollowUpTone,
  UrgencyType,
} from '../models/advanced-ground-truth';

import {
  ThreadTemplate,
  ThreadEmail,
  threadTemplates,
  investorDroppedBall,
  customerProductionIssue,
  overdueCommitment,
  teamQuestionBlocking,
  normalHiringCoordination,
} from './thread-templates';

// Create THREAD_TEMPLATES object for backward compatibility
const THREAD_TEMPLATES = {
  investorDroppedBall,
  customerProductionIssue,
  overdueCommitment,
  teamQuestionBlocking,
  normalHiringCoordination,
};

import {
  RelationshipGraph,
  buildRelationshipGraph,
  getSenderProfile,
  recordEmailSent,
  shouldSenderFollowUp,
  shouldSenderEscalate,
} from './relationship-graph';

import {
  TemporalContext,
  calculateTemporalContext,
  daysAgo,
  DEADLINE_PRESETS,
  URGENCY_RULES,
  generateThreadTimeline,
  calculateTimeDecayPriority,
} from './temporal-engine';

import {
  generateEmailContent,
  formatEmailText,
  EMAIL_SCENARIOS,
} from './language-patterns';

import {
  getRandomEmailTemplate,
} from './realistic-email-templates';

/**
 * Generated email with full metadata
 */
export interface GeneratedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  sentDate: Date;
  hasAttachments: boolean;

  // Ground truth
  label: AdvancedEmailLabel;
}

/**
 * Generated inbox
 */
export interface GeneratedInbox {
  emails: GeneratedEmail[];
  groundTruth: AdvancedGroundTruth;
  relationshipGraph: RelationshipGraph;
  persona: 'executive' | 'founder' | 'manager' | 'individual';
  currentDate: Date; // "now" for the test scenario
}

/**
 * Inbox generation options
 */
export interface InboxGenerationOptions {
  persona: 'executive' | 'founder' | 'manager' | 'individual';
  emailCount?: number; // total emails to generate (default: 50)
  currentDate?: Date; // "now" for the scenario (default: new Date())
  includeNoise?: boolean; // include spam/newsletters (default: true)
  noisePercentage?: number; // percentage of emails that are noise (default: 30)

  // Scenario composition
  includeDroppedBalls?: boolean; // default: true
  includeOverdueCommitments?: boolean; // default: true
  includeEscalations?: boolean; // default: true
  includeUrgentIssues?: boolean; // default: true
}

/**
 * Generate hyper-realistic inbox
 */
export async function generateHyperRealisticInbox(
  options: InboxGenerationOptions
): Promise<GeneratedInbox> {
  const {
    persona,
    emailCount = 50,
    currentDate = new Date(),
    includeNoise = true,
    noisePercentage = 30,
    includeDroppedBalls = true,
    includeOverdueCommitments = true,
    includeEscalations = true,
    includeUrgentIssues = true,
  } = options;

  // Build relationship graph
  const relationshipGraph = buildRelationshipGraph('user@company.com', persona);

  // Initialize collections
  const emails: GeneratedEmail[] = [];
  const emailLabels = new Map<string, AdvancedEmailLabel>();
  const threadMetadata = new Map<string, any>();
  const senderProfiles = relationshipGraph.senders;

  let emailIdCounter = 1;
  let threadIdCounter = 1;

  /**
   * Helper: Generate email ID
   */
  function nextEmailId(): string {
    return `email-${emailIdCounter++}`;
  }

  /**
   * Helper: Generate thread ID
   */
  function nextThreadId(): string {
    return `thread-${threadIdCounter++}`;
  }

  /**
   * Helper: Instantiate thread template
   */
  function instantiateThreadTemplate(
    template: ThreadTemplate,
    threadId: string
  ): GeneratedEmail[] {
    const threadEmails: GeneratedEmail[] = [];

    // Generate timeline
    const startDate = daysAgo(
      template.emails[0].sentDaysAgo || 0,
      currentDate
    );
    const timeline = generateThreadTimeline(
      template.emails.length,
      startDate,
      template.category === 'escalation' ? 'escalating' : 'normal'
    );

    for (let i = 0; i < template.emails.length; i++) {
      const emailTemplate = template.emails[i];
      const emailId = emailTemplate.id || nextEmailId();
      const sentDate = timeline[i];

      // Get sender profile
      const senderEmail = emailTemplate.from;
      const sender = getSenderProfile(relationshipGraph, senderEmail);

      if (!sender) {
        console.warn(`Sender not found: ${senderEmail}`);
        continue;
      }

      // Calculate temporal context
      const temporal = calculateTemporalContext(
        sentDate,
        currentDate
      );

      // Build ground truth label
      const label: AdvancedEmailLabel = {
        emailId,
        threadId,

        // Temporal
        sentTimestamp: sentDate,
        ageInDays: temporal.ageInDays,
        deadlineDate: temporal.deadlineDate,
        daysUntilDeadline: temporal.daysUntilDeadline,
        isOverdue: temporal.isOverdue,
        urgencyType: temporal.urgencyType,

        // Thread
        threadPosition: i === 0 ? 'first' : emailTemplate.labels?.threadPosition || 'reply',
        threadLength: template.emails.length,
        positionInThread: i + 1,
        isDroppedBall: emailTemplate.labels?.isDroppedBall || false,
        lastResponseFrom: emailTemplate.labels?.lastResponseFrom || 'sender',
        daysSinceLastResponse: i > 0 ? (sentDate.getTime() - timeline[i - 1].getTime()) / (1000 * 60 * 60 * 24) : undefined,
        userNeedsToRespond: emailTemplate.labels?.userNeedsToRespond ?? true,

        // Commitment
        containsCommitment: emailTemplate.labels?.containsCommitment || false,
        commitmentType: emailTemplate.labels?.commitmentType || 'none',
        commitmentDeadline: emailTemplate.labels?.commitmentDeadline,
        commitmentStatus: emailTemplate.labels?.commitmentStatus || 'none',
        commitmentText: emailTemplate.labels?.commitmentText,
        commitmentMadeBy: emailTemplate.labels?.commitmentMadeBy || 'none',

        // Relationship
        senderEmail,
        senderName: sender.name,
        senderType: sender.type,
        senderImportance: sender.importance,
        isFirstTimeContact: sender.totalEmailsSent === 0,
        emailFrequencyWithSender: sender.emailFrequency,
        typicalResponseTime: sender.typicalResponseTime,
        isVIP: sender.isVIP,

        // Content
        containsQuestions: emailTemplate.labels?.containsQuestions || false,
        questionCount: emailTemplate.labels?.questionCount || 0,
        questions: emailTemplate.labels?.questions || [],
        requiresDecision: emailTemplate.labels?.requiresDecision || false,
        hasActionItems: emailTemplate.labels?.hasActionItems || false,
        actionItems: emailTemplate.labels?.actionItems || [],
        sentiment: emailTemplate.labels?.sentiment || 'neutral',

        // Follow-up
        isFollowUp: emailTemplate.labels?.isFollowUp || false,
        followUpIteration: emailTemplate.labels?.followUpIteration || 0,
        followUpTone: emailTemplate.labels?.followUpTone,
        referencesOlderEmail: i > 0,
        olderEmailIds: i > 0 ? [template.emails[i - 1].id || `email-${i}`] : [],
        followUpKeywords: emailTemplate.labels?.followUpKeywords || [],

        // Priority
        isUrgent: temporal.isUrgentNow || emailTemplate.labels?.isUrgent || false,
        isImportant: sender.importance >= 7 || emailTemplate.labels?.isImportant || false,
        requiresResponse: emailTemplate.labels?.requiresResponse ?? true,
        calculatedPriority: calculateTimeDecayPriority(temporal, sender.importance),

        // Category
        category: emailTemplate.labels?.category || 'signal',
        subcategory: emailTemplate.labels?.subcategory || 'work',
        topics: emailTemplate.labels?.topics || [],

        // Flags
        isEscalated: emailTemplate.labels?.isEscalated || false,
        blocksOthers: emailTemplate.labels?.blocksOthers || false,
        hasAttachments: emailTemplate.labels?.hasAttachments || false,
        isDeceptiveNoise: false,
        requiresImmediateAction: emailTemplate.labels?.requiresImmediateAction || false,
      };

      // Create email
      const email: GeneratedEmail = {
        id: emailId,
        threadId,
        from: senderEmail,
        to: 'user@company.com',
        cc: emailTemplate.cc,
        subject: emailTemplate.subject,
        body: emailTemplate.body,
        sentDate,
        hasAttachments: emailTemplate.labels?.hasAttachments || false,
        label,
      };

      threadEmails.push(email);
      emailLabels.set(emailId, label);

      // Update sender stats
      recordEmailSent(relationshipGraph, senderEmail);
    }

    // Update thread metadata
    if (threadEmails.length > 0) {
      const firstEmail = threadEmails[0];
      const lastEmail = threadEmails[threadEmails.length - 1];

      threadMetadata.set(threadId, {
        threadId,
        participantEmails: Array.from(new Set(threadEmails.map(e => e.from))),
        emailCount: threadEmails.length,
        isDroppedBall: template.groundTruthHints.isDroppedBall,
        hasEscalation: template.groundTruthHints.isEscalated,
        firstEmailDate: firstEmail.sentDate,
        lastEmailDate: lastEmail.sentDate,
        topic: firstEmail.subject,
      });
    }

    return threadEmails;
  }

  // Phase 1: Generate high-priority thread scenarios
  const scenarios: { template: ThreadTemplate; weight: number }[] = [];

  if (includeDroppedBalls) {
    scenarios.push(
      { template: THREAD_TEMPLATES.investorDroppedBall, weight: 3 },
      { template: THREAD_TEMPLATES.teamQuestionBlocking, weight: 2 }
    );
  }

  if (includeOverdueCommitments) {
    scenarios.push(
      { template: THREAD_TEMPLATES.overdueCommitment, weight: 3 }
    );
  }

  if (includeEscalations) {
    scenarios.push(
      { template: THREAD_TEMPLATES.customerProductionIssue, weight: 3 }
    );
  }

  // Add normal threads for balance
  scenarios.push(
    { template: THREAD_TEMPLATES.normalHiringCoordination, weight: 1 }
  );

  // Instantiate scenario threads
  for (const scenario of scenarios) {
    const threadId = nextThreadId();
    const threadEmails = instantiateThreadTemplate(scenario.template, threadId);
    emails.push(...threadEmails);
  }

  // Phase 2: Generate normal emails from relationship graph
  const signalEmailsNeeded = Math.floor(emailCount * (1 - noisePercentage / 100)) - emails.length;

  for (let i = 0; i < signalEmailsNeeded; i++) {
    const threadId = nextThreadId();
    const emailId = nextEmailId();

    // Pick random sender weighted by frequency
    const sendersArray = Array.from(relationshipGraph.senders.values());
    const sender = sendersArray[Math.floor(Math.random() * sendersArray.length)];

    // Get realistic template based on sender type
    const template = getRandomEmailTemplate(sender.type);

    // Generate content with realistic formatting
    const sentDate = daysAgo(Math.floor(Math.random() * 14), currentDate);

    // Templates already include greetings/closings, just add sender name
    const emailBody = `${template.body}\n\n${sender.name}`;

    const temporal = calculateTemporalContext(sentDate, currentDate);

    // Extract questions from email body
    const questions = template.body.match(/^.+\?$/gm) || [];

    const label: AdvancedEmailLabel = {
      emailId,
      threadId,
      sentTimestamp: sentDate,
      ageInDays: temporal.ageInDays,
      isOverdue: false,
      urgencyType: template.urgency === 'high' ? 'became_urgent' : 'never',
      threadPosition: 'first',
      threadLength: 1,
      positionInThread: 1,
      isDroppedBall: false,
      lastResponseFrom: 'sender',
      userNeedsToRespond: template.hasQuestion || template.requiresAction || false,
      containsCommitment: false,
      commitmentType: 'none',
      commitmentStatus: 'none',
      commitmentMadeBy: 'none',
      senderEmail: sender.email,
      senderName: sender.name,
      senderType: sender.type,
      senderImportance: sender.importance,
      isFirstTimeContact: false,
      emailFrequencyWithSender: sender.emailFrequency,
      typicalResponseTime: sender.typicalResponseTime,
      isVIP: sender.isVIP,
      containsQuestions: template.hasQuestion || questions.length > 0,
      questionCount: questions.length,
      questions: questions.slice(0, 3), // First 3 questions
      requiresDecision: template.requiresDecision || false,
      hasActionItems: template.requiresAction || false,
      actionItems: template.requiresAction ? ['Review and respond'] : [],
      sentiment: template.urgency === 'high' ? 'urgent' : 'neutral',
      isFollowUp: template.subject.startsWith('Re:') || template.subject.includes('following up'),
      followUpIteration: 0,
      referencesOlderEmail: false,
      olderEmailIds: [],
      followUpKeywords: [],
      isUrgent: template.urgency === 'high' || template.hasDeadline || false,
      isImportant: sender.importance >= 7 || template.requiresAction || template.urgency === 'high',
      requiresResponse: template.hasQuestion || template.requiresAction || false,
      calculatedPriority: sender.importance + (template.requiresAction ? 2 : 0) + (template.urgency === 'high' ? 2 : 0),
      category: 'signal',
      subcategory: 'work',
      topics: [template.subject.toLowerCase().split(' ')[0].replace('re:', '').trim()],
      isEscalated: false,
      blocksOthers: template.requiresDecision || false,
      hasAttachments: template.hasAttachment || false,
      isDeceptiveNoise: false,
      requiresImmediateAction: template.hasDeadline || template.urgency === 'high',
    };

    const email: GeneratedEmail = {
      id: emailId,
      threadId,
      from: sender.email,
      to: 'user@company.com',
      subject: template.subject,
      body: emailBody,
      sentDate,
      hasAttachments: template.hasAttachment || false,
      label,
    };

    emails.push(email);
    emailLabels.set(emailId, label);
  }

  // Phase 3: Generate noise emails (spam, newsletters)
  if (includeNoise) {
    const noiseEmailsNeeded = Math.floor(emailCount * (noisePercentage / 100));

    for (let i = 0; i < noiseEmailsNeeded; i++) {
      const threadId = nextThreadId();
      const emailId = nextEmailId();
      const sentDate = daysAgo(Math.floor(Math.random() * 7), currentDate);

      const noiseScenarios = [
        {
          from: 'newsletter@saas-company.com',
          name: 'SaaS Weekly',
          subject: 'ACTION REQUIRED: New Compliance Updates',
          body: 'Important updates you need to know about...',
          isDeceptive: true,
        },
        {
          from: 'recruiter@linkedin.com',
          name: 'Sarah Recruiter',
          subject: 'Re: Senior Engineer Opportunity',
          body: 'Following up on the role we discussed...',
          isDeceptive: true,
        },
        {
          from: 'sales@vendor.com',
          name: 'John Sales',
          subject: 'Increase your revenue by 10x',
          body: 'Our platform can help you...',
          isDeceptive: false,
        },
      ];

      const scenario = noiseScenarios[Math.floor(Math.random() * noiseScenarios.length)];
      const temporal = calculateTemporalContext(sentDate, currentDate);

      const label: AdvancedEmailLabel = {
        emailId,
        threadId,
        sentTimestamp: sentDate,
        ageInDays: temporal.ageInDays,
        isOverdue: false,
        urgencyType: 'never',
        threadPosition: 'first',
        threadLength: 1,
        positionInThread: 1,
        isDroppedBall: false,
        lastResponseFrom: 'none',
        userNeedsToRespond: false,
        containsCommitment: false,
        commitmentType: 'none',
        commitmentStatus: 'none',
        commitmentMadeBy: 'none',
        senderEmail: scenario.from,
        senderName: scenario.name,
        senderType: 'spam',
        senderImportance: 1,
        isFirstTimeContact: true,
        emailFrequencyWithSender: 'rare',
        typicalResponseTime: 0,
        isVIP: false,
        containsQuestions: false,
        questionCount: 0,
        questions: [],
        requiresDecision: false,
        hasActionItems: false,
        actionItems: [],
        sentiment: 'neutral',
        isFollowUp: false,
        followUpIteration: 0,
        referencesOlderEmail: false,
        olderEmailIds: [],
        followUpKeywords: [],
        isUrgent: false,
        isImportant: false,
        requiresResponse: false,
        calculatedPriority: 1,
        category: 'spam',
        subcategory: 'marketing',
        topics: [],
        isEscalated: false,
        blocksOthers: false,
        hasAttachments: false,
        isDeceptiveNoise: scenario.isDeceptive,
        requiresImmediateAction: false,
      };

      const email: GeneratedEmail = {
        id: emailId,
        threadId,
        from: scenario.from,
        to: 'user@company.com',
        subject: scenario.subject,
        body: scenario.body,
        sentDate,
        hasAttachments: false,
        label,
      };

      emails.push(email);
      emailLabels.set(emailId, label);
    }
  }

  // Sort emails by sent date (oldest first)
  emails.sort((a, b) => a.sentDate.getTime() - b.sentDate.getTime());

  // Calculate statistics
  let urgentCount = 0;
  let droppedBallCount = 0;
  let overdueCommitmentCount = 0;
  let unansweredCount = 0;
  let escalatedCount = 0;
  let vipCount = 0;

  for (const label of emailLabels.values()) {
    if (label.isUrgent) urgentCount++;
    if (label.isDroppedBall) droppedBallCount++;
    if (label.commitmentStatus === 'overdue') overdueCommitmentCount++;
    if (label.userNeedsToRespond && label.ageInDays > 1) unansweredCount++;
    if (label.isEscalated) escalatedCount++;
    if (label.isVIP) vipCount++;
  }

  // Build ground truth
  const groundTruth: AdvancedGroundTruth = {
    emailLabels,
    threadMetadata,
    senderProfiles,
    testQueries: {
      inboxTriage: [],
      droppedBalls: [],
      commitments: [],
      relationships: [],
      actionRequired: [],
      searchRetrieval: [],
      crossDomain: [],
    },
    stats: {
      totalEmails: emails.length,
      urgentCount,
      droppedBallCount,
      overdueCommitmentCount,
      unansweredCount,
      escalatedCount,
      vipCount,
    },
  };

  return {
    emails,
    groundTruth,
    relationshipGraph,
    persona,
    currentDate,
  };
}

/**
 * Convert generated inbox to mock Gmail format
 */
export function convertToMockGmailFormat(inbox: GeneratedInbox) {
  return inbox.emails.map(email => ({
    id: email.id,
    threadId: email.threadId,
    snippet: email.body.substring(0, 100),
    payload: {
      headers: [
        { name: 'From', value: email.from },
        { name: 'To', value: email.to },
        { name: 'Subject', value: email.subject },
        { name: 'Date', value: email.sentDate.toISOString() },
        ...(email.cc ? [{ name: 'Cc', value: email.cc.join(', ') }] : []),
      ],
      body: {
        data: Buffer.from(email.body).toString('base64'),
      },
    },
    internalDate: email.sentDate.getTime().toString(),
  }));
}
