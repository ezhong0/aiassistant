/**
 * BuilderGuard - Safe access utility for prompt builders
 *
 * Provides type-safe, null-checked access to prompt builders with proper error handling.
 * Eliminates the need for dangerous non-null assertion operators (!).
 */

import { UnifiedErrorFactory, ErrorContextBuilder } from '../types/workflow/unified-errors';
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
} from '../services/prompt-builders/prompts';

/**
 * Type map for prompt builders
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
 * BuilderGuard - Provides safe access to prompt builders
 */
export class BuilderGuard {
  /**
   * Ensure a builder is initialized and return it safely
   */
  static ensureBuilder<T extends keyof PromptBuilderMap>(
    builder: PromptBuilderMap[T] | null | undefined,
    builderType: T,
    context?: Record<string, any>
  ): PromptBuilderMap[T] {
    if (!builder) {
      const errorContext = ErrorContextBuilder.create()
        .component('builder-guard')
        .operation('ensure_builder')
        .metadata('builderType', builderType)
        .metadata('builderName', BUILDER_NAMES[builderType])
        .build();

      throw UnifiedErrorFactory.serviceUnavailable(BUILDER_NAMES[builderType], errorContext);
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

      return result as BuilderResponseMap[T];
    } catch (error) {
      const errorContext = ErrorContextBuilder.create()
        .component('builder-guard')
        .operation('safe_execute')
        .metadata('builderType', builderType)
        .metadata('builderName', BUILDER_NAMES[builderType])
        .metadata('inputLength', input.length)
        .sessionId(context?.sessionId)
        .userId(context?.userId)
        .build();

      throw UnifiedErrorFactory.builderError(
        BUILDER_NAMES[builderType],
        error instanceof Error ? error : new Error(String(error)),
        errorContext
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
      const errorContext = ErrorContextBuilder.create()
        .component('builder-guard')
        .operation('validate_all_builders')
        .metadata('missingBuilders', missingBuilders)
        .metadata('totalMissing', missingBuilders.length)
        .build();

      throw UnifiedErrorFactory.serviceUnavailable(`Multiple builders: ${missingBuilders.join(', ')}`, errorContext);
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