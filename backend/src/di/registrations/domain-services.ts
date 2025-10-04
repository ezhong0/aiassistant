import { asClass } from 'awilix';
import { AppContainer } from '../container';
import { EmailDomainService } from '../../services/domain/email-domain.service';
import { CalendarDomainService } from '../../services/domain/calendar-domain.service';
import { ContactsDomainService } from '../../services/domain/contacts-domain.service';
import { AIDomainService } from '../../services/domain/ai-domain.service';

/**
 * Register domain-specific business logic services
 *
 * These services provide high-level operations for specific domains
 * like email, calendar, contacts, etc.
 *
 * OAuth is handled by Supabase Auth. Domain services use SupabaseTokenProvider
 * to fetch Google provider tokens from Supabase.
 */
export function registerDomainServices(container: AppContainer): void {
  container.register({
    // Email domain service (depends on supabaseTokenProvider, googleAPIClient)
    emailDomainService: asClass(EmailDomainService).singleton(),

    // Calendar domain service (depends on supabaseTokenProvider, googleAPIClient)
    calendarDomainService: asClass(CalendarDomainService).singleton(),

    // Contacts domain service (depends on supabaseTokenProvider, googleAPIClient)
    contactsDomainService: asClass(ContactsDomainService).singleton(),

    // AI domain service (OpenAI integration)
    aiDomainService: asClass(AIDomainService).singleton(),
  });
}
