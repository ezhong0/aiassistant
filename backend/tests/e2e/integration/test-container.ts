/**
 * Test DI Container for E2E Tests
 *
 * Creates a test version of the app container that:
 * - Uses real Layer 1, 2, 3 implementation
 * - Injects mock services for email/calendar/contacts
 * - Returns data from GeneratedInbox instead of APIs
 */

import { createAppContainer, AppContainer } from '../../../src/di/container';
import { registerAllServices } from '../../../src/di/registrations';
import { GeneratedInbox } from '../generators/hyper-realistic-inbox';
import { MockEmailDomainService, MockCalendarDomainService, MockContactsDomainService } from './mock-services';
import { asValue } from 'awilix';

/**
 * Create a test container with mock services
 *
 * @param inbox - Generated inbox for testing
 * @returns Container with real layers but mock data sources
 */
export function createTestContainer(inbox: GeneratedInbox): AppContainer {
  // Create base container with all real services
  const container = createAppContainer();

  // Register all services (orchestrator, layers, domain services, etc.)
  registerAllServices(container);

  // Override email service with mock that returns inbox data
  const mockEmailService = new MockEmailDomainService(inbox);
  container.register({
    emailDomainService: asValue(mockEmailService as any),
    emailService: asValue(mockEmailService as any), // Alias for strategies
  });

  // Override calendar service with mock
  const mockCalendarService = new MockCalendarDomainService(inbox);
  container.register({
    calendarDomainService: asValue(mockCalendarService as any),
    calendarService: asValue(mockCalendarService as any), // Alias for strategies
  });

  // Override contacts service with mock
  const mockContactsService = new MockContactsDomainService(inbox);
  container.register({
    contactsDomainService: asValue(mockContactsService as any),
    contactsService: asValue(mockContactsService as any), // Alias for strategies
  });

  // All other services (AI, Layer 1/2/3, etc.) remain real
  return container;
}

/**
 * Create test user context for e2e tests
 */
export function createTestUserContext(inbox: GeneratedInbox) {
  return {
    user_id: 'test-user-e2e',
    primary_email: 'user@acme.com',
    connected_accounts: [
      {
        email: 'user@acme.com',
        provider: 'gmail',
        scopes: ['email.read', 'calendar.read'],
      },
    ],
    timezone: 'America/Los_Angeles',
    preferences: {
      tone: 'professional' as const,
      verbosity: 'balanced' as const,
      format_preference: 'mixed' as const,
    },
  };
}
