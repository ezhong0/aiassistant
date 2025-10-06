/**
 * Relationship Graph System
 *
 * Models realistic sender hierarchies, email frequency patterns, and relationship dynamics.
 * Used to generate hyper-realistic inbox scenarios with proper sender importance weighting.
 */

import { SenderType, EmailFrequency } from '../models/advanced-ground-truth';

/**
 * Sender profile with relationship metadata
 */
export interface SenderProfile {
  email: string;
  name: string;
  type: SenderType;
  importance: number; // 1-10 (10 = most important)
  emailFrequency: EmailFrequency;
  typicalResponseTime: number; // hours
  isVIP: boolean;

  // Relationship history
  totalEmailsSent: number;
  totalEmailsReceived: number;
  unansweredCount: number;
  lastEmailDate?: Date;
  averageResponseTimeFromUser: number; // hours

  // Behavioral patterns
  likelyToFollowUp: boolean;
  followUpCadence: number; // days between follow-ups
  escalatesQuickly: boolean;
  sendsAfterHours: boolean;
}

/**
 * Relationship graph containing all sender profiles
 */
export interface RelationshipGraph {
  senders: Map<string, SenderProfile>;
  userEmail: string;

  // Statistics
  totalSenders: number;
  vipCount: number;
  bossCount: number;
  customerCount: number;
}

/**
 * Sender preset templates for common personas
 */
export const SENDER_PRESETS = {
  // Boss/Manager (high importance, expects fast responses)
  directBoss: {
    type: 'boss' as SenderType,
    importance: 9,
    emailFrequency: 'daily' as EmailFrequency,
    typicalResponseTime: 2, // expects response within 2 hours
    isVIP: true,
    likelyToFollowUp: true,
    followUpCadence: 1, // follows up after 1 day
    escalatesQuickly: true,
    sendsAfterHours: true,
  },

  // VP/Senior Leadership (very high importance)
  seniorLeadership: {
    type: 'boss' as SenderType,
    importance: 10,
    emailFrequency: 'weekly' as EmailFrequency,
    typicalResponseTime: 4, // expects response within 4 hours
    isVIP: true,
    likelyToFollowUp: false, // too busy to follow up often
    followUpCadence: 3,
    escalatesQuickly: false,
    sendsAfterHours: true,
  },

  // Direct Report (medium importance, you drive cadence)
  directReport: {
    type: 'report' as SenderType,
    importance: 6,
    emailFrequency: 'daily' as EmailFrequency,
    typicalResponseTime: 24, // they can wait a day
    isVIP: false,
    likelyToFollowUp: false, // waits for you
    followUpCadence: 7,
    escalatesQuickly: false,
    sendsAfterHours: false,
  },

  // Enterprise Customer (high importance, revenue impact)
  enterpriseCustomer: {
    type: 'customer' as SenderType,
    importance: 9,
    emailFrequency: 'weekly' as EmailFrequency,
    typicalResponseTime: 4, // SLA: respond within 4 hours
    isVIP: true,
    likelyToFollowUp: true,
    followUpCadence: 2,
    escalatesQuickly: true,
    sendsAfterHours: false,
  },

  // SMB Customer (medium importance)
  smbCustomer: {
    type: 'customer' as SenderType,
    importance: 7,
    emailFrequency: 'monthly' as EmailFrequency,
    typicalResponseTime: 24, // SLA: respond within 24 hours
    isVIP: false,
    likelyToFollowUp: true,
    followUpCadence: 3,
    escalatesQuickly: false,
    sendsAfterHours: false,
  },

  // Investor (very high importance, time-sensitive)
  investor: {
    type: 'investor' as SenderType,
    importance: 10,
    emailFrequency: 'monthly' as EmailFrequency,
    typicalResponseTime: 12, // respond same day
    isVIP: true,
    likelyToFollowUp: true,
    followUpCadence: 3,
    escalatesQuickly: true, // escalates to partners quickly
    sendsAfterHours: true,
  },

  // Peer/Colleague (medium importance)
  peer: {
    type: 'peer' as SenderType,
    importance: 5,
    emailFrequency: 'weekly' as EmailFrequency,
    typicalResponseTime: 48, // 2 days is ok
    isVIP: false,
    likelyToFollowUp: false,
    followUpCadence: 5,
    escalatesQuickly: false,
    sendsAfterHours: false,
  },

  // Vendor/Partner (low-medium importance)
  vendor: {
    type: 'vendor' as SenderType,
    importance: 4,
    emailFrequency: 'monthly' as EmailFrequency,
    typicalResponseTime: 72, // 3 days
    isVIP: false,
    likelyToFollowUp: true,
    followUpCadence: 7,
    escalatesQuickly: false,
    sendsAfterHours: false,
  },

  // External Contact (low importance unless specific context)
  external: {
    type: 'external' as SenderType,
    importance: 3,
    emailFrequency: 'rare' as EmailFrequency,
    typicalResponseTime: 168, // 1 week
    isVIP: false,
    likelyToFollowUp: false,
    followUpCadence: 14,
    escalatesQuickly: false,
    sendsAfterHours: false,
  },

  // First-time Contact (unknown importance)
  firstTime: {
    type: 'external' as SenderType,
    importance: 3,
    emailFrequency: 'first' as EmailFrequency,
    typicalResponseTime: 168, // 1 week
    isVIP: false,
    likelyToFollowUp: true, // often follow up if you don't respond
    followUpCadence: 7,
    escalatesQuickly: false,
    sendsAfterHours: false,
  },

  // Spam/Marketing (no importance)
  spam: {
    type: 'spam' as SenderType,
    importance: 1,
    emailFrequency: 'rare' as EmailFrequency,
    typicalResponseTime: 0, // never respond
    isVIP: false,
    likelyToFollowUp: true, // spammers always follow up
    followUpCadence: 3,
    escalatesQuickly: false,
    sendsAfterHours: true,
  },
};

/**
 * Generate realistic sender profile
 */
export function generateSenderProfile(
  name: string,
  email: string,
  preset: keyof typeof SENDER_PRESETS,
  overrides: Partial<SenderProfile> = {}
): SenderProfile {
  const presetData = SENDER_PRESETS[preset];

  return {
    email,
    name,
    type: presetData.type,
    importance: presetData.importance,
    emailFrequency: presetData.emailFrequency,
    typicalResponseTime: presetData.typicalResponseTime,
    isVIP: presetData.isVIP,
    totalEmailsSent: 0,
    totalEmailsReceived: 0,
    unansweredCount: 0,
    averageResponseTimeFromUser: presetData.typicalResponseTime * 1.5,
    likelyToFollowUp: presetData.likelyToFollowUp,
    followUpCadence: presetData.followUpCadence,
    escalatesQuickly: presetData.escalatesQuickly,
    sendsAfterHours: presetData.sendsAfterHours,
    ...overrides,
  };
}

/**
 * Build a realistic relationship graph for a user persona
 */
export function buildRelationshipGraph(userEmail: string, persona: 'executive' | 'founder' | 'manager' | 'individual'): RelationshipGraph {
  const senders = new Map<string, SenderProfile>();

  if (persona === 'founder') {
    // Founder persona: lots of high-importance contacts

    // Board members & investors (2-3)
    senders.set('schen@greylock.com', generateSenderProfile(
      'Sarah Chen',
      'schen@greylock.com',
      'seniorLeadership',
      { totalEmailsSent: 15, totalEmailsReceived: 12 }
    ));

    senders.set('mroberts@sequoiacap.com', generateSenderProfile(
      'Michael Roberts',
      'mroberts@sequoiacap.com',
      'investor',
      { totalEmailsSent: 8, totalEmailsReceived: 6 }
    ));

    senders.set('jwu@a16z.com', generateSenderProfile(
      'Jennifer Wu',
      'jwu@a16z.com',
      'investor',
      { totalEmailsSent: 5, totalEmailsReceived: 3 }
    ));

    // Direct reports (3-5 key people)
    senders.set('dpark@acme.com', generateSenderProfile(
      'David Park',
      'dpark@acme.com',
      'directReport',
      { importance: 8, totalEmailsSent: 45, totalEmailsReceived: 50, isVIP: true }
    ));

    senders.set('atorres@acme.com', generateSenderProfile(
      'Amanda Torres',
      'atorres@acme.com',
      'directReport',
      { importance: 8, totalEmailsSent: 35, totalEmailsReceived: 38, isVIP: true }
    ));

    senders.set('jkim@acme.com', generateSenderProfile(
      'James Kim',
      'jkim@acme.com',
      'directReport',
      { importance: 7, totalEmailsSent: 30, totalEmailsReceived: 32 }
    ));

    // Enterprise customers (2-3)
    senders.set('randerson@stripe.com', generateSenderProfile(
      'Robert Anderson',
      'randerson@stripe.com',
      'enterpriseCustomer',
      { totalEmailsSent: 12, totalEmailsReceived: 14 }
    ));

    senders.set('lthompson@databricks.com', generateSenderProfile(
      'Lisa Thompson',
      'lthompson@databricks.com',
      'enterpriseCustomer',
      { totalEmailsSent: 8, totalEmailsReceived: 10 }
    ));

    // SMB customers (3-5)
    senders.set('mjohnson@vanta.com', generateSenderProfile(
      'Mark Johnson',
      'mjohnson@vanta.com',
      'smbCustomer',
      { totalEmailsSent: 6, totalEmailsReceived: 7 }
    ));

    senders.set('edavis@notion.so', generateSenderProfile(
      'Emily Davis',
      'edavis@notion.so',
      'smbCustomer',
      { totalEmailsSent: 4, totalEmailsReceived: 5 }
    ));

    // Vendors/Partners (2-3)
    senders.set('cmartinez@amazon.com', generateSenderProfile(
      'Chris Martinez',
      'cmartinez@amazon.com',
      'vendor',
      { totalEmailsSent: 10, totalEmailsReceived: 8 }
    ));

    // External contacts (recruiters, sales, etc.) (3-5)
    senders.set('smitchell@linkedin.com', generateSenderProfile(
      'Sarah Mitchell',
      'smitchell@linkedin.com',
      'external',
      { totalEmailsSent: 3, totalEmailsReceived: 0 }
    ));

    senders.set('jpatterson@hubspot.com', generateSenderProfile(
      'John Patterson',
      'jpatterson@hubspot.com',
      'spam',
      { totalEmailsSent: 5, totalEmailsReceived: 0 }
    ));

    // First-time contacts (1-2)
    senders.set('aparker@benchmark.com', generateSenderProfile(
      'Alex Parker',
      'aparker@benchmark.com',
      'firstTime',
      { totalEmailsSent: 1, totalEmailsReceived: 0 }
    ));

  } else if (persona === 'executive') {
    // Executive persona: boss, peers, direct reports

    // CEO/Boss
    senders.set('jlawrence@acme.com', generateSenderProfile(
      'Jennifer Lawrence',
      'jlawrence@acme.com',
      'directBoss',
      { totalEmailsSent: 25, totalEmailsReceived: 23, importance: 10 }
    ));

    // Peer executives (2-3)
    senders.set('mchen@acme.com', generateSenderProfile(
      'Michael Chen',
      'mchen@acme.com',
      'peer',
      { importance: 7, totalEmailsSent: 15, totalEmailsReceived: 16, isVIP: true }
    ));

    senders.set('spatel@acme.com', generateSenderProfile(
      'Sarah Patel',
      'spatel@acme.com',
      'peer',
      { importance: 7, totalEmailsSent: 12, totalEmailsReceived: 13, isVIP: true }
    ));

    // Direct reports (4-6)
    senders.set('tharris@acme.com', generateSenderProfile(
      'Tom Harris',
      'tharris@acme.com',
      'directReport',
      { totalEmailsSent: 40, totalEmailsReceived: 45 }
    ));

    senders.set('lwang@acme.com', generateSenderProfile(
      'Lisa Wang',
      'lwang@acme.com',
      'directReport',
      { totalEmailsSent: 35, totalEmailsReceived: 38 }
    ));

    // Customers (1-2)
    senders.set('djones@salesforce.com', generateSenderProfile(
      'David Jones',
      'djones@salesforce.com',
      'enterpriseCustomer',
      { totalEmailsSent: 8, totalEmailsReceived: 10 }
    ));

  } else if (persona === 'manager') {
    // Manager persona: boss, peers, direct reports

    // Direct boss
    senders.set('sdirector@acme.com', generateSenderProfile(
      'Susan Director',
      'sdirector@acme.com',
      'directBoss',
      { totalEmailsSent: 30, totalEmailsReceived: 28 }
    ));

    // Peers (3-4)
    senders.set('jwilliams@acme.com', generateSenderProfile(
      'John Williams',
      'jwilliams@acme.com',
      'peer',
      { totalEmailsSent: 20, totalEmailsReceived: 22 }
    ));

    senders.set('erodriguez@acme.com', generateSenderProfile(
      'Emma Rodriguez',
      'erodriguez@acme.com',
      'peer',
      { totalEmailsSent: 15, totalEmailsReceived: 16 }
    ));

    // Direct reports (4-6)
    senders.set('agarcia@acme.com', generateSenderProfile(
      'Alex Garcia',
      'agarcia@acme.com',
      'directReport',
      { totalEmailsSent: 50, totalEmailsReceived: 55 }
    ));

    senders.set('mlopez@acme.com', generateSenderProfile(
      'Maria Lopez',
      'mlopez@acme.com',
      'directReport',
      { totalEmailsSent: 45, totalEmailsReceived: 48 }
    ));

    senders.set('ctaylor@acme.com', generateSenderProfile(
      'Chris Taylor',
      'ctaylor@acme.com',
      'directReport',
      { totalEmailsSent: 40, totalEmailsReceived: 42 }
    ));

  } else {
    // Individual contributor persona

    // Direct boss
    senders.set('rchen@acme.com', generateSenderProfile(
      'Rachel Chen',
      'rchen@acme.com',
      'directBoss',
      { totalEmailsSent: 35, totalEmailsReceived: 32 }
    ));

    // Peers (4-5)
    senders.set('knguyen@acme.com', generateSenderProfile(
      'Kevin Nguyen',
      'knguyen@acme.com',
      'peer',
      { totalEmailsSent: 25, totalEmailsReceived: 26 }
    ));

    senders.set('ppatel@acme.com', generateSenderProfile(
      'Priya Patel',
      'ppatel@acme.com',
      'peer',
      { totalEmailsSent: 20, totalEmailsReceived: 21 }
    ));
  }

  // Calculate statistics
  let vipCount = 0;
  let bossCount = 0;
  let customerCount = 0;

  for (const sender of senders.values()) {
    if (sender.isVIP) vipCount++;
    if (sender.type === 'boss') bossCount++;
    if (sender.type === 'customer') customerCount++;
  }

  return {
    senders,
    userEmail,
    totalSenders: senders.size,
    vipCount,
    bossCount,
    customerCount,
  };
}

/**
 * Get sender profile from graph
 */
export function getSenderProfile(
  graph: RelationshipGraph,
  email: string
): SenderProfile | undefined {
  return graph.senders.get(email);
}

/**
 * Get all senders of a specific type
 */
export function getSendersByType(
  graph: RelationshipGraph,
  type: SenderType
): SenderProfile[] {
  return Array.from(graph.senders.values()).filter(s => s.type === type);
}

/**
 * Get VIP senders
 */
export function getVIPSenders(graph: RelationshipGraph): SenderProfile[] {
  return Array.from(graph.senders.values()).filter(s => s.isVIP);
}

/**
 * Get senders by importance threshold
 */
export function getHighImportanceSenders(
  graph: RelationshipGraph,
  minImportance: number = 7
): SenderProfile[] {
  return Array.from(graph.senders.values())
    .filter(s => s.importance >= minImportance)
    .sort((a, b) => b.importance - a.importance);
}

/**
 * Update sender email count (for tracking)
 */
export function recordEmailSent(
  graph: RelationshipGraph,
  senderEmail: string
): void {
  const sender = graph.senders.get(senderEmail);
  if (sender) {
    sender.totalEmailsSent++;
    sender.lastEmailDate = new Date();
  }
}

/**
 * Update user response (for tracking)
 */
export function recordUserResponse(
  graph: RelationshipGraph,
  senderEmail: string,
  responseTimeHours: number
): void {
  const sender = graph.senders.get(senderEmail);
  if (sender) {
    sender.totalEmailsReceived++;
    // Update running average
    const totalResponses = sender.totalEmailsReceived;
    sender.averageResponseTimeFromUser =
      ((sender.averageResponseTimeFromUser * (totalResponses - 1)) + responseTimeHours) / totalResponses;
  }
}

/**
 * Check if sender should follow up based on behavior
 */
export function shouldSenderFollowUp(
  sender: SenderProfile,
  daysSinceLastEmail: number
): boolean {
  if (!sender.likelyToFollowUp) {
    return false;
  }

  return daysSinceLastEmail >= sender.followUpCadence;
}

/**
 * Check if sender should escalate
 */
export function shouldSenderEscalate(
  sender: SenderProfile,
  followUpCount: number
): boolean {
  if (!sender.escalatesQuickly) {
    return followUpCount >= 3; // Only escalate after many follow-ups
  }

  return followUpCount >= 2; // Escalate faster for impatient senders
}
