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
import { domainServiceFactory, ServiceCreators } from '../factory/domain-service-factory';

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
   * Register all domain services using the enhanced factory pattern
   */
  static registerAll(): void {
    // Register email service with factory
    domainServiceContainer.registerSingleton<IEmailDomainService>(
      'emailService',
      () => ServiceCreators.createEmailService()
    );

    // Register calendar service with factory
    domainServiceContainer.registerSingleton<ICalendarDomainService>(
      'calendarService',
      () => ServiceCreators.createCalendarService()
    );

    // Register contacts service with factory
    domainServiceContainer.registerSingleton<IContactsDomainService>(
      'contactsService',
      () => ServiceCreators.createContactsService()
    );

    // Register Slack service with factory
    domainServiceContainer.registerSingleton<ISlackDomainService>(
      'slackService',
      () => ServiceCreators.createSlackService()
    );

    // Register AI service with factory
    domainServiceContainer.registerSingleton<IAIDomainService>(
      'aiService',
      () => ServiceCreators.createAIService()
    );
  }

  /**
   * Register all domain services with enhanced factory and custom configuration
   */
  static registerAllWithFactory(enableMetrics: boolean = false): void {
    const factoryConfig = {
      enableCaching: true,
      enableHealthChecks: true,
      enableMetrics
    };

    // Register email service with custom config
    domainServiceContainer.registerSingleton<IEmailDomainService>(
      'emailService',
      () => domainServiceFactory.createEmailService(factoryConfig).service
    );

    // Register calendar service with custom config
    domainServiceContainer.registerSingleton<ICalendarDomainService>(
      'calendarService',
      () => domainServiceFactory.createCalendarService(factoryConfig).service
    );

    // Register contacts service with custom config
    domainServiceContainer.registerSingleton<IContactsDomainService>(
      'contactsService',
      () => domainServiceFactory.createContactsService(factoryConfig).service
    );

    // Register Slack service with custom config
    domainServiceContainer.registerSingleton<ISlackDomainService>(
      'slackService',
      () => domainServiceFactory.createSlackService(factoryConfig).service
    );

    // Register AI service with custom config
    domainServiceContainer.registerSingleton<IAIDomainService>(
      'aiService',
      () => domainServiceFactory.createAIService(factoryConfig).service
    );
  }

  /**
   * Register services for E2E testing (real AI services)
   */
  static registerForTesting(): void {
    // Clear existing registrations
    domainServiceContainer.clear();

    // Register real domain services for E2E testing
    // This ensures we test the real AI capabilities
    DomainServiceRegistrations.registerAll();
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
