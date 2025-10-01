import { asClass, asFunction } from 'awilix';
import { AppContainer } from '../container';
import { CalendarAgent } from '../../agents/calendar.agent';
import { EmailAgent } from '../../agents/email.agent';
import { ContactAgent } from '../../agents/contact.agent';
import { SlackAgent } from '../../agents/slack.agent';
import { MasterAgent } from '../../agents/master.agent';
import { WorkflowExecutor } from '../../services/workflow-executor.service';
import {
  SituationAnalysisPromptBuilder,
  WorkflowPlanningPromptBuilder,
  EnvironmentCheckPromptBuilder,
  ActionExecutionPromptBuilder,
  ProgressAssessmentPromptBuilder,
  FinalResponsePromptBuilder
} from '../../services/prompt-builders/main-agent';

/**
 * Register agent services and related components
 *
 * This module registers all agents (sub-agents and master agent) along with
 * their dependencies like prompt builders and workflow executor.
 *
 * Architecture:
 * - Sub-agents: Domain-specific agents (calendar, email, contacts, slack)
 * - Prompt Builders: AI prompt generation for different workflow phases
 * - WorkflowExecutor: Orchestrates multi-step AI workflows
 * - MasterAgent: Main orchestration agent
 */
export function registerAgentServices(container: AppContainer): void {
  container.register({
    // ===== Prompt Builders =====
    // These builders generate prompts for different phases of agent workflows
    // All depend on GenericAIService (registered as 'aiService')

    situationAnalysisPromptBuilder: asClass(SituationAnalysisPromptBuilder).singleton(),
    workflowPlanningPromptBuilder: asClass(WorkflowPlanningPromptBuilder).singleton(),
    environmentCheckPromptBuilder: asClass(EnvironmentCheckPromptBuilder).singleton(),
    actionExecutionPromptBuilder: asClass(ActionExecutionPromptBuilder).singleton(),
    progressAssessmentPromptBuilder: asClass(ProgressAssessmentPromptBuilder).singleton(),
    finalResponsePromptBuilder: asClass(FinalResponsePromptBuilder).singleton(),

    // ===== Workflow Executor =====
    // Orchestrates multi-step workflows using prompt builders
    // Dependencies: environmentCheckBuilder, actionExecutionBuilder, progressAssessmentBuilder, tokenManager
    workflowExecutor: asFunction(({
      environmentCheckPromptBuilder,
      actionExecutionPromptBuilder,
      progressAssessmentPromptBuilder,
      tokenManager
    }) => {
      return new WorkflowExecutor(
        environmentCheckPromptBuilder,
        actionExecutionPromptBuilder,
        progressAssessmentPromptBuilder,
        tokenManager,
        10 // maxIterations
      );
    }).singleton(),

    // ===== Master Agent =====
    // Main orchestration agent that coordinates sub-agents and workflow execution
    // Dependencies: aiService, contextManager, tokenManager, workflowExecutor, and all prompt builders
    masterAgent: asFunction(({
      aiService,
      contextManager,
      tokenManager,
      workflowExecutor,
      situationAnalysisPromptBuilder,
      workflowPlanningPromptBuilder,
      environmentCheckPromptBuilder,
      actionExecutionPromptBuilder,
      progressAssessmentPromptBuilder,
      finalResponsePromptBuilder
    }) => {
      const builders = {
        situation: situationAnalysisPromptBuilder,
        planning: workflowPlanningPromptBuilder,
        environment: environmentCheckPromptBuilder,
        action: actionExecutionPromptBuilder,
        progress: progressAssessmentPromptBuilder,
        final: finalResponsePromptBuilder
      };

      return new MasterAgent(
        aiService,
        contextManager,
        tokenManager,
        workflowExecutor,
        builders
      );
    }).singleton(),

    // ===== Sub-Agents =====
    // Domain-specific agents for calendar, email, contacts, and slack operations
    // All depend on their respective domain service and GenericAIService (as 'aiService')

    calendarAgent: asClass(CalendarAgent).singleton(),
    emailAgent: asClass(EmailAgent).singleton(),
    contactAgent: asClass(ContactAgent).singleton(),
    slackAgent: asClass(SlackAgent).singleton(),
  });
}
