import { GenericAIService } from '../services/generic-ai.service';
import {
  SituationAnalysisPromptBuilder,
  WorkflowPlanningPromptBuilder,
  EnvironmentCheckPromptBuilder,
  ActionExecutionPromptBuilder,
  ProgressAssessmentPromptBuilder,
  FinalResponsePromptBuilder
} from '../services/prompt-builders/main-agent';
import { PromptBuilderMap } from './builder-guard';

/**
 * Factory for creating prompt builders
 * Eliminates repetitive initialization code
 */
export class PromptBuilderFactory {
  /**
   * Create all prompt builders required for the Master Agent
   */
  static createAllBuilders(aiService: GenericAIService): PromptBuilderMap {
    return {
      situation: new SituationAnalysisPromptBuilder(aiService),
      planning: new WorkflowPlanningPromptBuilder(aiService),
      environment: new EnvironmentCheckPromptBuilder(aiService),
      action: new ActionExecutionPromptBuilder(aiService),
      progress: new ProgressAssessmentPromptBuilder(aiService),
      final: new FinalResponsePromptBuilder(aiService)
    };
  }

  /**
   * Create a specific builder by type
   */
  static createBuilder<T extends keyof PromptBuilderMap>(
    type: T,
    aiService: GenericAIService
  ): PromptBuilderMap[T] {
    const builders = {
      situation: () => new SituationAnalysisPromptBuilder(aiService),
      planning: () => new WorkflowPlanningPromptBuilder(aiService),
      environment: () => new EnvironmentCheckPromptBuilder(aiService),
      action: () => new ActionExecutionPromptBuilder(aiService),
      progress: () => new ProgressAssessmentPromptBuilder(aiService),
      final: () => new FinalResponsePromptBuilder(aiService)
    };

    return builders[type]() as PromptBuilderMap[T];
  }

  /**
   * Create builders for a subset of operations
   */
  static createBuilders<T extends keyof PromptBuilderMap>(
    types: T[],
    aiService: GenericAIService
  ): Pick<PromptBuilderMap, T> {
    const result = {} as Pick<PromptBuilderMap, T>;
    
    for (const type of types) {
      result[type] = this.createBuilder(type, aiService);
    }
    
    return result;
  }
}
