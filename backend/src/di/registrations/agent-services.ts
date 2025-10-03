import { asFunction } from 'awilix';
import { AppContainer } from '../container';
import { CalendarAgent } from '../../agents/calendar.agent';
import { EmailAgent } from '../../agents/email.agent';
import { MasterAgent } from '../../agents/master.agent';

/**
 * Register agent services and related components
 *
 * This module registers all agents (sub-agents and master agent) following
 * the 4-Prompt Architecture.
 *
 * Architecture:
 * - Sub-agents: Domain-specific agents (calendar, email)
 * - MasterAgent: Main orchestration agent with 2-prompt flow
 *
 * Note: ContactAgent and SlackAgent have been removed as per migration plan.
 * Contact operations are now handled directly by EmailAgent and CalendarAgent.
 */
export function registerAgentServices(container: AppContainer): void {
  container.register({
    // ===== Master Agent =====
    // Stateless orchestration agent using 2-prompt architecture
    // Dependencies: aiService, contextManager, tokenManager
    masterAgent: asFunction(({
      aiService,
      contextManager,
      tokenManager
    }) => {
      return new MasterAgent(
        aiService,
        contextManager,
        tokenManager
      );
    }).singleton(),

    // ===== Sub-Agents =====
    // Domain-specific agents for calendar and email operations
    // All depend on their respective domain service and GenericAIService (as 'aiService')

    calendarAgent: asFunction(({ calendarDomainService, aiService }) => {
      return new CalendarAgent(calendarDomainService, aiService);
    }).singleton(),

    emailAgent: asFunction(({ emailDomainService, aiService }) => {
      return new EmailAgent(emailDomainService, aiService);
    }).singleton(),
  });
}
