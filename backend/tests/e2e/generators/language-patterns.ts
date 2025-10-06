/**
 * Language Patterns
 *
 * Realistic email language templates for generating authentic email content.
 * Includes commitment language, follow-ups, questions, urgency markers, and sentiment variations.
 */

import { Sentiment, FollowUpTone, SenderType, CommitmentType } from '../models/advanced-ground-truth';

/**
 * Email content template
 */
export interface EmailContentTemplate {
  subject: string;
  greeting?: string;
  body: string;
  closing?: string;
  signature?: string;
}

/**
 * Commitment language templates
 */
export const COMMITMENT_TEMPLATES: Record<CommitmentType, string[]> = {
  deliverable: [
    "I'll send {item} by {deadline}",
    "I'll have {item} to you by {deadline}",
    "I'll get {item} over to you {deadline}",
    "I'll deliver {item} by {deadline}",
    "You'll have {item} by {deadline}",
    "I'll make sure you get {item} before {deadline}",
  ],

  response: [
    "I'll get back to you by {deadline}",
    "I'll respond by {deadline}",
    "I'll follow up {deadline}",
    "I'll circle back {deadline}",
    "I'll have an answer for you by {deadline}",
    "I'll let you know by {deadline}",
  ],

  meeting: [
    "I'll schedule a meeting for {deadline}",
    "I'll set up a call {deadline}",
    "I'll get something on the calendar by {deadline}",
    "I'll send you a calendar invite {deadline}",
    "Let me set up a meeting - I'll send options by {deadline}",
  ],

  decision: [
    "I'll make a decision by {deadline}",
    "I'll decide by {deadline}",
    "I'll have an answer on this by {deadline}",
    "I'll get you a final decision by {deadline}",
    "I'll review and decide by {deadline}",
  ],

  none: [],
};

/**
 * Follow-up language by tone
 */
export const FOLLOWUP_LANGUAGE: Record<FollowUpTone, string[]> = {
  polite: [
    "Just following up on my email from {date}",
    "Checking in on this",
    "Wanted to circle back on this",
    "Following up on my previous email",
    "Just wanted to make sure you saw this",
    "Bumping this up in your inbox",
    "Wanted to check if you had a chance to review this",
  ],

  firm: [
    "Following up - I need a response on this",
    "Still need your input on this",
    "This is still outstanding - can you please respond?",
    "I need to hear back on this by {deadline}",
    "Can you please provide an update on this?",
    "I need your decision on this to move forward",
  ],

  frustrated: [
    "Per my last email, I still need this information",
    "I've reached out multiple times about this",
    "Haven't heard back from you on this",
    "Still waiting for a response on this",
    "This has been pending for {days} days",
    "I really need to hear back on this",
    "This is the {iteration} time I'm asking about this",
  ],

  escalating: [
    "Escalating this - I need a response immediately",
    "This is now blocking our team",
    "This has become urgent - need immediate attention",
    "CC'ing {manager} as this is time-sensitive",
    "This is critical and needs your immediate attention",
    "We cannot proceed without this",
    "This is causing significant delays",
  ],
};

/**
 * Question templates by type
 */
export const QUESTION_TEMPLATES = {
  direct: [
    "Can you {action}?",
    "Could you please {action}?",
    "Would you be able to {action}?",
    "Can you help me with {topic}?",
    "Do you have {item}?",
    "What's the status of {topic}?",
  ],

  openEnded: [
    "What are your thoughts on {topic}?",
    "How should we handle {topic}?",
    "What's your take on {topic}?",
    "How do you want to proceed with {topic}?",
    "What's the best approach for {topic}?",
  ],

  yesNo: [
    "Does {statement} work for you?",
    "Are you available for {event}?",
    "Can we {action}?",
    "Is {statement} correct?",
    "Do you agree with {topic}?",
  ],

  status: [
    "What's the status of {topic}?",
    "Where are we on {topic}?",
    "Any update on {topic}?",
    "How's {topic} coming along?",
    "What's the timeline for {topic}?",
  ],
};

/**
 * Urgency indicators
 */
export const URGENCY_MARKERS = {
  subjectLine: [
    "URGENT:",
    "TIME SENSITIVE:",
    "IMPORTANT:",
    "ACTION REQUIRED:",
    "IMMEDIATE ATTENTION:",
  ],

  bodyLanguage: [
    "This is urgent",
    "Need this ASAP",
    "Time-sensitive",
    "Need by EOD",
    "Need by end of day",
    "This is blocking us",
    "This is a blocker",
    "Critical issue",
    "High priority",
    "Top priority",
  ],
};

/**
 * Sentiment-specific language
 */
export const SENTIMENT_LANGUAGE: Record<Sentiment, string[]> = {
  neutral: [
    "Hope this email finds you well",
    "I wanted to reach out about {topic}",
    "I'm writing regarding {topic}",
    "Quick question about {topic}",
    "Following up on {topic}",
  ],

  positive: [
    "Thanks so much for your help with this!",
    "Really appreciate your quick response",
    "This is great, thank you!",
    "Excited to work on this together",
    "Looking forward to hearing from you",
  ],

  frustrated: [
    "I've been waiting for {duration} on this",
    "This is the {iteration} time I'm following up",
    "I'm concerned about the delay",
    "This is taking longer than expected",
    "I need this resolved soon",
  ],

  urgent: [
    "This is urgent - need immediate attention",
    "Critical issue that needs addressing now",
    "This cannot wait",
    "Need this resolved immediately",
    "Time-sensitive situation",
  ],

  angry: [
    "This is unacceptable",
    "I'm extremely disappointed",
    "This is not what we agreed to",
    "This level of service is completely inadequate",
    "I expect better than this",
    "This needs to be fixed immediately or we'll need to reconsider our partnership",
  ],
};

/**
 * Action request patterns
 */
export const ACTION_REQUESTS = [
  "Please {action}",
  "Could you please {action}",
  "I need you to {action}",
  "Can you {action}",
  "Would you be able to {action}",
  "It would be great if you could {action}",
  "I'd appreciate if you could {action}",
];

/**
 * Sender-specific language patterns
 */
export const SENDER_LANGUAGE: Record<SenderType, {
  greetings: string[];
  closings: string[];
  style: 'formal' | 'casual' | 'direct';
}> = {
  boss: {
    greetings: ['Hi', 'Hey', 'Good morning', ''],
    closings: ['Thanks', 'Best', 'Regards', ''],
    style: 'direct',
  },

  report: {
    greetings: ['Hi', 'Hey', 'Good morning'],
    closings: ['Thanks', 'Best', 'Let me know if you have questions'],
    style: 'casual',
  },

  peer: {
    greetings: ['Hi', 'Hey', 'Yo'],
    closings: ['Thanks', 'Cheers', 'Best'],
    style: 'casual',
  },

  customer: {
    greetings: ['Hi', 'Hello', 'Good morning'],
    closings: ['Best regards', 'Thank you', 'Regards', 'Looking forward to hearing from you'],
    style: 'formal',
  },

  vendor: {
    greetings: ['Hello', 'Hi'],
    closings: ['Best regards', 'Thank you', 'Sincerely'],
    style: 'formal',
  },

  investor: {
    greetings: ['Hi', 'Hello'],
    closings: ['Best', 'Regards', 'Looking forward to connecting'],
    style: 'formal',
  },

  external: {
    greetings: ['Hello', 'Hi'],
    closings: ['Best regards', 'Thank you', 'Regards'],
    style: 'formal',
  },

  recruiter: {
    greetings: ['Hi', 'Hello'],
    closings: ['Best', 'Looking forward to connecting', 'Happy to chat further'],
    style: 'formal',
  },

  spam: {
    greetings: ['Hello', 'Hi there', 'Greetings'],
    closings: ['Best', 'Regards', 'Have a great day!'],
    style: 'formal',
  },
};

/**
 * Generate commitment text
 */
export function generateCommitment(
  type: CommitmentType,
  item: string,
  deadline: string
): string {
  if (type === 'none') return '';

  const templates = COMMITMENT_TEMPLATES[type];
  const template = templates[Math.floor(Math.random() * templates.length)];

  return template
    .replace('{item}', item)
    .replace('{deadline}', deadline);
}

/**
 * Generate follow-up text
 */
export function generateFollowUp(
  tone: FollowUpTone,
  options: {
    date?: string;
    deadline?: string;
    days?: number;
    iteration?: number;
    manager?: string;
  } = {}
): string {
  const templates = FOLLOWUP_LANGUAGE[tone];
  let template = templates[Math.floor(Math.random() * templates.length)];

  template = template
    .replace('{date}', options.date || 'last week')
    .replace('{deadline}', options.deadline || 'EOD')
    .replace('{days}', String(options.days || 5))
    .replace('{iteration}', String(options.iteration || 2))
    .replace('{manager}', options.manager || 'management');

  return template;
}

/**
 * Generate question
 */
export function generateQuestion(
  type: keyof typeof QUESTION_TEMPLATES,
  topic: string
): string {
  const templates = QUESTION_TEMPLATES[type];
  let template = templates[Math.floor(Math.random() * templates.length)];

  template = template
    .replace('{action}', topic)
    .replace('{topic}', topic)
    .replace('{item}', topic)
    .replace('{statement}', topic)
    .replace('{event}', topic);

  return template;
}

/**
 * Generate email content from components
 */
export function generateEmailContent(options: {
  senderType: SenderType;
  sentiment: Sentiment;
  includeCommitment?: { type: CommitmentType; item: string; deadline: string };
  includeFollowUp?: { tone: FollowUpTone; iteration: number };
  includeQuestion?: { type: keyof typeof QUESTION_TEMPLATES; topic: string };
  includeUrgency?: boolean;
  mainTopic: string;
  context?: string;
}): EmailContentTemplate {
  const senderStyle = SENDER_LANGUAGE[options.senderType];

  // Greeting
  const greetings = senderStyle.greetings;
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  // Closing
  const closings = senderStyle.closings;
  const closing = closings[Math.floor(Math.random() * closings.length)];

  // Build body
  const bodyParts: string[] = [];

  // Sentiment opener
  const sentimentPhrases = SENTIMENT_LANGUAGE[options.sentiment];
  const opener = sentimentPhrases[Math.floor(Math.random() * sentimentPhrases.length)]
    .replace('{topic}', options.mainTopic)
    .replace('{duration}', '3 days')
    .replace('{iteration}', String(options.includeFollowUp?.iteration || 2));
  bodyParts.push(opener);

  // Follow-up (if applicable)
  if (options.includeFollowUp) {
    const followUpText = generateFollowUp(options.includeFollowUp.tone, {
      iteration: options.includeFollowUp.iteration,
    });
    bodyParts.push(followUpText);
  }

  // Main content
  if (options.context) {
    bodyParts.push(options.context);
  } else {
    bodyParts.push(`Regarding ${options.mainTopic}.`);
  }

  // Question (if applicable)
  if (options.includeQuestion) {
    const question = generateQuestion(options.includeQuestion.type, options.includeQuestion.topic);
    bodyParts.push(question);
  }

  // Urgency marker (if applicable)
  if (options.includeUrgency) {
    const urgencyMarkers = URGENCY_MARKERS.bodyLanguage;
    const marker = urgencyMarkers[Math.floor(Math.random() * urgencyMarkers.length)];
    bodyParts.push(marker + '.');
  }

  // Commitment (if applicable)
  if (options.includeCommitment && options.includeCommitment.type !== 'none') {
    const commitment = generateCommitment(
      options.includeCommitment.type,
      options.includeCommitment.item,
      options.includeCommitment.deadline
    );
    bodyParts.push(commitment + '.');
  }

  // Generate subject
  let subject = options.mainTopic;
  if (options.includeUrgency && Math.random() > 0.5) {
    const urgencyPrefix = URGENCY_MARKERS.subjectLine[
      Math.floor(Math.random() * URGENCY_MARKERS.subjectLine.length)
    ];
    subject = `${urgencyPrefix} ${subject}`;
  }
  if (options.includeFollowUp && options.includeFollowUp.iteration > 1) {
    subject = `Re: ${subject}`;
  }

  return {
    subject,
    greeting: greeting ? `${greeting},` : '',
    body: bodyParts.join('\n\n'),
    closing: closing ? `${closing},` : '',
  };
}

/**
 * Format email content as full email text
 */
export function formatEmailText(
  content: EmailContentTemplate,
  senderName: string
): string {
  const parts: string[] = [];

  if (content.greeting) {
    parts.push(content.greeting);
    parts.push('');
  }

  parts.push(content.body);
  parts.push('');

  if (content.closing) {
    parts.push(content.closing);
  }

  if (content.signature || senderName) {
    parts.push(senderName);
  }

  return parts.join('\n');
}

/**
 * Common email scenarios
 */
export const EMAIL_SCENARIOS = {
  // Customer reporting production issue
  customerProductionIssue: (customerName: string): EmailContentTemplate => ({
    subject: 'URGENT: Production Issue - Users Cannot Login',
    greeting: 'Hi,',
    body: `We're experiencing a critical issue in production. Our users (approximately 500 active users) cannot log in to the platform. This started about an hour ago and is severely impacting our business.

Can you please investigate immediately and provide an ETA for resolution?`,
    closing: 'Urgent regards,',
  }),

  // Boss asking for status
  bossStatusRequest: (topic: string): EmailContentTemplate => ({
    subject: `Status update on ${topic}`,
    greeting: 'Hey,',
    body: `What's the status of ${topic}? I need to update the exec team this afternoon.`,
    closing: 'Thanks,',
  }),

  // Investor follow-up
  investorFollowUp: (iteration: number): EmailContentTemplate => {
    const subjects = [
      'Great to meet - next steps',
      'Re: Great to meet - next steps',
      'Re: Great to meet - next steps (2nd reminder)',
    ];
    const bodies = [
      'Great to meet with you last week. When would be a good time to schedule a follow-up call to discuss the Series B?',
      'Following up on my email from last week. We are moving quickly on this and would love to get something scheduled. Are you available this week?',
      '2nd reminder on this. Our partnership committee meets Monday and we need your deck by then. Are you still interested in pursuing this?',
    ];

    return {
      subject: subjects[Math.min(iteration, 2)],
      greeting: 'Hi,',
      body: bodies[Math.min(iteration, 2)],
      closing: 'Best,',
    };
  },

  // Newsletter spam
  newsletterSpam: (topic: string): EmailContentTemplate => ({
    subject: `ACTION REQUIRED: New ${topic} Regulations`,
    greeting: 'Dear Valued Customer,',
    body: `Important compliance updates for ${topic} require your immediate attention. Click here to learn more about the new regulations affecting your industry.

Don't miss out on this critical information!`,
    closing: 'Best regards,',
  }),
};
