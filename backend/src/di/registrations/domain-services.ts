import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { EmailDomainService } from '../../services/domain/email-domain.service';
import { CalendarDomainService } from '../../services/domain/calendar-domain.service';
import { ContactsDomainService } from '../../services/domain/contacts-domain.service';
import { SlackDomainService } from '../../services/domain/slack-domain.service';
import { AIDomainService } from '../../services/domain/ai-domain.service';

/**
 * Register domain-specific business logic services
 * 
 * These services provide high-level operations for specific domains
 * like email, calendar, contacts, etc.
 */
export function registerDomainServices(container: AppContainer): void {
  container.register({
    // Email domain service (depends on googleOAuthManager)
    emailDomainService: asClass(EmailDomainService).singleton(),

    // Calendar domain service (depends on googleOAuthManager)
    calendarDomainService: asClass(CalendarDomainService).singleton(),

    // Contacts domain service (depends on googleOAuthManager)
    contactsDomainService: asClass(ContactsDomainService).singleton(),

    // Slack domain service - Awilix auto-resolves all dependencies
    // Dependencies: slackOAuthManager, genericAIService (as aiService), contextManager, tokenManager
    slackDomainService: asClass(SlackDomainService).singleton(),

    // AI domain service (OpenAI integration)
    aiDomainService: asClass(AIDomainService).singleton(),
  });
}
