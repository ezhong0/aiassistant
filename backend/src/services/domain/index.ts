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
export { SlackDomainService } from './slack-domain.service';
export { AIDomainService } from './ai-domain.service';

// Export interfaces
export type {
  IEmailDomainService,
  ICalendarDomainService,
  IContactsDomainService,
  ISlackDomainService,
  IAIDomainService
} from './interfaces';

// Export dependency injection
export {
  DomainServiceContainer,
  domainServiceContainer,
  DomainServiceRegistrations,
  DomainServiceResolver,
  initializeDomainServices,
  initializeDomainServicesForTesting
} from './dependency-injection/domain-service-container';

// Export service factory
export {
  DomainServiceFactory,
  domainServiceFactory,
  ServiceCreators,
  type ServiceFactoryConfig,
  type ServiceFactoryResult
} from './factory/domain-service-factory';

// Export error handling
export {
  APIClientError,
  APIClientErrorCode,
  APIClientErrorCategory
} from '../../errors/api-client.errors';

// Export validation
export {
  ValidationHelper,
  ValidationSchemas,
  EmailValidationSchemas,
  CalendarValidationSchemas,
  ContactsValidationSchemas,
  SlackValidationSchemas,
  AIValidationSchemas
} from '../../validation/api-client.validation';