/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * BuilderGuard - Safe access utility for prompt builders
 *
 * Provides type-safe, null-checked access to prompt builders with proper error handling.
 * Eliminates the need for dangerous non-null assertion operators (!).
 */

import { ErrorFactory } from '../errors';
import {
  BuilderResponseMap,
  BaseBuilderResponse
} from '../types/workflow/builder-response.types';
import {
  SituationAnalysisPromptBuilder,
  WorkflowPlanningPromptBuilder,
  EnvironmentCheckPromptBuilder,
  ActionExecutionPromptBuilder,
  ProgressAssessmentPromptBuilder,
  FinalResponsePromptBuilder
} from '../services/prompt-builders/main-agent';
import {
  IntentAssessmentPromptBuilder,
  PlanReviewPromptBuilder,
  ResponseFormattingPromptBuilder
} from '../services/prompt-builders/sub-agent';

/**
 * Type map for main agent prompt builders
 */
export interface PromptBuilderMap {
  situation: SituationAnalysisPromptBuilder;
  planning: WorkflowPlanningPromptBuilder;
  environment: EnvironmentCheckPromptBuilder;
  action: ActionExecutionPromptBuilder;
  progress: ProgressAssessmentPromptBuilder;
  final: FinalResponsePromptBuilder;
}

/**
 * Type map for sub-agent prompt builders
 */
export interface SubAgentPromptBuilderMap {
  intent: IntentAssessmentPromptBuilder;
  planReview: PlanReviewPromptBuilder;
  responseFormatting: ResponseFormattingPromptBuilder;
}

/**
 * Builder names for error messages
 */
export const BUILDER_NAMES: Record<keyof PromptBuilderMap, string> = {
  situation: 'SituationAnalysisPromptBuilder',
  planning: 'WorkflowPlanningPromptBuilder',
  environment: 'EnvironmentCheckPromptBuilder',
  action: 'ActionExecutionPromptBuilder',
  progress: 'ProgressAssessmentPromptBuilder',
  final: 'FinalResponsePromptBuilder'
} as const;

/**
 * Sub-agent builder names for error messages
 */
export const SUB_AGENT_BUILDER_NAMES: Record<keyof SubAgentPromptBuilderMap, string> = {
  intent: 'IntentAssessmentPromptBuilder',
  planReview: 'PlanReviewPromptBuilder',
  responseFormatting: 'ResponseFormattingPromptBuilder'
} as const;

/**
 * BuilderGuard - Provides safe access to prompt builders
 */
export class BuilderGuard {
  /**
   * Ensure a builder is initialized and return it safely
   */
  static ensureBuilder<T extends keyof PromptBuilderMap>(
    builder: PromptBuilderMap[T] | null | undefined,
    builderType: T,
    _context?: Record<string, any>
  ): PromptBuilderMap[T] {
    if (!builder) {
      throw ErrorFactory.domain.serviceUnavailable(BUILDER_NAMES[builderType], {
        component: 'builder-guard',
        operation: 'ensure_builder',
        builderType,
        builderName: BUILDER_NAMES[builderType]
      });
    }
    return builder;
  }

  /**
   * Safely execute a builder with error handling and proper typing
   */
  static async safeExecute<T extends keyof PromptBuilderMap>(
    builder: PromptBuilderMap[T] | null | undefined,
    builderType: T,
    input: string,
    context?: Record<string, any>
  ): Promise<BuilderResponseMap[T]> {
    const safeBuilder = this.ensureBuilder(builder, builderType, context);

    try {
      const result = await safeBuilder.execute(input);

      // Validate the response structure
      if (!isValidBuilderResponse(result)) {
        throw new Error(`Invalid builder response structure from ${BUILDER_NAMES[builderType]}`);
      }

      return result as unknown as BuilderResponseMap[T];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.workflow.executionFailed(
        `${BUILDER_NAMES[builderType]} execution failed: ${errorMessage}`,
        context?.sessionId,
        undefined  // iteration not available here
      );
    }
  }

  /**
   * Batch validation of multiple builders
   */
  static validateAllBuilders(builders: {
    situation: SituationAnalysisPromptBuilder | null;
    planning: WorkflowPlanningPromptBuilder | null;
    environment: EnvironmentCheckPromptBuilder | null;
    action: ActionExecutionPromptBuilder | null;
    progress: ProgressAssessmentPromptBuilder | null;
    final: FinalResponsePromptBuilder | null;
  }): void {
    const missingBuilders: string[] = [];

    (Object.keys(builders) as Array<keyof typeof builders>).forEach(key => {
      if (!builders[key]) {
        missingBuilders.push(BUILDER_NAMES[key]);
      }
    });

    if (missingBuilders.length > 0) {
      throw ErrorFactory.domain.serviceUnavailable(`Multiple builders: ${missingBuilders.join(', ')}`, {
        component: 'builder-guard',
        operation: 'validate_all_builders',
        missingBuilders,
        totalMissing: missingBuilders.length
      });
    }
  }

  /**
   * Check if a builder is initialized without throwing
   */
  static isBuilderInitialized<T extends keyof PromptBuilderMap>(
    builder: PromptBuilderMap[T] | null | undefined
  ): builder is PromptBuilderMap[T] {
    return builder !== null && builder !== undefined;
  }

  /**
   * Get builder initialization status for all builders
   */
  static getInitializationStatus(builders: {
    situation: SituationAnalysisPromptBuilder | null;
    planning: WorkflowPlanningPromptBuilder | null;
    environment: EnvironmentCheckPromptBuilder | null;
    action: ActionExecutionPromptBuilder | null;
    progress: ProgressAssessmentPromptBuilder | null;
    final: FinalResponsePromptBuilder | null;
  }): {
    allInitialized: boolean;
    initializedCount: number;
    totalCount: number;
    missingBuilders: string[];
    status: Record<string, boolean>;
  } {
    const status: Record<string, boolean> = {};
    const missingBuilders: string[] = [];
    let initializedCount = 0;
    const totalCount = Object.keys(builders).length;

    (Object.keys(builders) as Array<keyof typeof builders>).forEach(key => {
      const isInitialized = this.isBuilderInitialized(builders[key]);
      status[BUILDER_NAMES[key]] = isInitialized;

      if (isInitialized) {
        initializedCount++;
      } else {
        missingBuilders.push(BUILDER_NAMES[key]);
      }
    });

    return {
      allInitialized: initializedCount === totalCount,
      initializedCount,
      totalCount,
      missingBuilders,
      status
    };
  }

  /**
   * Validate sub-agent prompt builders
   */
  static validateSubAgentBuilders(builders: SubAgentPromptBuilderMap): void {
    const missingBuilders: string[] = [];

    (Object.keys(builders) as Array<keyof SubAgentPromptBuilderMap>).forEach(key => {
      if (!builders[key]) {
        missingBuilders.push(SUB_AGENT_BUILDER_NAMES[key]);
      }
    });

    if (missingBuilders.length > 0) {
      throw ErrorFactory.domain.serviceUnavailable(`Sub-agent builders: ${missingBuilders.join(', ')}`, {
        component: 'builder-guard',
        operation: 'validate_sub_agent_builders',
        missingBuilders,
        totalMissing: missingBuilders.length
      });
    }
  }

  /**
   * Get sub-agent builder initialization status
   */
  static getSubAgentBuilderStatus(builders: SubAgentPromptBuilderMap): {
    allInitialized: boolean;
    initializedCount: number;
    totalCount: number;
    missingBuilders: string[];
    status: Record<string, boolean>;
  } {
    const status: Record<string, boolean> = {};
    const missingBuilders: string[] = [];
    let initializedCount = 0;
    const totalCount = Object.keys(builders).length;

    (Object.keys(builders) as Array<keyof SubAgentPromptBuilderMap>).forEach(key => {
      const isInitialized = builders[key] !== null && builders[key] !== undefined;
      status[SUB_AGENT_BUILDER_NAMES[key]] = isInitialized;

      if (isInitialized) {
        initializedCount++;
      } else {
        missingBuilders.push(SUB_AGENT_BUILDER_NAMES[key]);
      }
    });

    return {
      allInitialized: initializedCount === totalCount,
      initializedCount,
      totalCount,
      missingBuilders,
      status
    };
  }
}

/**
 * Decorator for methods that require initialized builders
 */
export function RequireBuilder<T extends keyof PromptBuilderMap>(builderType: T) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = function(...args: any[]) {
      const builderPropertyName = `${builderType}Builder`;
      const builder = (this as any)[builderPropertyName];

      BuilderGuard.ensureBuilder(builder, builderType, {
        method: propertyName,
        class: target.constructor.name
      });

      return method.apply(this, args);
    };
  };
}

/**
 * Type guard for prompt builder responses
 */
export function isValidBuilderResponse(response: any): response is BaseBuilderResponse {
  return (
    response &&
    typeof response === 'object' &&
    'parsed' in response &&
    response.parsed !== null &&
    response.parsed !== undefined &&
    typeof response.parsed === 'object' &&
    typeof response.parsed.context === 'string'
  );
}

/**
 * Utility to create builder context for error reporting
 */
export function createBuilderContext(
  sessionId?: string,
  userId?: string,
  operation?: string,
  additionalContext?: Record<string, any>
): Record<string, any> {
  return {
    sessionId,
    userId,
    operation,
    timestamp: new Date().toISOString(),
    ...additionalContext
  };
}