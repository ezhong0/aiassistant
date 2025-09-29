/**
 * Domain Service Interfaces Index
 * Re-exports all focused domain interfaces
 */

// Base interfaces
export * from './base-domain.interface';

// Domain-specific interfaces
export * from './ai-domain.interface';
export * from './calendar-domain.interface';
export * from './contacts-domain.interface';
export * from './email-domain.interface';
export * from './slack-domain.interface';

// Type-only exports for better tree-shaking
export type {
  IDomainService,
  IOAuthEnabledDomainService,
  HealthStatus,
  OAuthTokenData
} from './base-domain.interface';

export type {
  IAIDomainService,
  AIModelConfig,
  StructuredDataParams,
  TextCompletionParams,
  ChatCompletionParams,
  EmbeddingParams
} from './ai-domain.interface';

export type {
  ICalendarDomainService,
  CalendarEvent,
  CalendarEventInput,
  GetEventsParams,
  Calendar,
  FreeBusyInfo
} from './calendar-domain.interface';

export type {
  IContactsDomainService,
  Contact,
  ContactInput,
  ContactSearchParams,
  ContactGroup
} from './contacts-domain.interface';

export type {
  IEmailDomainService,
  EmailDetails,
  SendEmailParams,
  EmailSearchParams,
  EmailThread,
  EmailDraft
} from './email-domain.interface';

export type {
  ISlackDomainService,
  SlackChannel,
  SlackUser,
  SlackMessageParams,
  SlackMessageResult,
  SlackFile
} from './slack-domain.interface';