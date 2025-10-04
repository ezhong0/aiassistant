/**
 * Simple Realistic Inbox Generator
 *
 * Generates realistic email inboxes with minimal complexity.
 * 3-step process: Context → Weeks → Ground Truth
 *
 * Uses GPT-5 Nano for everything (~$0.03 per inbox)
 */

import { BaseService } from '../../../src/services/base-service';

// Simple interface for AI service - just needs to generate text
interface SimpleAIService {
  generateResponse(prompt: string): Promise<string>;
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface SimpleContext {
  persona: {
    role: 'founder' | 'vp_sales' | 'eng_manager' | 'busy_exec';
    name: string;
    email: string;
    company: string;
    industry: string;
    style: 'overwhelmed' | 'organized' | 'responsive' | 'drowning';
  };
  keyPeople: SimplePerson[];
}

export interface SimplePerson {
  name: string;
  email: string;
  role: string;
  type: 'boss' | 'report' | 'customer' | 'vendor' | 'investor' | 'spam';
  emailFrequency: 'daily' | 'weekly' | 'rarely';
  importance: 'high' | 'medium' | 'low';
}

export interface WeekData {
  weekNumber: number;
  startDate: Date;
  emails: SimpleEmail[];
  continuedThreads: string[];
}

export interface SimpleEmail {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  timestamp: Date;
  isImportant: boolean;
  isUrgent: boolean;
  requiresResponse: boolean;
  category: 'signal' | 'noise';
  gmailFormat: any;
}

export interface SimpleGroundTruth {
  emailLabels: {
    [emailId: string]: {
      isUrgent: boolean;
      isImportant: boolean;
      requiresResponse: boolean;
      fromVIP: boolean;
      category: string;
      topics: string[];
    };
  };
  testQueries: SimpleTestQuery[];
}

export interface SimpleTestQuery {
  query: string;
  expectedEmailIds: string[];
  reasoning: string;
}

export interface SimpleInbox {
  context: SimpleContext;
  weeks: WeekData[];
  groundTruth: SimpleGroundTruth;
  totalEmails: number;
  metadata: {
    generatedAt: string;
    template: string;
    version: string;
  };
}

export interface SimpleTemplate {
  name: string;
  description: string;
  config: {
    weeks: number;
    emailsPerWeek: number;
    urgentRate: number;
    responseRate: number;
    industries: string[];
    painPoints: string[];
  };
}

// ============================================================================
// GENERATOR
// ============================================================================

export class SimpleRealisticInboxGenerator extends BaseService {
  constructor(private aiService: SimpleAIService) {
    super('SimpleRealisticInboxGenerator');
  }

  protected async onInitialize(): Promise<void> {
    this.logInfo('SimpleRealisticInboxGenerator initialized');
  }

  protected async onDestroy(): Promise<void> {
    this.logInfo('SimpleRealisticInboxGenerator destroyed');
  }

  /**
   * Generate complete inbox in 3 steps
   */
  async generate(templateName: string, weeks: number = 6): Promise<SimpleInbox> {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    this.logInfo(`Generating inbox: ${template.name} (${weeks} weeks)`);

    // STEP 1: Setup context (1 call)
    this.logInfo('Step 1/3: Generating context...');
    const startContext = Date.now();
    const context = await this.generateContext(template);
    this.logInfo(`✓ Context generated (${Date.now() - startContext}ms)`);

    // STEP 2: Generate weeks (N calls)
    this.logInfo(`Step 2/3: Generating ${weeks} weeks of emails...`);
    const allWeeks: WeekData[] = [];
    let continuedThreads: string[] = [];

    for (let i = 0; i < weeks; i++) {
      this.logInfo(`  Week ${i + 1}/${weeks}...`);
      const startWeek = Date.now();
      const week = await this.generateWeek(context, i, continuedThreads, template);
      allWeeks.push(week);
      this.logInfo(`  ✓ Week ${i + 1} generated: ${week.emails.length} emails (${Date.now() - startWeek}ms)`);

      // Randomly continue some threads to next week
      continuedThreads = this.selectThreadsToContinue(week);

      // Small delay to avoid rate limits
      if (i < weeks - 1) {
        await this.sleep(500);
      }
    }

    // STEP 3: Generate ground truth (1 call)
    this.logInfo('Step 3/3: Generating test labels...');
    const startLabels = Date.now();
    const groundTruth = await this.generateGroundTruth(context, allWeeks);
    this.logInfo(`✓ Labels generated (${Date.now() - startLabels}ms)`);

    const totalEmails = allWeeks.reduce((sum, w) => sum + w.emails.length, 0);
    this.logInfo(`✅ Inbox generated: ${totalEmails} emails total`);

    return {
      context,
      weeks: allWeeks,
      groundTruth,
      totalEmails,
      metadata: {
        generatedAt: new Date().toISOString(),
        template: templateName,
        version: '1.0.0'
      }
    };
  }

  /**
   * STEP 1: Generate context with GPT-5 Nano
   */
  private async generateContext(template: SimpleTemplate): Promise<SimpleContext> {
    const prompt = `Generate realistic email inbox context.

TEMPLATE: ${template.name}
DESCRIPTION: ${template.description}
INDUSTRIES: ${template.config.industries.join(', ')}
PAIN POINTS: ${template.config.painPoints.join(', ')}

Create:
1. A realistic persona (name, role, company, work style)
2. Exactly 20 key people they email with

PEOPLE BREAKDOWN:
- 3 bosses/investors (high importance, email weekly)
- 5 direct reports/team members (medium importance, email daily)
- 5 customers (high importance, email varies)
- 4 vendors/partners (medium importance, email weekly)
- 3 noise sources (low importance, email daily - recruiters, sales spam)

Each person needs:
- Realistic name and email address
- Specific role and company
- Type (boss/report/customer/vendor/investor/spam)
- Email frequency (daily/weekly/rarely)
- Importance level (high/medium/low)

BE SPECIFIC: Use real-sounding names, companies, roles. Add variety.

Return ONLY valid JSON matching this EXACT schema (no markdown, no code blocks):
{
  "persona": {
    "role": "founder",
    "name": "Alex Johnson",
    "email": "alex@company.com",
    "company": "TechCorp Inc",
    "industry": "SaaS",
    "style": "overwhelmed"
  },
  "keyPeople": [
    {
      "name": "Sarah Chen",
      "email": "sarah.chen@investco.com",
      "role": "Partner",
      "type": "investor",
      "emailFrequency": "weekly",
      "importance": "high"
    }
  ]
}`;

    const response = await this.aiService.generateResponse(prompt);
    const cleanedResponse = this.cleanJSON(response);
    const context = JSON.parse(cleanedResponse);

    // Validate (allow 15-25 people for flexibility)
    if (!context.persona || !context.keyPeople || context.keyPeople.length < 15 || context.keyPeople.length > 25) {
      this.logError(`Invalid context: persona=${!!context.persona}, keyPeople=${!!context.keyPeople}, count=${context.keyPeople?.length || 0}`, new Error('Invalid context'));
      throw new Error(`Invalid context generated: expected 15-25 people, got ${context.keyPeople?.length || 0}`);
    }

    this.logInfo(`Context generated with ${context.keyPeople.length} people`);

    return context;
  }

  /**
   * STEP 2: Generate one week of emails
   */
  private async generateWeek(
    context: SimpleContext,
    weekNumber: number,
    continuedThreads: string[],
    template: SimpleTemplate
  ): Promise<WeekData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - ((template.config.weeks - weekNumber) * 7));

    const prompt = `Generate realistic emails for Week ${weekNumber + 1}.

PERSONA: ${context.persona.name} (${context.persona.role}) at ${context.persona.company}
STYLE: ${context.persona.style}
EMAIL: ${context.persona.email}

KEY PEOPLE:
${context.keyPeople.map(p => `- ${p.name} (${p.email}): ${p.role} at ${p.type}, importance: ${p.importance}`).join('\n')}

${continuedThreads.length > 0 ? `CONTINUED THREADS FROM LAST WEEK: ${continuedThreads.join(', ')}` : ''}

Generate ${template.config.emailsPerWeek} emails for this week (${startDate.toDateString()} to ${new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000).toDateString()}):

SIGNAL EMAILS (${Math.floor(template.config.emailsPerWeek * 0.6)} emails - IMPORTANT):
- ${Math.floor(template.config.emailsPerWeek * 0.2)} from high importance people (bosses, customers, investors)
- ${Math.floor(template.config.emailsPerWeek * 0.2)} from team/reports
- ${Math.floor(template.config.emailsPerWeek * 0.2)} from partners/vendors
${continuedThreads.length > 0 ? `- Continue 2-3 threads from last week: ${continuedThreads.slice(0, 3).join(', ')}` : ''}
- Mix urgent (${Math.floor(template.config.urgentRate * 100)}%) and normal

NOISE EMAILS (${Math.floor(template.config.emailsPerWeek * 0.4)} emails):
- ${Math.floor(template.config.emailsPerWeek * 0.15)} newsletters (tech news, industry updates)
- ${Math.floor(template.config.emailsPerWeek * 0.15)} cold sales outreach
- ${Math.floor(template.config.emailsPerWeek * 0.1)} recruiter spam

CRITICAL REQUIREMENTS:
✓ FULL email bodies (200-500 words for signal, 50-150 for noise)
✓ Realistic subjects (specific, not generic)
✓ Business hours timestamps ONLY (Mon-Fri, 8am-6pm)
✓ Some threads with 2-4 back-and-forth emails
✓ Specific details: names, numbers, dates, projects, deliverables
✓ Professional formatting: greeting, body paragraphs, signature
✓ Realistic sender names and companies from KEY PEOPLE above

Return ONLY valid JSON array (no markdown, no code blocks):
[
  {
    "from": "sarah.chen@investco.com",
    "to": ["${context.persona.email}"],
    "cc": [],
    "subject": "Q4 Board Meeting - Metrics Review",
    "body": "Hi ${context.persona.name},\\n\\nHope you're doing well. I wanted to reach out regarding our upcoming Q4 board meeting...\\n\\n[3-5 full paragraphs with specific details]\\n\\nBest regards,\\nSarah Chen\\nPartner, InvestCo",
    "timestamp": "${startDate.toISOString()}",
    "threadId": "thread-${weekNumber}-1",
    "isImportant": true,
    "isUrgent": false,
    "requiresResponse": true,
    "category": "signal"
  }
]`;

    const response = await this.aiService.generateResponse(prompt);
    const emailsRaw = JSON.parse(this.cleanJSON(response));

    // Validate and convert
    const emails = emailsRaw.map((e: any, idx: number) =>
      this.convertToSimpleEmail(e, weekNumber, idx, startDate)
    );

    return {
      weekNumber,
      startDate,
      emails,
      continuedThreads
    };
  }

  /**
   * STEP 3: Generate ground truth labels
   */
  private async generateGroundTruth(
    context: SimpleContext,
    weeks: WeekData[]
  ): Promise<SimpleGroundTruth> {
    const allEmails = weeks.flatMap(w => w.emails);

    const emailsSummary = allEmails.map(e => `
ID: ${e.id}
From: ${e.from}
Subject: ${e.subject}
Preview: ${e.body.substring(0, 150)}...
`).join('\n---\n');

    const prompt = `Label these emails for testing an AI email assistant.

PERSONA: ${context.persona.name} (${context.persona.role}) at ${context.persona.company}

EMAILS (${allEmails.length} total):
${emailsSummary}

For EACH email, provide accurate labels:
- isUrgent: Is this objectively time-sensitive?
- isImportant: Does this matter to persona's role/goals?
- requiresResponse: Does this need a reply from persona?
- fromVIP: Is the sender high-priority for persona?
- category: customer/internal/vendor/investor/noise
- topics: Key topics mentioned (2-5 keywords)

ALSO create 15 realistic test queries with expected email IDs:

Examples:
- "Show urgent emails from customers"
- "What needs my response this week?"
- "Find emails about fundraising"
- "Show unread important emails"
- "Emails from my team"

Return ONLY valid JSON (no markdown):
{
  "emailLabels": {
    "${allEmails[0].id}": {
      "isUrgent": true,
      "isImportant": true,
      "requiresResponse": true,
      "fromVIP": true,
      "category": "customer",
      "topics": ["product issue", "deadline", "escalation"]
    }
  },
  "testQueries": [
    {
      "query": "Show urgent customer emails",
      "expectedEmailIds": ["email-id-1", "email-id-5"],
      "reasoning": "These emails are from customers with urgent time-sensitive issues"
    }
  ]
}`;

    const response = await this.aiService.generateResponse(prompt);
    const groundTruth = JSON.parse(this.cleanJSON(response));

    // Validate
    if (!groundTruth.emailLabels || !groundTruth.testQueries) {
      throw new Error('Invalid ground truth generated');
    }

    return groundTruth;
  }

  /**
   * Convert raw email to SimpleEmail with Gmail format
   */
  private convertToSimpleEmail(
    raw: any,
    weekNumber: number,
    index: number,
    weekStart: Date
  ): SimpleEmail {
    const id = `email-w${weekNumber}-${index}`;
    const threadId = raw.threadId || id;

    // Ensure timestamp is during business hours
    const timestamp = this.ensureBusinessHours(new Date(raw.timestamp), weekStart);

    return {
      id,
      threadId,
      from: raw.from,
      to: raw.to,
      cc: raw.cc,
      subject: raw.subject,
      body: raw.body,
      timestamp,
      isImportant: raw.isImportant || false,
      isUrgent: raw.isUrgent || false,
      requiresResponse: raw.requiresResponse || false,
      category: raw.category || 'signal',
      gmailFormat: this.convertToGmailFormat(id, threadId, raw, timestamp)
    };
  }

  /**
   * Convert to Gmail API format
   */
  private convertToGmailFormat(id: string, threadId: string, email: any, timestamp: Date): any {
    const labelIds = email.category === 'signal'
      ? ['INBOX', 'IMPORTANT']
      : ['INBOX'];

    if (email.isUrgent) {
      labelIds.push('STARRED');
    }

    return {
      id,
      threadId,
      labelIds,
      snippet: email.body.substring(0, 100),
      payload: {
        headers: [
          { name: 'From', value: email.from },
          { name: 'To', value: email.to.join(', ') },
          { name: 'Subject', value: email.subject },
          { name: 'Date', value: timestamp.toUTCString() }
        ],
        body: {
          data: Buffer.from(email.body).toString('base64')
        }
      },
      internalDate: timestamp.getTime().toString(),
      metadata: {
        content: {
          body: email.body,
          summary: email.body.substring(0, 200)
        }
      }
    };
  }

  /**
   * Ensure timestamp is during business hours (Mon-Fri, 8am-6pm)
   */
  private ensureBusinessHours(date: Date, weekStart: Date): Date {
    const result = new Date(date);

    // If weekend, move to Monday
    const day = result.getDay();
    if (day === 0) result.setDate(result.getDate() + 1); // Sunday -> Monday
    if (day === 6) result.setDate(result.getDate() + 2); // Saturday -> Monday

    // Ensure within week range
    if (result < weekStart) {
      result.setTime(weekStart.getTime());
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 5); // Friday
    if (result > weekEnd) {
      result.setTime(weekEnd.getTime());
    }

    // Ensure 8am-6pm
    const hour = result.getHours();
    if (hour < 8) result.setHours(8, Math.floor(Math.random() * 60));
    if (hour >= 18) result.setHours(17, Math.floor(Math.random() * 60));

    return result;
  }

  /**
   * Select threads to continue to next week (30% of signal threads)
   */
  private selectThreadsToContinue(week: WeekData): string[] {
    const threads = [...new Set(week.emails.map(e => e.threadId))];
    const signalThreads = threads.filter(tid =>
      week.emails.find(e => e.threadId === tid && e.category === 'signal')
    );

    const count = Math.max(2, Math.floor(signalThreads.length * 0.3));
    return signalThreads
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  }

  /**
   * Clean JSON response from AI (remove markdown code blocks)
   */
  private cleanJSON(response: string): string {
    return response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): SimpleTemplate | undefined {
    const templates: Record<string, SimpleTemplate> = {
      'founder-overwhelmed': {
        name: 'Overwhelmed Founder',
        description: 'Series A founder, everything is urgent, drops balls',
        config: {
          weeks: 6,
          emailsPerWeek: 15,
          urgentRate: 0.35,
          responseRate: 0.60,
          industries: ['SaaS', 'B2B Tech', 'Enterprise Software'],
          painPoints: [
            'Too many commitments',
            'Customer escalations',
            'Investor updates overdue',
            'Hiring urgency',
            'Product roadmap pressure'
          ]
        }
      },
      'vp-sales-busy': {
        name: 'Busy VP Sales',
        description: 'VP Sales managing pipeline, lots of prospects and deals',
        config: {
          weeks: 6,
          emailsPerWeek: 18,
          urgentRate: 0.25,
          responseRate: 0.75,
          industries: ['SaaS', 'Enterprise Software', 'B2B Services'],
          painPoints: [
            'Deal slippage',
            'Quota pressure',
            'Team coordination',
            'Prospect follow-ups',
            'Pipeline management'
          ]
        }
      },
      'eng-manager-organized': {
        name: 'Organized Engineering Manager',
        description: 'Engineering manager, good inbox discipline, technical focus',
        config: {
          weeks: 6,
          emailsPerWeek: 12,
          urgentRate: 0.15,
          responseRate: 0.85,
          industries: ['Tech', 'SaaS', 'Product'],
          painPoints: [
            'Technical debt discussions',
            'Hiring coordination',
            'Cross-team dependencies',
            'Incident response',
            'Architecture decisions'
          ]
        }
      },
      'exec-drowning': {
        name: 'Drowning Executive',
        description: 'C-level exec, completely overwhelmed, 200+ unread',
        config: {
          weeks: 6,
          emailsPerWeek: 20,
          urgentRate: 0.40,
          responseRate: 0.50,
          industries: ['Tech', 'SaaS', 'Startup'],
          painPoints: [
            'Board management',
            'Investor relations',
            'Executive team coordination',
            'Strategic decisions',
            'Crisis management',
            'Too many meetings'
          ]
        }
      }
    };

    return templates[name];
  }

  /**
   * List available templates
   */
  getAvailableTemplates(): string[] {
    return [
      'founder-overwhelmed',
      'vp-sales-busy',
      'eng-manager-organized',
      'exec-drowning'
    ];
  }
}
