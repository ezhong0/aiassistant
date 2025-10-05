/**
 * Realistic Email Templates
 *
 * Based on analysis of real workplace emails:
 * - Varied length (1-liner to multi-paragraph)
 * - Specific technical details and project names
 * - Natural formatting (bullets, links, inline responses)
 * - Contextual references to meetings, Slack, docs
 * - Different communication styles by role
 */

import { SenderType } from '../models/advanced-ground-truth';

export interface RealisticEmailTemplate {
  subject: string;
  body: string;
  hasQuestion?: boolean;
  requiresAction?: boolean;
  requiresDecision?: boolean;
  hasDeadline?: boolean;
  hasAttachment?: boolean;
  urgency?: 'low' | 'medium' | 'high';
  length?: 'short' | 'medium' | 'long';
}

/**
 * Boss/Manager Emails - Direct, assume context, often terse
 */
export const BOSS_EMAILS: RealisticEmailTemplate[] = [
  {
    subject: 'Re: Q4 headcount',
    body: `Can you send me the updated headcount plan by EOD? Board deck is due Friday.

Thanks`,
    hasDeadline: true,
    requiresAction: true,
    urgency: 'high',
    length: 'short',
  },
  {
    subject: 'Thoughts on the Acme deal?',
    body: `Just got off the phone with their CTO. They want to move forward but are asking for a 20% discount and dedicated support.

What do you think? Can we make this work financially?

Let's discuss in our 1:1 tomorrow.`,
    hasQuestion: true,
    urgency: 'medium',
    length: 'medium',
  },
  {
    subject: 'FYI - Board meeting moved',
    body: `Board meeting is now Thursday 9am (was Friday).

Need your slides by Wednesday EOD instead.`,
    requiresAction: true,
    hasDeadline: true,
    urgency: 'high',
    length: 'short',
  },
  {
    subject: 'Team concerns',
    body: `Had a 1:1 with Sarah this morning. She mentioned the team is feeling overwhelmed with the sprint velocity expectations.

Can we chat about this? I know we committed to shipping fast, but we also need to avoid burnout.

Free anytime today after 2pm.`,
    hasQuestion: true,
    urgency: 'medium',
    length: 'medium',
  },
  {
    subject: 'Customer escalation - GlobalTech',
    body: `GlobalTech CTO just called me directly about the API latency issues. This is the 3rd time this month.

We need to get ahead of this. Can you:
1. Get me a technical root cause analysis by EOD
2. Set up a call with their team for tomorrow
3. Put together a remediation plan

This is a $500K/year account. We can't afford to lose them.`,
    requiresAction: true,
    hasDeadline: true,
    urgency: 'high',
    length: 'long',
  },
];

/**
 * Direct Report Emails - More formal, detailed, asks questions
 */
export const REPORT_EMAILS: RealisticEmailTemplate[] = [
  {
    subject: 'API Design Review - User Service Refactor',
    body: `Hey,

I've been working on the user service refactor (JIRA-2847) and wanted to get your input on the API design before I go too far down this path.

**Current approach:**
- Moving from REST to GraphQL for the user mutations
- Consolidating 5 separate endpoints into a single flexible query
- Adding real-time subscriptions for user presence

**Concerns:**
- This will require frontend changes across 3 different apps
- Might impact our API response time SLA (currently 200ms p95)
- Need to train the team on GraphQL best practices

**Questions:**
1. Do you think the migration complexity is worth it?
2. Should we do a phased rollout or big-bang migration?
3. Any concerns about the GraphQL approach?

I put together a design doc here: https://docs.google.com/document/d/abc123

Would love to discuss in our 1:1 this week, or earlier if you have thoughts.

Thanks!`,
    hasQuestion: true,
    requiresDecision: true,
    hasAttachment: true,
    urgency: 'medium',
    length: 'long',
  },
  {
    subject: 'Blocked on prod deployment',
    body: `Quick heads up - our deployment is blocked because the staging DB migration is failing.

Error: Foreign key constraint violation on users.team_id

I think it's because we didn't backfill the legacy data. Should I:
a) Write a migration script to fix the data first, or
b) Remove the foreign key constraint for now?

Deployment is scheduled for 2pm today. Let me know what you prefer.`,
    hasQuestion: true,
    requiresDecision: true,
    hasDeadline: true,
    urgency: 'high',
    length: 'medium',
  },
  {
    subject: 'Sprint Planning - Priorities?',
    body: `Planning next sprint and wanted to check priorities with you.

We have capacity for about 40 story points. Current backlog:

**High Priority** (per product):
- Mobile app bug fixes (8 pts) - 15 bugs in backlog
- Dashboard performance optimization (13 pts)
- User onboarding flow redesign (21 pts)

**Medium Priority:**
- API rate limiting (5 pts)
- Admin panel improvements (8 pts)

If we do all high priority items, we're over capacity. What should we defer?

Also, the onboarding redesign depends on design mockups which aren't ready yet. Should we swap that for the admin panel work?

Let me know by tomorrow so I can finalize the sprint plan.

Thanks!`,
    hasQuestion: true,
    requiresDecision: true,
    hasDeadline: true,
    urgency: 'medium',
    length: 'long',
  },
  {
    subject: 'Quick question on architecture',
    body: `Should our new microservice use Redis or Postgres for caching?

Context: We're building the notification service and need to cache user preferences. ~10k reads/sec expected.

I'm leaning Redis but wanted to check if there's a reason to stick with Postgres.`,
    hasQuestion: true,
    requiresDecision: true,
    urgency: 'low',
    length: 'short',
  },
];

/**
 * Peer/Teammate Emails - Casual, collaborative
 */
export const PEER_EMAILS: RealisticEmailTemplate[] = [
  {
    subject: 'Re: Data pipeline discussion',
    body: `Hey! Was thinking more about our conversation from this morning.

What if we batch the data processing every 15 mins instead of real-time? That would:
- Reduce our AWS costs by ~40% (fewer Lambda invocations)
- Simplify the error handling
- Still meet the business requirement (they said "near real-time")

The tradeoff is users might see slightly stale data, but honestly they probably won't notice.

Thoughts? Want to Slack about it or just chat at lunch?`,
    hasQuestion: true,
    urgency: 'low',
    length: 'medium',
  },
  {
    subject: 'Code review requested: PR #847',
    body: `Can you take a look at my PR when you get a chance?

https://github.com/company/repo/pull/847

It's the authentication refactor we discussed. About 600 lines of changes but mostly moving code around.

No rush - sometime this week would be great!`,
    requiresAction: true,
    urgency: 'low',
    length: 'short',
  },
  {
    subject: 'Pairing session tomorrow?',
    body: `Want to pair on the webhook integration tomorrow afternoon?

I'm stuck on the signature verification and I know you've done this before with Stripe.

Free after 2pm.`,
    hasQuestion: true,
    urgency: 'low',
    length: 'short',
  },
  {
    subject: 'Interesting article on distributed tracing',
    body: `Saw this article and thought of our conversation last week about observability:

https://www.example.com/distributed-tracing-best-practices

They talk about using OpenTelemetry which is what I was suggesting. Might be worth exploring for our microservices.

Also has some good performance tips that could help with our current latency issues.`,
    hasAttachment: true,
    urgency: 'low',
    length: 'medium',
  },
  {
    subject: 'Coffee later?',
    body: `Want to grab coffee around 3pm? Been heads down all week and need a break.

Also wanted to pick your brain about that staff engineer role you interviewed for.`,
    hasQuestion: true,
    urgency: 'low',
    length: 'short',
  },
];

/**
 * Customer Emails - Varies by urgency and sentiment
 */
export const CUSTOMER_EMAILS: RealisticEmailTemplate[] = [
  {
    subject: 'URGENT: Production issue affecting 500+ users',
    body: `We're experiencing a critical production issue right now.

**Problem:** Users cannot log in to the platform. Getting a 500 error on the auth endpoint.

**Impact:** ~500 active users across our organization. This started about 45 minutes ago at 9:15am PT.

**Error message:** "Internal server error - authentication service unavailable"

**What we've tried:**
- Cleared browser cache
- Tried different browsers
- Tested with different user accounts - all failing

This is blocking our entire sales team from accessing customer data. We need immediate assistance.

Can someone from your engineering team please investigate ASAP?

Thanks,
David Anderson
VP Engineering, Acme Corp
david.anderson@acmecorp.com | 555-123-4567`,
    requiresAction: true,
    urgency: 'high',
    length: 'long',
    hasDeadline: true,
  },
  {
    subject: 'Feature request: Bulk user import',
    body: `Hi team,

We've been using your platform for about 6 months now and overall it's been great!

One feature that would really help us: bulk user import via CSV.

**Use case:** We're onboarding new enterprise clients who have 100-200 existing users. Currently we have to add them one-by-one through the UI which takes hours.

**What we'd want:**
- Upload CSV file with user details (name, email, role, team)
- Preview the import before confirming
- Error reporting for invalid emails/duplicates
- Ability to assign default permissions to all imported users

Is this something on your roadmap? We'd be happy to provide more detailed requirements or even beta test it.

Let me know!

Thanks,
Lisa`,
    hasQuestion: true,
    urgency: 'low',
    length: 'long',
  },
  {
    subject: 'Re: Data sync issues',
    body: `Following up on my email from last week about data sync problems.

We're still seeing intermittent failures between your platform and our CRM (Salesforce). About 15% of records aren't syncing.

I attached the error logs from the past 7 days. Can someone from your team take a look?

This is starting to impact our sales team's workflow. Need to resolve this soon.

Thanks`,
    requiresAction: true,
    hasAttachment: true,
    urgency: 'high',
    length: 'medium',
    hasDeadline: true,
  },
  {
    subject: 'Quick question about API rate limits',
    body: `What's the rate limit for the /api/v2/users endpoint?

We're hitting 429 errors occasionally and want to adjust our polling frequency.

Thanks!`,
    hasQuestion: true,
    urgency: 'low',
    length: 'short',
  },
  {
    subject: 'Contract renewal discussion',
    body: `Our annual contract is up for renewal next month (Feb 15th).

We've been very happy with the platform. Would like to schedule a call to discuss:
- Pricing for year 2
- Adding 25 more seats
- Enterprise support tier

Are you the right person to talk to, or should I reach out to our account manager?

Let me know your availability next week.

Best,
Mark Johnson
CTO, GrowthStartup Inc.`,
    hasQuestion: true,
    urgency: 'medium',
    length: 'medium',
  },
];

/**
 * External/Vendor Emails - More formal
 */
export const EXTERNAL_EMAILS: RealisticEmailTemplate[] = [
  {
    subject: 'AWS invoice - action required',
    body: `Hello,

Your AWS invoice for January 2024 is ready.

**Amount due:** $12,847.63
**Due date:** February 15, 2024
**Account ID:** 1234-5678-9012

You can view and pay your invoice here: https://aws.amazon.com/billing

**Summary:**
- EC2 instances: $5,240.00
- S3 storage: $2,150.00
- RDS databases: $3,200.00
- Data transfer: $1,800.00
- Other services: $457.63

Your payment method on file: Visa ending in 4242

If you have any questions about your bill, please contact our support team.

Best regards,
AWS Billing Team`,
    requiresAction: true,
    hasDeadline: true,
    urgency: 'medium',
    length: 'long',
  },
  {
    subject: 'Recruiting partnership opportunity',
    body: `Hi,

I'm Sarah from TopTalent Recruiting. We specialize in placing senior engineering talent at high-growth startups.

I noticed your company is hiring for several engineering roles. We have a network of pre-vetted candidates who might be a great fit:

- Senior Backend Engineers (Go, Python, Node.js)
- Engineering Managers
- Staff/Principal Engineers

Our model: We only get paid if you hire someone ($25K placement fee, 90-day guarantee).

Would you be open to a 15-min call to discuss how we might help accelerate your hiring?

My calendar: https://calendly.com/sarah-recruiter

Best,
Sarah Mitchell
TopTalent Recruiting`,
    hasQuestion: true,
    hasAttachment: true,
    urgency: 'low',
    length: 'medium',
  },
  {
    subject: 'Security audit findings - action required',
    body: `Hello,

We've completed the security audit of your application per SOC 2 compliance requirements.

**Overall result:** PASS (with minor findings)

**Critical issues:** 0
**High priority:** 2
**Medium priority:** 8
**Low priority:** 15

**High priority items that need immediate attention:**

1. **Password reset tokens don't expire**
   - Current state: Tokens valid indefinitely
   - Required: Max 24 hour expiration
   - Risk: Account takeover if token is compromised

2. **API keys transmitted in URL parameters**
   - Current state: /api/v1/data?apiKey=xxx
   - Required: Use Authorization header
   - Risk: Keys logged in server logs, browser history

Full report attached. Please remediate high priority items within 30 days.

Let me know if you have questions.

Best,
James Wilson
Security Auditor, SecureAudit Co.`,
    requiresAction: true,
    hasDeadline: true,
    hasAttachment: true,
    urgency: 'high',
    length: 'long',
  },
];

/**
 * Get random template by sender type
 */
export function getRandomEmailTemplate(senderType: SenderType): RealisticEmailTemplate {
  let templates: RealisticEmailTemplate[];

  switch (senderType) {
    case 'boss':
      templates = BOSS_EMAILS;
      break;
    case 'report':
      templates = REPORT_EMAILS;
      break;
    case 'peer':
      templates = PEER_EMAILS;
      break;
    case 'customer':
      templates = CUSTOMER_EMAILS;
      break;
    case 'vendor':
    case 'external':
      templates = EXTERNAL_EMAILS;
      break;
    default:
      templates = PEER_EMAILS;
  }

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate varied greeting based on sender type and relationship
 */
export function generateGreeting(senderType: SenderType, isFirstEmail: boolean = true): string {
  if (Math.random() < 0.3) {
    return ''; // 30% chance of no greeting (realistic for quick replies)
  }

  const greetings = {
    boss: ['', 'Quick question -', 'FYI -', 'Heads up -'],
    report: ['Hey,', 'Hi,', 'Hey!', 'Hi there,'],
    peer: ['Hey!', 'Hi,', 'Yo,', 'Hey,', ''],
    customer: ['Hello,', 'Hi,', 'Hi team,', 'Hello team,'],
    vendor: ['Hello,', 'Hi,', 'Good morning,', 'Good afternoon,'],
    external: ['Hello,', 'Hi,', 'Good morning,', 'Dear team,'],
  };

  const options = greetings[senderType as keyof typeof greetings] || greetings.peer;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate varied closing based on sender type
 */
export function generateClosing(senderType: SenderType): string {
  if (Math.random() < 0.4) {
    return ''; // 40% chance of no closing (realistic for internal emails)
  }

  const closings = {
    boss: ['Thanks', 'Thanks,', ''],
    report: ['Thanks!', 'Thanks,', 'Thank you!', 'Appreciate it!'],
    peer: ['Thanks!', 'Cheers,', 'Thanks,', ''],
    customer: ['Thanks,', 'Thank you,', 'Best regards,', 'Best,'],
    vendor: ['Best regards,', 'Thank you,', 'Best,', 'Regards,'],
    external: ['Best regards,', 'Thank you,', 'Sincerely,', 'Best,'],
  };

  const options = closings[senderType as keyof typeof closings] || closings.peer;
  return options[Math.floor(Math.random() * options.length)];
}
