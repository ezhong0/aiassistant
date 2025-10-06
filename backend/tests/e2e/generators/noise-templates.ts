/**
 * Noise Email Templates
 *
 * Generates realistic spam, newsletters, and cold outreach emails.
 * Some emails are persona-dependent (e.g., recruiter emails might be wanted by founders, unwanted by ICs)
 */

import { SenderType } from '../models/advanced-ground-truth';

export interface NoiseTemplate {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  senderType: SenderType;
  subcategory: string;
  isDeceptive: boolean; // Looks important but isn't

  // Persona-specific categorization
  categoryByPersona: {
    founder: 'signal' | 'noise' | 'spam';
    executive: 'signal' | 'noise' | 'spam';
    manager: 'signal' | 'noise' | 'spam';
    individual: 'signal' | 'noise' | 'spam';
  };
}

/**
 * Recruiter templates - wanted by founders/managers hiring, unwanted by ICs
 */
export const recruiterTemplates: NoiseTemplate[] = [
  {
    id: 'recruiter-cold-1',
    from: 'srobinson@triplebyte.com',
    fromName: 'Sarah Robinson',
    subject: 'Senior Engineers for your team',
    body: `Hi,

I work with top engineering talent and noticed you're hiring. I have several senior engineers who might be a good fit for your team.

Would you be open to a quick call to discuss your hiring needs?

Best,
Sarah Robinson
Technical Recruiter, Triplebyte`,
    senderType: 'recruiter',
    subcategory: 'recruiting',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'signal', // Founder is likely hiring
      executive: 'signal', // Executive might be hiring
      manager: 'noise', // Manager might be hiring but this is cold outreach
      individual: 'spam', // IC not interested
    },
  },
  {
    id: 'recruiter-cold-2',
    from: 'mchen@hired.com',
    fromName: 'Michael Chen',
    subject: 'Re: VP Engineering opportunity at Series B startup',
    body: `Following up on my previous email about the VP Engineering role.

$250k-$350k + equity
Series B, $50M raised
Remote-friendly

Would love to share more details if you're open to exploring.

Michael`,
    senderType: 'recruiter',
    subcategory: 'recruiting',
    isDeceptive: true, // Fake "Re:" to look like ongoing conversation
    categoryByPersona: {
      founder: 'spam', // Wrong - trying to poach
      executive: 'noise', // Might be interesting but unsolicited
      manager: 'noise',
      individual: 'spam', // Not interested
    },
  },
  {
    id: 'recruiter-cold-3',
    from: 'jlee@google.com',
    fromName: 'Jennifer Lee',
    subject: 'Google Engineering Leadership opportunity',
    body: `Hi,

I'm a recruiter at Google and came across your profile. We have an exciting Engineering Manager opportunity on our Cloud Platform team.

Would you be interested in learning more?

Best,
Jennifer Lee
Technical Recruiter, Google`,
    senderType: 'recruiter',
    subcategory: 'recruiting',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'noise', // Founder not looking to leave
      executive: 'noise', // Maybe interesting but unsolicited
      manager: 'signal', // Manager might be interested
      individual: 'signal', // IC might be interested in Google
    },
  },
];

/**
 * Newsletter templates - low priority but might have occasional value
 */
export const newsletterTemplates: NoiseTemplate[] = [
  {
    id: 'newsletter-1',
    from: 'newsletter@techcrunch.com',
    fromName: 'TechCrunch Daily',
    subject: 'TC Daily: Meta launches new AI model',
    body: `Today's top stories:

• Meta launches Llama 3 competitor
• Stripe raises $6.5B at $50B valuation
• Tesla recalls 2M vehicles over autopilot issue

Read more at TechCrunch.com`,
    senderType: 'spam',
    subcategory: 'newsletter',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'noise',
      executive: 'noise',
      manager: 'noise',
      individual: 'noise',
    },
  },
  {
    id: 'newsletter-2',
    from: 'team@substack.com',
    fromName: 'Lenny\'s Newsletter',
    subject: 'How to run effective 1-on-1s',
    body: `This week: Management best practices for startup leaders.

I interviewed 50 VPs about their 1-on-1 frameworks. Here's what works...

[Read more]`,
    senderType: 'spam',
    subcategory: 'newsletter',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'signal', // Founders might want management content
      executive: 'signal', // Executives might want management content
      manager: 'signal', // Managers definitely want this
      individual: 'noise', // ICs less interested
    },
  },
  {
    id: 'newsletter-3',
    from: 'alerts@github.com',
    fromName: 'GitHub Security',
    subject: 'ACTION REQUIRED: Critical security vulnerability in your dependencies',
    body: `A critical security vulnerability was found in one of your project dependencies.

Project: acme-backend
Severity: High
Package: lodash@4.17.20

[View details and fix]`,
    senderType: 'external',
    subcategory: 'security_alert',
    isDeceptive: true, // Looks urgent but might be low priority
    categoryByPersona: {
      founder: 'signal', // Founder cares about security
      executive: 'signal',
      manager: 'signal',
      individual: 'signal', // Everyone should care about security
    },
  },
];

/**
 * Sales/marketing templates - almost always spam
 */
export const salesTemplates: NoiseTemplate[] = [
  {
    id: 'sales-1',
    from: 'sales@intercom.com',
    fromName: 'David Wilson',
    subject: 'Increase customer engagement by 10x',
    body: `Hi,

I noticed you're using basic email for customer support. Companies like yours typically see 10x improvement in customer engagement with Intercom.

Want to see a demo?

David Wilson
Sales, Intercom`,
    senderType: 'spam',
    subcategory: 'sales',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'noise', // Might be relevant but unsolicited
      executive: 'noise',
      manager: 'spam',
      individual: 'spam',
    },
  },
  {
    id: 'sales-2',
    from: 'growth@clearbit.com',
    fromName: 'Amy Chen',
    subject: 'Re: Data enrichment for Acme',
    body: `Following up on data enrichment opportunities.

Clearbit can help you enrich your customer data with:
• Company size, industry, revenue
• Contact information
• Technographics

[Book a demo]`,
    senderType: 'spam',
    subcategory: 'sales',
    isDeceptive: true, // Fake "Re:" to look like ongoing conversation
    categoryByPersona: {
      founder: 'spam',
      executive: 'spam',
      manager: 'spam',
      individual: 'spam',
    },
  },
  {
    id: 'sales-3',
    from: 'partnerships@stripe.com',
    fromName: 'Tom Harris',
    subject: 'Stripe partnership opportunity',
    body: `Hi,

I lead partnerships at Stripe. We're looking to partner with companies in your space to offer integrated payment solutions.

This could be a significant revenue opportunity for Acme. Would you be open to discussing?

Best,
Tom Harris
Partnerships, Stripe`,
    senderType: 'external',
    subcategory: 'partnership',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'signal', // Partnerships are important for founders
      executive: 'signal', // Executives care about partnerships
      manager: 'noise',
      individual: 'spam',
    },
  },
];

/**
 * Conference/event invites - sometimes relevant
 */
export const eventTemplates: NoiseTemplate[] = [
  {
    id: 'event-1',
    from: 'events@techcrunch.com',
    fromName: 'TechCrunch Events',
    subject: 'TechCrunch Disrupt 2025 - Early bird pricing',
    body: `Join 10,000+ founders, investors, and tech leaders at TechCrunch Disrupt 2025.

Early bird tickets: $1,495 (save $500)
September 15-17, San Francisco

[Register now]`,
    senderType: 'spam',
    subcategory: 'event',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'noise', // Might be interested in conferences
      executive: 'noise',
      manager: 'spam',
      individual: 'spam',
    },
  },
  {
    id: 'event-2',
    from: 'info@saastr.com',
    fromName: 'SaaStr',
    subject: 'SaaStr Annual 2025 - Founder pass available',
    body: `Limited founder passes available for SaaStr Annual 2025.

• 300+ SaaS leaders speaking
• Private founder dinners
• Investor meetings

[Claim your pass]`,
    senderType: 'spam',
    subcategory: 'event',
    isDeceptive: false,
    categoryByPersona: {
      founder: 'signal', // SaaS founders want this
      executive: 'noise',
      manager: 'spam',
      individual: 'spam',
    },
  },
];

/**
 * Get all noise templates
 */
export function getAllNoiseTemplates(): NoiseTemplate[] {
  return [
    ...recruiterTemplates,
    ...newsletterTemplates,
    ...salesTemplates,
    ...eventTemplates,
  ];
}

/**
 * Get noise templates appropriate for persona
 */
export function getNoiseTemplatesForPersona(
  persona: 'founder' | 'executive' | 'manager' | 'individual'
): NoiseTemplate[] {
  return getAllNoiseTemplates();
}

/**
 * Get random noise template
 */
export function getRandomNoiseTemplate(
  persona?: 'founder' | 'executive' | 'manager' | 'individual'
): NoiseTemplate {
  const templates = persona
    ? getNoiseTemplatesForPersona(persona)
    : getAllNoiseTemplates();

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Determine if email should be categorized as spam/noise/signal based on persona
 */
export function categorizeNoiseEmail(
  template: NoiseTemplate,
  persona: 'founder' | 'executive' | 'manager' | 'individual'
): 'signal' | 'noise' | 'spam' {
  return template.categoryByPersona[persona];
}
