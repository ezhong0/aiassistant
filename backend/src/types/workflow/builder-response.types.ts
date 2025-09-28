/**
 * Proper types for prompt builder responses
 * Eliminates the need for 'any' casting and provides type safety
 */

/**
 * Base structure for all prompt builder responses
 */
export interface BaseBuilderResponse {
  parsed: {
    context: string;
    [key: string]: any;
  };
  raw?: string;
  metadata?: Record<string, any>;
}

/**
 * Situation analysis response
 */
export interface SituationAnalysisResponse extends BaseBuilderResponse {
  parsed: {
    context: string;
    intent: string;
    riskLevel: 'low' | 'medium' | 'high';
    outputStrategy: 'direct' | 'preview' | 'confirmation';
    entities: string[];
    constraints: string[];
  };
}

/**
 * Workflow planning response
 */
export interface WorkflowPlanningResponse extends BaseBuilderResponse {
  parsed: {
    context: string;
    steps: string[];
    dependencies: string[];
    estimatedTime: number;
    requiredAgents: string[];
  };
}

/**
 * Environment check response
 */
export interface EnvironmentCheckResponse extends BaseBuilderResponse {
  parsed: {
    context: string;
    needsUserInput: boolean;
    requiredInfo?: string;
    environmentReady: boolean;
    blockers: string[];
  };
}

/**
 * Action execution response
 */
export interface ActionExecutionResponse extends BaseBuilderResponse {
  parsed: {
    context: string;
    agent?: string;
    request?: string;
    actionType: 'agent_call' | 'direct_action' | 'no_action';
    parameters?: Record<string, any>;
  };
}

/**
 * Progress assessment response
 */
export interface ProgressAssessmentResponse extends BaseBuilderResponse {
  parsed: {
    context: string;
    newSteps: string[];
    completedSteps: string[];
    isComplete: boolean;
    progressPercentage: number;
    blockers: string[];
  };
}

/**
 * Final response response
 */
export interface FinalResponseResponse extends BaseBuilderResponse {
  parsed: {
    context: string;
    response: string;
    summary: string;
    confidence: number;
    recommendations?: string[];
  };
}

/**
 * Union type for all builder responses
 */
export type BuilderResponse =
  | SituationAnalysisResponse
  | WorkflowPlanningResponse
  | EnvironmentCheckResponse
  | ActionExecutionResponse
  | ProgressAssessmentResponse
  | FinalResponseResponse;

/**
 * Type mapping for builder types to their responses
 */
export interface BuilderResponseMap {
  situation: SituationAnalysisResponse;
  planning: WorkflowPlanningResponse;
  environment: EnvironmentCheckResponse;
  action: ActionExecutionResponse;
  progress: ProgressAssessmentResponse;
  final: FinalResponseResponse;
}