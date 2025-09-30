/**
 * Domain Service Resolver - Compatibility Shim for DI Container
 * 
 * This provides backward compatibility for agents using DomainServiceResolver
 * while we transition to full constructor injection.
 * 
 * DO NOT USE IN NEW CODE - Use container.resolve() directly instead.
 */

import { IEmailDomainService } from './interfaces/email-domain.interface';
import { ICalendarDomainService } from './interfaces/calendar-domain.interface';
import { IContactsDomainService } from './interfaces/contacts-domain.interface';
import { ISlackDomainService } from './interfaces/slack-domain.interface';
import { IAIDomainService } from './interfaces/ai-domain.interface';
import type { AppContainer } from '../../di';

/**
 * Global container reference for backward compatibility
 * Set by AgentFactory during initialization
 */
let globalContainer: AppContainer | null = null;

export function setGlobalContainer(container: AppContainer): void {
  globalContainer = container;
}

/**
 * Compatibility resolver that uses DI container
 * @deprecated Use container.resolve() directly instead
 */
export class DomainServiceResolver {
  static getEmailService(): IEmailDomainService {
    if (!globalContainer) {
      throw new Error('DI Container not initialized. Call setGlobalContainer() first.');
    }
    return globalContainer.resolve<IEmailDomainService>('emailDomainService');
  }

  static getCalendarService(): ICalendarDomainService {
    if (!globalContainer) {
      throw new Error('DI Container not initialized. Call setGlobalContainer() first.');
    }
    return globalContainer.resolve<ICalendarDomainService>('calendarDomainService');
  }

  static getContactsService(): IContactsDomainService {
    if (!globalContainer) {
      throw new Error('DI Container not initialized. Call setGlobalContainer() first.');
    }
    return globalContainer.resolve<IContactsDomainService>('contactsDomainService');
  }

  static getSlackService(): ISlackDomainService {
    if (!globalContainer) {
      throw new Error('DI Container not initialized. Call setGlobalContainer() first.');
    }
    return globalContainer.resolve<ISlackDomainService>('slackDomainService');
  }

  static getAIService(): IAIDomainService {
    if (!globalContainer) {
      throw new Error('DI Container not initialized. Call setGlobalContainer() first.');
    }
    return globalContainer.resolve<IAIDomainService>('aiDomainService');
  }
}
