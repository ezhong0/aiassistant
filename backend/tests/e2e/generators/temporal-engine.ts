/**
 * Temporal Engine
 *
 * Handles time-aware email generation and urgency calculations.
 * Models how emails age, deadlines approach, and urgency evolves over time.
 */

import { UrgencyType } from '../models/advanced-ground-truth';

/**
 * Temporal context for an email
 */
export interface TemporalContext {
  sentTimestamp: Date;
  currentTimestamp: Date; // "now" in the test scenario
  ageInDays: number;
  ageInHours: number;

  // Deadline tracking
  hasDeadline: boolean;
  deadlineDate?: Date;
  daysUntilDeadline?: number;
  hoursUntilDeadline?: number;
  isOverdue: boolean;

  // Urgency evolution
  urgencyType: UrgencyType;
  wasUrgentAtSend: boolean;
  isUrgentNow: boolean;
  becameUrgentAt?: Date;

  // Time-based metadata
  isBusinessHours: boolean; // sent during business hours
  isWeekend: boolean;
  isAfterHours: boolean; // sent late night/early morning
}

/**
 * Deadline specification
 */
export interface DeadlineSpec {
  type: 'absolute' | 'relative';
  date?: Date; // for absolute deadlines
  daysFromSend?: number; // for relative deadlines
  hoursFromSend?: number; // for relative deadlines
  description?: string; // "EOD Friday", "by next week", etc.
}

/**
 * Urgency evolution rules
 */
export interface UrgencyEvolutionRule {
  // When does this email become urgent?
  becomeUrgentWhen:
    | { type: 'immediately' }
    | { type: 'deadline_approaching'; daysBeforeDeadline: number }
    | { type: 'no_response_after'; days: number }
    | { type: 'never' };

  // Is urgency time-sensitive?
  decaysOverTime: boolean;

  // Custom urgency calculation
  calculateUrgency?: (context: TemporalContext) => boolean;
}

/**
 * Calculate temporal context for an email
 */
export function calculateTemporalContext(
  sentDate: Date,
  currentDate: Date = new Date(),
  deadline?: DeadlineSpec,
  urgencyRule?: UrgencyEvolutionRule
): TemporalContext {
  // Calculate age
  const ageMs = currentDate.getTime() - sentDate.getTime();
  const ageInHours = ageMs / (1000 * 60 * 60);
  const ageInDays = ageMs / (1000 * 60 * 60 * 24);

  // Calculate deadline info
  let hasDeadline = false;
  let deadlineDate: Date | undefined;
  let daysUntilDeadline: number | undefined;
  let hoursUntilDeadline: number | undefined;
  let isOverdue = false;

  if (deadline) {
    hasDeadline = true;

    if (deadline.type === 'absolute' && deadline.date) {
      deadlineDate = deadline.date;
    } else if (deadline.type === 'relative') {
      deadlineDate = new Date(sentDate);
      if (deadline.daysFromSend) {
        deadlineDate.setDate(deadlineDate.getDate() + deadline.daysFromSend);
      }
      if (deadline.hoursFromSend) {
        deadlineDate.setHours(deadlineDate.getHours() + deadline.hoursFromSend);
      }
    }

    if (deadlineDate) {
      const deadlineMs = deadlineDate.getTime() - currentDate.getTime();
      hoursUntilDeadline = deadlineMs / (1000 * 60 * 60);
      daysUntilDeadline = deadlineMs / (1000 * 60 * 60 * 24);
      isOverdue = deadlineMs < 0;
    }
  }

  // Calculate urgency evolution
  let urgencyType: UrgencyType = 'never';
  let wasUrgentAtSend = false;
  let isUrgentNow = false;
  let becameUrgentAt: Date | undefined;

  if (urgencyRule) {
    const rule = urgencyRule.becomeUrgentWhen;

    if (rule.type === 'immediately') {
      urgencyType = 'always';
      wasUrgentAtSend = true;
      isUrgentNow = !urgencyRule.decaysOverTime || ageInDays < 7;
    } else if (rule.type === 'deadline_approaching' && deadlineDate) {
      urgencyType = 'deadline_approaching';
      const daysBeforeDeadline = rule.daysBeforeDeadline;

      // Calculate when it became urgent
      becameUrgentAt = new Date(deadlineDate);
      becameUrgentAt.setDate(becameUrgentAt.getDate() - daysBeforeDeadline);

      wasUrgentAtSend = sentDate >= becameUrgentAt;
      isUrgentNow = currentDate >= becameUrgentAt && !isOverdue;

      // If overdue, it's VERY urgent
      if (isOverdue) {
        urgencyType = 'always';
        isUrgentNow = true;
      }
    } else if (rule.type === 'no_response_after') {
      if (ageInDays >= rule.days) {
        urgencyType = 'became_urgent';
        becameUrgentAt = new Date(sentDate);
        becameUrgentAt.setDate(becameUrgentAt.getDate() + rule.days);
        wasUrgentAtSend = false;
        isUrgentNow = true;
      } else {
        urgencyType = 'never';
        isUrgentNow = false;
      }
    } else if (rule.type === 'never') {
      urgencyType = 'never';
      isUrgentNow = false;
    }

    // Custom calculation override
    if (urgencyRule.calculateUrgency) {
      isUrgentNow = urgencyRule.calculateUrgency({
        sentTimestamp: sentDate,
        currentTimestamp: currentDate,
        ageInDays,
        ageInHours,
        hasDeadline,
        deadlineDate,
        daysUntilDeadline,
        hoursUntilDeadline,
        isOverdue,
        urgencyType,
        wasUrgentAtSend,
        isUrgentNow,
        becameUrgentAt,
        isBusinessHours: isBusinessHours(sentDate),
        isWeekend: isWeekend(sentDate),
        isAfterHours: isAfterHours(sentDate),
      });
    }
  }

  return {
    sentTimestamp: sentDate,
    currentTimestamp: currentDate,
    ageInDays,
    ageInHours,
    hasDeadline,
    deadlineDate,
    daysUntilDeadline,
    hoursUntilDeadline,
    isOverdue,
    urgencyType,
    wasUrgentAtSend,
    isUrgentNow,
    becameUrgentAt,
    isBusinessHours: isBusinessHours(sentDate),
    isWeekend: isWeekend(sentDate),
    isAfterHours: isAfterHours(sentDate),
  };
}

/**
 * Check if timestamp is during business hours (9am-6pm local time)
 */
export function isBusinessHours(date: Date): boolean {
  const hour = date.getHours();
  const day = date.getDay();

  // Monday-Friday, 9am-6pm
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
}

/**
 * Check if timestamp is on weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Check if timestamp is after hours (before 7am or after 10pm)
 */
export function isAfterHours(date: Date): boolean {
  const hour = date.getHours();
  return hour < 7 || hour >= 22;
}

/**
 * Generate timestamp for N days ago
 */
export function daysAgo(days: number, referenceDate: Date = new Date()): Date {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Generate timestamp for N hours ago
 */
export function hoursAgo(hours: number, referenceDate: Date = new Date()): Date {
  const date = new Date(referenceDate);
  date.setHours(date.getHours() - hours);
  return date;
}

/**
 * Generate timestamp for N days from now
 */
export function daysFromNow(days: number, referenceDate: Date = new Date()): Date {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Generate timestamp for next business day at specific hour
 */
export function nextBusinessDay(referenceDate: Date = new Date(), hour: number = 9): Date {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() + 1);

  // Skip to Monday if weekend
  while (isWeekend(date)) {
    date.setDate(date.getDate() + 1);
  }

  date.setHours(hour, 0, 0, 0);
  return date;
}

/**
 * Generate timestamp for end of day (5pm)
 */
export function endOfDay(date: Date): Date {
  const eod = new Date(date);
  eod.setHours(17, 0, 0, 0);
  return eod;
}

/**
 * Generate timestamp for end of week (Friday 5pm)
 */
export function endOfWeek(referenceDate: Date = new Date()): Date {
  const date = new Date(referenceDate);
  const daysUntilFriday = (5 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysUntilFriday);
  return endOfDay(date);
}

/**
 * Common deadline presets
 */
export const DEADLINE_PRESETS = {
  // Urgent deadlines (today)
  endOfToday: (): DeadlineSpec => ({
    type: 'relative',
    hoursFromSend: 8,
    description: 'EOD today',
  }),

  // Short deadlines (1-3 days)
  tomorrow: (): DeadlineSpec => ({
    type: 'relative',
    daysFromSend: 1,
    description: 'tomorrow',
  }),

  endOfWeek: (): DeadlineSpec => ({
    type: 'relative',
    daysFromSend: 5,
    description: 'EOD Friday',
  }),

  // Medium deadlines (1-2 weeks)
  nextWeek: (): DeadlineSpec => ({
    type: 'relative',
    daysFromSend: 7,
    description: 'next week',
  }),

  twoWeeks: (): DeadlineSpec => ({
    type: 'relative',
    daysFromSend: 14,
    description: 'in two weeks',
  }),

  // Long deadlines (month+)
  nextMonth: (): DeadlineSpec => ({
    type: 'relative',
    daysFromSend: 30,
    description: 'next month',
  }),
};

/**
 * Common urgency evolution rules
 */
export const URGENCY_RULES = {
  // Always urgent (production issue, emergency)
  alwaysUrgent: {
    becomeUrgentWhen: { type: 'immediately' as const },
    decaysOverTime: false,
  },

  // Becomes urgent as deadline approaches
  deadlineApproaching: (daysBeforeDeadline: number = 2): UrgencyEvolutionRule => ({
    becomeUrgentWhen: {
      type: 'deadline_approaching',
      daysBeforeDeadline,
    },
    decaysOverTime: false,
  }),

  // Becomes urgent if no response after N days
  noResponseUrgent: (days: number = 3): UrgencyEvolutionRule => ({
    becomeUrgentWhen: {
      type: 'no_response_after',
      days,
    },
    decaysOverTime: false,
  }),

  // Never urgent
  neverUrgent: {
    becomeUrgentWhen: { type: 'never' as const },
    decaysOverTime: false,
  },

  // Urgent but decays over time (news, time-sensitive info)
  urgentButDecays: {
    becomeUrgentWhen: { type: 'immediately' as const },
    decaysOverTime: true,
  },
};

/**
 * Calculate time-decay priority
 * Returns 1-10 based on age and urgency rules
 */
export function calculateTimeDecayPriority(
  context: TemporalContext,
  baseImportance: number
): number {
  let priority = baseImportance;

  // Overdue items get huge boost
  if (context.isOverdue) {
    priority += 4;
  }
  // Deadline approaching
  else if (context.daysUntilDeadline !== undefined) {
    if (context.daysUntilDeadline < 1) {
      priority += 3; // Less than 1 day
    } else if (context.daysUntilDeadline < 2) {
      priority += 2; // Less than 2 days
    } else if (context.daysUntilDeadline < 7) {
      priority += 1; // Less than a week
    }
  }

  // Age penalties for non-urgent items
  if (!context.isUrgentNow) {
    if (context.ageInDays > 7) {
      priority -= 1; // Old emails lose priority
    }
  }

  // Age boosts for urgent items (dropped balls get worse over time)
  if (context.isUrgentNow && context.urgencyType === 'became_urgent') {
    const daysSinceUrgent = context.becameUrgentAt
      ? (context.currentTimestamp.getTime() - context.becameUrgentAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    if (daysSinceUrgent > 3) {
      priority += 2; // Getting very bad
    } else if (daysSinceUrgent > 1) {
      priority += 1; // Getting bad
    }
  }

  return Math.min(10, Math.max(1, Math.round(priority)));
}

/**
 * Generate realistic email timeline for a thread
 */
export function generateThreadTimeline(
  threadLength: number,
  startDate: Date,
  pattern: 'normal' | 'escalating' | 'urgent'
): Date[] {
  const timestamps: Date[] = [];

  if (pattern === 'normal') {
    // Normal back-and-forth (1-2 days between emails)
    let current = new Date(startDate);
    for (let i = 0; i < threadLength; i++) {
      timestamps.push(new Date(current));
      // 1-2 days later
      current.setDate(current.getDate() + 1 + Math.random());
      // Randomize time of day
      current.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
    }
  } else if (pattern === 'escalating') {
    // Follow-up pattern (gaps get shorter as urgency increases)
    let current = new Date(startDate);
    timestamps.push(new Date(current));

    // First follow-up: 3-4 days
    current.setDate(current.getDate() + 3);
    timestamps.push(new Date(current));

    if (threadLength > 2) {
      // Second follow-up: 2-3 days
      current.setDate(current.getDate() + 2);
      timestamps.push(new Date(current));
    }

    if (threadLength > 3) {
      // Final escalation: 1-2 days
      current.setDate(current.getDate() + 1);
      timestamps.push(new Date(current));
    }
  } else {
    // Urgent thread (rapid fire, hours apart)
    let current = new Date(startDate);
    for (let i = 0; i < threadLength; i++) {
      timestamps.push(new Date(current));
      // 2-6 hours later
      current.setHours(current.getHours() + 2 + Math.floor(Math.random() * 4));
    }
  }

  return timestamps.slice(0, threadLength);
}

/**
 * Check if commitment is overdue
 */
export function isCommitmentOverdue(
  commitmentDate: Date,
  deadlineDate: Date,
  currentDate: Date = new Date()
): boolean {
  // If we're past the deadline and commitment wasn't made before deadline
  return currentDate > deadlineDate && commitmentDate < deadlineDate;
}

/**
 * Format temporal description for humans
 */
export function formatTemporalDescription(context: TemporalContext): string {
  const parts: string[] = [];

  // Age
  if (context.ageInDays < 1) {
    parts.push(`${Math.round(context.ageInHours)} hours old`);
  } else {
    parts.push(`${Math.round(context.ageInDays)} days old`);
  }

  // Deadline
  if (context.hasDeadline && context.deadlineDate) {
    if (context.isOverdue) {
      parts.push(`OVERDUE by ${Math.abs(Math.round(context.daysUntilDeadline!))} days`);
    } else if (context.daysUntilDeadline! < 1) {
      parts.push(`due in ${Math.round(context.hoursUntilDeadline!)} hours`);
    } else {
      parts.push(`due in ${Math.round(context.daysUntilDeadline!)} days`);
    }
  }

  // Urgency evolution
  if (context.urgencyType === 'became_urgent') {
    parts.push('became urgent over time');
  } else if (context.urgencyType === 'deadline_approaching') {
    parts.push('urgent due to deadline');
  } else if (context.urgencyType === 'always') {
    parts.push('always urgent');
  }

  return parts.join(', ');
}
