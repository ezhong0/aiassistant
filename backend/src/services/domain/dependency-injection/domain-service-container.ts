/**
 * Domain Service Container - Dependency injection container for domain services
 * 
 * This module provides a dependency injection container for domain services,
 * enabling loose coupling and easier testing.
 */

import { IEmailDomainService } from '../interfaces/email-domain.interface';
import { ICalendarDomainService } from '../interfaces/calendar-domain.interface';
import { IContactsDomainService } from '../interfaces/contacts-domain.interface';
import { ISlackDomainService } from '../interfaces/slack-domain.interface';
import { IAIDomainService } from '../interfaces/ai-domain.interface';

/**
 * Service registration interface
 */
interface ServiceRegistration<T> {
  factory: () => T;
  singleton: boolean;
  instance?: T;
}

/**
 * Domain Service Container
 */
export class DomainServiceContainer {
  private static instance: DomainServiceContainer;
  private services = new Map<string, ServiceRegistration<any>>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DomainServiceContainer {
    if (!DomainServiceContainer.instance) {
      DomainServiceContainer.instance = new DomainServiceContainer();
    }
    return DomainServiceContainer.instance;
  }

  /**
   * Register a service
   */
  register<T>(name: string, factory: () => T, singleton: boolean = true): void {
    this.services.set(name, { factory, singleton });
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(name: string, factory: () => T): void {
    this.register(name, factory, true);
  }

  /**
   * Register a transient service
   */
  registerTransient<T>(name: string, factory: () => T): void {
    this.register(name, factory, false);
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T {
    const registration = this.services.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' is not registered`);
    }

    if (registration.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      return registration.instance;
    }

    return registration.factory();
  }

  /**
   * Check if a service is registered
   */
  isRegistered(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Remove a specific service
   */
  remove(name: string): boolean {
    return this.services.delete(name);
  }
}

/**
 * Global container instance
 */
export const domainServiceContainer = DomainServiceContainer.getInstance();

/**
 * Service registration helper functions
 */
export class DomainServiceRegistrations {
  /**
   * Register all domain services
   */
  static registerAll(): void {
    // Register email service
    domainServiceContainer.registerSingleton<IEmailDomainService>(
      'emailService',
      () => {
        const { EmailDomainService } = require('../email-domain.service');
        return new EmailDomainService();
      }
    );

    // Register calendar service
    domainServiceContainer.registerSingleton<ICalendarDomainService>(
      'calendarService',
      () => {
        const { CalendarDomainService } = require('../calendar-domain.service');
        return new CalendarDomainService();
      }
    );

    // Register contacts service
    domainServiceContainer.registerSingleton<IContactsDomainService>(
      'contactsService',
      () => {
        const { ContactsDomainService } = require('../contacts-domain.service');
        return new ContactsDomainService();
      }
    );

    // Register Slack service
    domainServiceContainer.registerSingleton<ISlackDomainService>(
      'slackService',
      () => {
        const { SlackDomainService } = require('../slack-domain.service');
        return new SlackDomainService();
      }
    );

    // Register AI service
    domainServiceContainer.registerSingleton<IAIDomainService>(
      'aiService',
      () => {
        const { AIDomainService } = require('../ai-domain.service');
        return new AIDomainService();
      }
    );
  }

  /**
   * Register services for testing
   */
  static registerForTesting(): void {
    // Clear existing registrations
    domainServiceContainer.clear();

    // Register mock services for testing
    domainServiceContainer.registerSingleton<IEmailDomainService>(
      'emailService',
      () => {
        const { MockEmailDomainService } = require('../mocks/mock-email-domain.service');
        return new MockEmailDomainService();
      }
    );

    domainServiceContainer.registerSingleton<ICalendarDomainService>(
      'calendarService',
      () => {
        const { MockCalendarDomainService } = require('../mocks/mock-calendar-domain.service');
        return new MockCalendarDomainService();
      }
    );

    domainServiceContainer.registerSingleton<IContactsDomainService>(
      'contactsService',
      () => {
        const { MockContactsDomainService } = require('../mocks/mock-contacts-domain.service');
        return new MockContactsDomainService();
      }
    );

    domainServiceContainer.registerSingleton<ISlackDomainService>(
      'slackService',
      () => {
        const { MockSlackDomainService } = require('../mocks/mock-slack-domain.service');
        return new MockSlackDomainService();
      }
    );

    domainServiceContainer.registerSingleton<IAIDomainService>(
      'aiService',
      () => {
        const { MockAIDomainService } = require('../mocks/mock-ai-domain.service');
        return new MockAIDomainService();
      }
    );
  }
}

/**
 * Service resolution helper functions
 */
export class DomainServiceResolver {
  /**
   * Get email service
   */
  static getEmailService(): IEmailDomainService {
    return domainServiceContainer.get<IEmailDomainService>('emailService');
  }

  /**
   * Get calendar service
   */
  static getCalendarService(): ICalendarDomainService {
    return domainServiceContainer.get<ICalendarDomainService>('calendarService');
  }

  /**
   * Get contacts service
   */
  static getContactsService(): IContactsDomainService {
    return domainServiceContainer.get<IContactsDomainService>('contactsService');
  }

  /**
   * Get Slack service
   */
  static getSlackService(): ISlackDomainService {
    return domainServiceContainer.get<ISlackDomainService>('slackService');
  }

  /**
   * Get AI service
   */
  static getAIService(): IAIDomainService {
    return domainServiceContainer.get<IAIDomainService>('aiService');
  }
}

/**
 * Initialize domain services
 */
export function initializeDomainServices(): void {
  DomainServiceRegistrations.registerAll();
}

/**
 * Initialize domain services for testing
 */
export function initializeDomainServicesForTesting(): void {
  DomainServiceRegistrations.registerForTesting();
}
