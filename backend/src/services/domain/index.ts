/**
 * Domain Services - High-level business logic services
 * 
 * This module exports all domain services that provide high-level operations
 * for specific business domains. These services wrap the standardized API
 * clients and provide clean, domain-specific interfaces for agents and
 * other application components.
 */

// Export domain services
export { EmailDomainService } from './email-domain.service';
export { CalendarDomainService } from './calendar-domain.service';
export { ContactsDomainService } from './contacts-domain.service';
export { AIDomainService } from './ai-domain.service';

// Export interfaces
export type {
  IEmailDomainService,
  ICalendarDomainService,
  IContactsDomainService,
  IAIDomainService
} from './interfaces';

/**
 * All services are registered in the DI container.
 * 
 * To use domain services in routes/middleware:
 * ```typescript
 * export function createMyRoutes(container: AppContainer) {
 *   const emailService = container.resolve('emailDomainService');
 *   const calendarService = container.resolve('calendarDomainService');
 *   // ...
 * }
 * ```
 */

// Export error handling
export { APIClientError, ERROR_CODES, ERROR_CODE_CATEGORIES } from '../../errors';
export type { ErrorCode, ErrorCodeCategory } from '../../errors';

// Export validation
export {
  ValidationHelper,
  ValidationSchemas,
  EmailValidationSchemas,
  CalendarValidationSchemas,
  ContactsValidationSchemas,
  AIValidationSchemas
} from '../../validation/api-client.validation';