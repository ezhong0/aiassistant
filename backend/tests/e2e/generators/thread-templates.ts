/**
 * Thread Templates - Realistic Email Thread Patterns
 *
 * Generates complex, realistic email threads with:
 * - Escalation chains
 * - Dropped balls
 * - Commitment tracking
 * - Follow-up patterns
 */

import { AdvancedEmailLabel, SenderType } from '../models/advanced-ground-truth';

export interface ThreadEmail {
  id: string;
  from: string;
  fromName: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  sentDaysAgo: number; // Relative to "today"
  labels: Partial<AdvancedEmailLabel>;
}

export interface ThreadTemplate {
  id: string;
  name: string;
  description: string;
  category: 'dropped_ball' | 'escalation' | 'commitment' | 'follow_up' | 'normal';
  emails: ThreadEmail[];
  groundTruthHints: {
    isDroppedBall: boolean;
    isEscalated: boolean;
    hasOverdueCommitment: boolean;
    requiresUrgentAction: boolean;
    keyEmailId: string; // The most important email in thread
  };
}

/**
 * Template 1: Investor Follow-Up Escalation (Dropped Ball)
 */
export const investorDroppedBall: ThreadTemplate = {
  id: 'investor-dropped-ball',
  name: 'Investor Follow-Up Escalation',
  description: 'Investor following up, no response, gets escalated to partner',
  category: 'dropped_ball',
  emails: [
    {
      id: 'inv-1',
      from: 'john.chen@vc-capital.com',
      fromName: 'John Chen',
      to: ['{{user_email}}'],
      subject: 'Series B - Next Steps',
      body: `Hi {{user_name}},

Great to meet with you last week at the conference. Really impressed with your traction and vision for the product.

I'd love to schedule a follow-up call to discuss next steps for Series B. Would next week work? We're moving quickly on this and have partnership committee meetings coming up.

Looking forward to hearing from you.

Best,
John Chen
Partner, VC Capital Partners`,
      sentDaysAgo: 14,
      labels: {
        senderType: 'investor',
        isImportant: true,
        isUrgent: false,
        requiresResponse: true,
        threadPosition: 'first',
      },
    },
    {
      id: 'inv-2',
      from: 'john.chen@vc-capital.com',
      fromName: 'John Chen',
      to: ['{{user_email}}'],
      subject: 'Re: Series B - Next Steps',
      body: `Hi {{user_name}},

Following up on my email from Monday. Wanted to make sure this didn't get lost in your inbox!

When might you have 30 minutes for a call? We're excited about the opportunity and want to move forward.

Best,
John`,
      sentDaysAgo: 10,
      labels: {
        senderType: 'investor',
        isImportant: true,
        isUrgent: false,
        requiresResponse: true,
        threadPosition: 'follow_up',
        isFollowUp: true,
        followUpIteration: 1,
        followUpTone: 'polite',
      },
    },
    {
      id: 'inv-3',
      from: 'john.chen@vc-capital.com',
      fromName: 'John Chen',
      to: ['{{user_email}}'],
      subject: 'Re: Series B - Next Steps',
      body: `{{user_name}},

We're moving quickly on this and need to hear back by EOD Friday. Our partnership committee meets Monday and we'd like to present your opportunity.

Can you please respond with your availability?

Thanks,
John`,
      sentDaysAgo: 6,
      labels: {
        senderType: 'investor',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        threadPosition: 'follow_up',
        isFollowUp: true,
        followUpIteration: 2,
        followUpTone: 'firm',
        urgencyType: 'became_urgent',
      },
    },
    {
      id: 'inv-4',
      from: 'john.chen@vc-capital.com',
      fromName: 'John Chen',
      to: ['{{user_email}}'],
      cc: ['managing-partner@vc-capital.com'],
      subject: 'Re: Series B - Next Steps',
      body: `{{user_name}},

2nd reminder - our partnership committee meets Monday morning. We need your pitch deck and financial model by then if you want to be considered.

Are you still interested in raising capital? Please advise ASAP.

John Chen
Partner, VC Capital Partners

CC: {{managing-partner-name}} (Managing Partner)`,
      sentDaysAgo: 0, // Today
      labels: {
        senderType: 'investor',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        threadPosition: 'escalation',
        isFollowUp: true,
        followUpIteration: 3,
        followUpTone: 'escalating',
        isEscalated: true,
        isDroppedBall: true,
        urgencyType: 'became_urgent',
        deadlineDate: new Date(), // Today
        requiresImmediateAction: true,
      },
    },
  ],
  groundTruthHints: {
    isDroppedBall: true,
    isEscalated: true,
    hasOverdueCommitment: false,
    requiresUrgentAction: true,
    keyEmailId: 'inv-4',
  },
};

/**
 * Template 2: Customer Production Issue (Time-Sensitive Escalation)
 */
export const customerProductionIssue: ThreadTemplate = {
  id: 'customer-production-issue',
  name: 'Customer Production Issue Escalation',
  description: 'Customer has critical issue, gets escalated to CEO',
  category: 'escalation',
  emails: [
    {
      id: 'cust-1',
      from: 'david.kim@enterprise-corp.com',
      fromName: 'David Kim',
      to: ['{{user_email}}'],
      subject: 'URGENT: Production Issue - Login Failures',
      body: `{{user_name}},

We're experiencing a critical issue in production. Users cannot log in to the platform - affecting approximately 500 users across our organization.

This started about 2 hours ago. Need immediate assistance.

Error message: "Authentication service unavailable"

Priority: P0 - Business Critical

David Kim
CTO, Enterprise Corp`,
      sentDaysAgo: 3,
      labels: {
        senderType: 'customer',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        threadPosition: 'first',
        requiresImmediateAction: true,
        blocksOthers: true,
      },
    },
    {
      id: 'cust-2',
      from: '{{user_email}}',
      fromName: '{{user_name}}',
      to: ['david.kim@enterprise-corp.com'],
      subject: 'Re: URGENT: Production Issue - Login Failures',
      body: `David,

On it. Our engineering team is investigating now. I'll have an update for you within the hour.

{{user_name}}`,
      sentDaysAgo: 3,
      labels: {
        senderType: 'customer',
        isImportant: true,
        isUrgent: true,
        threadPosition: 'reply',
        containsCommitment: true,
        commitmentType: 'response',
        commitmentMadeBy: 'user',
        commitmentText: "I'll have an update for you within the hour",
      },
    },
    {
      id: 'cust-3',
      from: 'david.kim@enterprise-corp.com',
      fromName: 'David Kim',
      to: ['{{user_email}}'],
      subject: 'Re: URGENT: Production Issue - Login Failures',
      body: `{{user_name}},

It's been 3 hours now. Still not resolved. Our CEO is asking for status.

Need ETA on fix immediately.

David`,
      sentDaysAgo: 2,
      labels: {
        senderType: 'customer',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        threadPosition: 'follow_up',
        isFollowUp: true,
        sentiment: 'frustrated',
        followUpIteration: 1,
      },
    },
    {
      id: 'cust-4',
      from: 'david.kim@enterprise-corp.com',
      fromName: 'David Kim',
      to: ['{{user_email}}'],
      cc: ['ceo@enterprise-corp.com'],
      subject: 'Re: URGENT: Production Issue - Login Failures',
      body: `{{user_name}},

Escalating to our CEO. This is now 24 hours of downtime. Unacceptable.

We need this fixed by EOD today or we'll need to review our contract and consider alternatives.

David Kim
CTO, Enterprise Corp

CC: Jennifer Martinez (CEO, Enterprise Corp)`,
      sentDaysAgo: 0,
      labels: {
        senderType: 'customer',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        threadPosition: 'escalation',
        isEscalated: true,
        sentiment: 'angry',
        isFollowUp: true,
        followUpIteration: 2,
        followUpTone: 'escalating',
        deadlineDate: new Date(),
        requiresImmediateAction: true,
      },
    },
  ],
  groundTruthHints: {
    isDroppedBall: false, // User did respond
    isEscalated: true,
    hasOverdueCommitment: true, // Promised update in 1 hour, didn't deliver
    requiresUrgentAction: true,
    keyEmailId: 'cust-4',
  },
};

/**
 * Template 3: Commitment Overdue (User Failed to Deliver)
 */
export const overdueCommitment: ThreadTemplate = {
  id: 'overdue-commitment',
  name: 'Board Metrics - Overdue Commitment',
  description: 'User committed to send metrics, deadline passed, board member following up',
  category: 'commitment',
  emails: [
    {
      id: 'board-1',
      from: 'sarah.johnson@board-member.com',
      fromName: 'Sarah Johnson',
      to: ['{{user_email}}'],
      subject: 'Q3 Metrics for Friday Board Meeting',
      body: `Hi {{user_name}},

Board meeting is this Friday at 9am. Can you send me the Q3 metrics (revenue, burn, customer count, churn) before the meeting?

Would be great to have them by Thursday EOD so I can review.

Thanks,
Sarah Johnson
Board Member`,
      sentDaysAgo: 7, // Monday, 1 week ago
      labels: {
        senderType: 'boss',
        isImportant: true,
        requiresResponse: true,
        threadPosition: 'first',
        isVIP: true,
      },
    },
    {
      id: 'board-2',
      from: '{{user_email}}',
      fromName: '{{user_name}}',
      to: ['sarah.johnson@board-member.com'],
      subject: 'Re: Q3 Metrics for Friday Board Meeting',
      body: `Sarah,

Yes, I'll have them to you by Thursday EOD.

{{user_name}}`,
      sentDaysAgo: 7,
      labels: {
        senderType: 'boss',
        isImportant: true,
        threadPosition: 'reply',
        containsCommitment: true,
        commitmentType: 'deliverable',
        commitmentMadeBy: 'user',
        commitmentText: "I'll have them to you by Thursday EOD",
        commitmentDeadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (Thursday)
      },
    },
    // Thursday EOD passes - no metrics sent
    {
      id: 'board-3',
      from: 'sarah.johnson@board-member.com',
      fromName: 'Sarah Johnson',
      to: ['{{user_email}}'],
      subject: 'Re: Q3 Metrics for Friday Board Meeting',
      body: `{{user_name}},

Still need those metrics. Meeting is in 3 hours.

Can you send ASAP?

Sarah`,
      sentDaysAgo: 0, // Today (Friday morning)
      labels: {
        senderType: 'boss',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        threadPosition: 'follow_up',
        isFollowUp: true,
        followUpIteration: 1,
        sentiment: 'frustrated',
        isDroppedBall: true,
        commitmentStatus: 'overdue',
        deadlineDate: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        requiresImmediateAction: true,
      },
    },
  ],
  groundTruthHints: {
    isDroppedBall: true,
    isEscalated: false,
    hasOverdueCommitment: true,
    requiresUrgentAction: true,
    keyEmailId: 'board-3',
  },
};

/**
 * Template 4: Team Question Unanswered (Blocking Others)
 */
export const teamQuestionBlocking: ThreadTemplate = {
  id: 'team-question-blocking',
  name: 'Team Question - Blocking Work',
  description: 'Team member asks question, no response, team is blocked',
  category: 'dropped_ball',
  emails: [
    {
      id: 'team-1',
      from: 'alex.rodriguez@company.com',
      fromName: 'Alex Rodriguez',
      to: ['{{user_email}}'],
      subject: 'API Redesign vs Mobile Bug Fixes - Priority?',
      body: `Hi {{user_name}},

Quick question on priorities for this sprint:

Should we focus on the API redesign (affects long-term scalability) or tackle the mobile bug fixes (affecting users now)?

Can't do both with current bandwidth. Need your call on this.

Thanks,
Alex
Engineering Lead`,
      sentDaysAgo: 5,
      labels: {
        senderType: 'report',
        isImportant: true,
        requiresResponse: true,
        requiresDecision: true,
        threadPosition: 'first',
        containsQuestions: true,
        questions: ['Should we focus on the API redesign or tackle the mobile bug fixes?'],
      },
    },
    // No response from user
    {
      id: 'team-2',
      from: 'alex.rodriguez@company.com',
      fromName: 'Alex Rodriguez',
      to: ['{{user_email}}'],
      subject: 'Re: API Redesign vs Mobile Bug Fixes - Priority?',
      body: `{{user_name}},

Following up - team is blocked on this. Sprint planning is today and we need direction.

Can you please advise which to prioritize?

Alex`,
      sentDaysAgo: 2,
      labels: {
        senderType: 'report',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        requiresDecision: true,
        threadPosition: 'follow_up',
        isFollowUp: true,
        followUpIteration: 1,
        followUpTone: 'firm',
        blocksOthers: true,
        isDroppedBall: true,
      },
    },
    {
      id: 'team-3',
      from: 'alex.rodriguez@company.com',
      fromName: 'Alex Rodriguez',
      to: ['{{user_email}}'],
      subject: 'Re: API Redesign vs Mobile Bug Fixes - Priority?',
      body: `{{user_name}},

Team is still waiting on your decision. It's been almost a week.

We're at a standstill. Please respond today.

Alex`,
      sentDaysAgo: 0,
      labels: {
        senderType: 'report',
        isImportant: true,
        isUrgent: true,
        requiresResponse: true,
        requiresDecision: true,
        threadPosition: 'follow_up',
        isFollowUp: true,
        followUpIteration: 2,
        followUpTone: 'frustrated',
        sentiment: 'frustrated',
        blocksOthers: true,
        isDroppedBall: true,
        requiresImmediateAction: true,
      },
    },
  ],
  groundTruthHints: {
    isDroppedBall: true,
    isEscalated: false,
    hasOverdueCommitment: false,
    requiresUrgentAction: true,
    keyEmailId: 'team-3',
  },
};

/**
 * Template 5: Normal Thread (No Issues)
 */
export const normalHiringCoordination: ThreadTemplate = {
  id: 'normal-hiring',
  name: 'Normal Hiring Coordination',
  description: 'Recruiter coordinating interviews, normal back-and-forth',
  category: 'normal',
  emails: [
    {
      id: 'hire-1',
      from: 'recruiter@company.com',
      fromName: 'Jennifer Lee',
      to: ['{{user_email}}'],
      subject: 'VP Sales Candidates - Interview Scheduling',
      body: `Hi {{user_name}},

We have 3 strong candidates for the VP Sales role. All have great backgrounds in SaaS sales leadership.

When would you be available for 1-hour interviews next week?

Candidates:
- Michael Chen (ex-Salesforce)
- Lisa Park (ex-HubSpot)
- Robert Wilson (ex-Zoom)

Let me know your availability and I'll coordinate.

Best,
Jennifer Lee
Head of Talent`,
      sentDaysAgo: 5,
      labels: {
        senderType: 'peer',
        isImportant: true,
        requiresResponse: true,
        threadPosition: 'first',
      },
    },
    {
      id: 'hire-2',
      from: '{{user_email}}',
      fromName: '{{user_name}}',
      to: ['recruiter@company.com'],
      subject: 'Re: VP Sales Candidates - Interview Scheduling',
      body: `Jennifer,

Great! Next week Tuesday-Thursday afternoons work best for me.

Let's prioritize Michael and Lisa for first round.

{{user_name}}`,
      sentDaysAgo: 4,
      labels: {
        senderType: 'peer',
        isImportant: true,
        threadPosition: 'reply',
      },
    },
    {
      id: 'hire-3',
      from: 'recruiter@company.com',
      fromName: 'Jennifer Lee',
      to: ['{{user_email}}'],
      subject: 'Re: VP Sales Candidates - Interview Scheduling',
      body: `Perfect! Here are their available times:

Michael Chen:
- Tuesday 2pm
- Wednesday 3pm

Lisa Park:
- Tuesday 4pm
- Thursday 2pm

Which slots work for you?

Jennifer`,
      sentDaysAgo: 0,
      labels: {
        senderType: 'peer',
        isImportant: true,
        requiresResponse: true,
        threadPosition: 'follow_up',
        isFollowUp: false, // This is normal back-and-forth, not a reminder
      },
    },
  ],
  groundTruthHints: {
    isDroppedBall: false,
    isEscalated: false,
    hasOverdueCommitment: false,
    requiresUrgentAction: false,
    keyEmailId: 'hire-3',
  },
};

/**
 * All thread templates
 */
export const threadTemplates: ThreadTemplate[] = [
  investorDroppedBall,
  customerProductionIssue,
  overdueCommitment,
  teamQuestionBlocking,
  normalHiringCoordination,
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: ThreadTemplate['category']): ThreadTemplate[] {
  return threadTemplates.filter(t => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ThreadTemplate | undefined {
  return threadTemplates.find(t => t.id === id);
}
