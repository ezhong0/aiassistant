import { ToolCall, ThinkParams, AgentResponse, ToolExecutionContext } from '../types/tools';
import { AIAgent } from '../framework/ai-agent';
import { PreviewGenerationResult } from '../types/api.types';
import { getService } from '../services/service-manager';
import { AIClassificationService } from '../services/ai-classification.service';
import {
  ToolParameters,
  AgentExecutionSummary,
  ToolExecutionResult
} from '../types/agent-parameters';
import {
  ThinkAnalysisParams,
  ThinkAnalysisResult
} from '../types/agent-specific-parameters';

export interface ThinkAgentResponse extends AgentResponse {
  data?: {
    verificationStatus: 'correct' | 'incorrect' | 'partial' | 'unclear';
    reasoning: string;
    suggestions?: string[];
    toolAnalysis?: {
      toolName: string;
      appropriateness: 'correct' | 'incorrect' | 'suboptimal';
      reason: string;
    }[];
    overallAssessment: string;
  };
}

export class ThinkAgent extends AIAgent<ThinkParams, ThinkAgentResponse> {
  
  constructor() {
    super({
      name: 'Think',
      description: 'Analyze and reason about user requests, verify correct actions were taken',
      enabled: true,
      timeout: 15000,
      retryCount: 2,
      aiPlanning: {
        enableAIPlanning: false, // Disable AI planning for analysis operations
        maxPlanningSteps: 3,
        planningTimeout: 10000,
        cachePlans: true,
        planningTemperature: 0.1,
        planningMaxTokens: 1000
      }
    });
  }

  private readonly systemPrompt = `# Think Agent - Reflection and Verification
You are a specialized thinking and verification agent that analyzes whether the correct steps were taken for user requests.

## Core Responsibilities
1. **Reflection**: Analyze if the right tools were selected and used appropriately
2. **Verification**: Determine if the actions taken align with the user's intent
3. **Reasoning**: Provide clear explanations for tool usage decisions
4. **Suggestions**: Offer improvements when suboptimal approaches were taken

## Analysis Framework
When analyzing tool usage, consider:

### Tool Appropriateness
- **Correct**: Tool perfectly matches the user's intent and need
- **Incorrect**: Wrong tool chosen, will not achieve the desired outcome
- **Suboptimal**: Tool works but there's a better approach available

### Verification Status
- **correct**: All steps taken were appropriate and complete
- **incorrect**: Major errors in tool selection or approach
- **partial**: Some correct steps but missing critical components
- **unclear**: Insufficient information to determine correctness

### Key Evaluation Criteria
1. **Intent Matching**: Do the selected tools align with user's actual intent?
2. **Completeness**: Are all necessary steps included?
3. **Efficiency**: Is this the most direct path to the solution?
4. **Dependencies**: Are prerequisite tools called when needed?
5. **Sequencing**: Are tools called in the correct order?

## Common Patterns to Validate
- **Email/Calendar with contacts**: Should include contactAgent when names (not emails) are mentioned
- **Multi-step operations**: Ensure all dependencies are satisfied
- **Information gathering**: Verify search tools are used before action tools when needed
- **Error handling**: Check if fallback strategies are appropriate

## Response Format
Provide structured analysis with:
- Clear verification status
- Detailed reasoning for each tool choice
- Specific suggestions for improvement
- Overall assessment of the approach

## Examples of Analysis

### Good Pattern
User: "Send an email to John about the meeting"
Tools: [contactAgent, emailAgent, Think]
Analysis: ✅ Correct - contactAgent properly called to resolve "John" to email address before emailAgent

### Bad Pattern  
User: "Send an email to John about the meeting"
Tools: [emailAgent, Think]
Analysis: ❌ Incorrect - Missing contactAgent call to resolve "John" to actual email address

### Suboptimal Pattern
User: "What's the weather today?"
Tools: [Think]
Analysis: ✅ Optimal - Think tool used appropriately for analysis
`;

  /**
   * Core thinking and verification logic with AI planning support
   */
  protected async processQuery(params: ThinkParams, context: ToolExecutionContext): Promise<ThinkAgentResponse> {
    // Think operations are typically simple analysis, so we'll use manual execution
    return this.executeManually(params, context);
  }

  /**
   * Manual execution fallback - traditional thinking logic
   */
  protected async executeManually(params: ThinkParams, _context: ToolExecutionContext): Promise<ThinkAgentResponse> {
    return await this.processThinking(params);
  }

  /**
   * Build final result from AI planning execution
   */
  protected buildFinalResult(
    summary: AgentExecutionSummary,
    successfulResults: ToolExecutionResult[],
    failedResults: ToolExecutionResult[],
    params: ThinkParams,
    _context: ToolExecutionContext
  ): ThinkAgentResponse {
    // For think operations, we typically want the first successful result
    if (successfulResults.length > 0) {
      const firstResult = successfulResults[0];
      if (firstResult && firstResult.result && typeof firstResult.result === 'object') {
        return firstResult.result as ThinkAgentResponse;
      }
    }

    // If no successful results, create a summary result
    return {
      success: failedResults.length === 0,
      message: failedResults.length > 0 ? 'Analysis failed' : 'Analysis completed',
      data: {
        verificationStatus: 'unclear',
        reasoning: 'Unable to complete analysis',
        overallAssessment: 'Analysis could not be completed'
      }
    };
  }

  /**
   * Generate preview for Think operations (not needed for read-only analysis)
   */
  protected async generatePreview(params: ThinkParams, _context: ToolExecutionContext): Promise<PreviewGenerationResult> {
    return {
      success: true,
      fallbackMessage: 'Think operations are read-only and do not require confirmation'
    };
  }

  /**
   * Process thinking and verification queries
   */
  private async processThinking(params: ThinkParams): Promise<ThinkAgentResponse> {
    try {
      this.logger.info('ThinkAgent processing verification query', { 
        query: params.query,
        hasPreviousActions: !!params.previousActions?.length 
      });

      // Analyze the query and previous actions
      const analysis = await this.analyzeToolUsage(params);

      return {
        success: true,
        message: analysis.overallAssessment,
        data: analysis
      };

    } catch (error) {
      this.logger.error('Error in ThinkAgent.processQuery:', error);
      return {
        success: false,
        message: 'An error occurred during reflection and verification',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Analyze tool usage and provide verification
   */
  private async analyzeToolUsage(params: ThinkParams): Promise<{
    verificationStatus: 'correct' | 'incorrect' | 'partial' | 'unclear';
    reasoning: string;
    suggestions?: string[];
    toolAnalysis?: {
      toolName: string;
      appropriateness: 'correct' | 'incorrect' | 'suboptimal';
      reason: string;
    }[];
    overallAssessment: string;
  }> {
    const { query, previousActions = [], context } = params;

    // If no previous actions to analyze, provide general guidance
    if (previousActions.length === 0) {
      return await this.analyzeQueryWithoutActions(query);
    }

    // Analyze each tool call
    const toolAnalysis = await Promise.all(
      previousActions
        .filter(action => action.name !== 'Think') // Don't analyze Think calls
        .map(action => this.analyzeIndividualTool(action, query, context))
    );

    // Determine overall verification status
    const verificationStatus = this.determineOverallStatus(toolAnalysis);

    // Generate reasoning
    const reasoning = this.generateReasoning(query, toolAnalysis, context);

    // Generate suggestions if needed
    const suggestions = await this.generateSuggestions(toolAnalysis, query);

    // Create overall assessment
    const overallAssessment = this.generateOverallAssessment(verificationStatus, toolAnalysis.length);

    const result: {
      verificationStatus: 'correct' | 'incorrect' | 'partial' | 'unclear';
      reasoning: string;
      suggestions?: string[];
      toolAnalysis: { toolName: string; appropriateness: 'correct' | 'incorrect' | 'suboptimal'; reason: string; }[];
      overallAssessment: string;
    } = {
      verificationStatus,
      reasoning,
      toolAnalysis,
      overallAssessment
    };
    
    if (suggestions.length > 0) {
      result.suggestions = suggestions;
    }
    
    return result;
  }

  /**
   * Analyze individual tool call appropriateness using AI
   */
  private async analyzeIndividualTool(
    toolCall: ToolCall,
    originalQuery: string,
    _context?: string
  ): Promise<{
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  }> {
    const { name: toolName, parameters } = toolCall;
    const query = originalQuery.toLowerCase();

    switch (toolName) {
      case 'contactAgent':
        return await this.analyzeContactAgentUsage(query, parameters);
      
      case 'emailAgent':
        return await this.analyzeEmailAgentUsage(query, parameters);
      
      case 'calendarAgent':
        return await this.analyzeCalendarAgentUsage(query, parameters);
      
      case 'slackAgent':
        return await this.analyzeSlackAgentUsage(query, parameters);
      
      default:
        return {
          toolName: toolName,
          appropriateness: 'suboptimal',
          reason: `Unknown tool "${toolName}" - cannot assess appropriateness`
        };
    }
  }

  /**
   * Analyze ContactAgent usage using AI instead of regex patterns
   * Replaces regex patterns and string matching with AI analysis
   */
  private async analyzeContactAgentUsage(query: string, _parameters: ToolParameters): Promise<{
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  }> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        return {
          toolName: 'contactAgent',
          appropriateness: 'suboptimal',
          reason: 'AI service unavailable'
        };
      }
      const result = await aiClassificationService.analyzeToolAppropriateness(query, 'contactAgent');

      // Map appropriateness to relevance score
      const relevance = result.appropriateness === 'correct' ? 0.9 :
                       result.appropriateness === 'suboptimal' ? 0.6 : 0.3;

      return {
        toolName: 'contactAgent',
        appropriateness: result.appropriateness,
        reason: result.reason
      };
    } catch (error) {
      return {
        toolName: 'contactAgent',
        appropriateness: 'suboptimal',
        reason: 'AI analysis failed - unable to determine appropriateness'
      };
    }
  }

  /**
   * Analyze EmailAgent usage using AI instead of string matching
   */
  private async analyzeEmailAgentUsage(query: string, _parameters: ToolParameters): Promise<{
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  }> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        return {
          toolName: 'emailAgent',
          appropriateness: 'suboptimal',
          reason: 'AI service unavailable'
        };
      }
      const result = await aiClassificationService.analyzeToolAppropriateness(query, 'emailAgent');
      
      return {
        toolName: 'emailAgent',
        appropriateness: result.appropriateness,
        reason: result.reason
      };
    } catch (error) {
      return {
        toolName: 'emailAgent',
        appropriateness: 'suboptimal',
        reason: 'AI analysis failed - unable to determine appropriateness'
      };
    }
  }

  /**
   * Analyze CalendarAgent usage using AI instead of string matching
   */
  private async analyzeCalendarAgentUsage(query: string, _parameters: ToolParameters): Promise<{
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  }> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        return {
          toolName: 'calendarAgent',
          appropriateness: 'suboptimal',
          reason: 'AI service unavailable'
        };
      }
      const result = await aiClassificationService.analyzeToolAppropriateness(query, 'calendarAgent');
      
      return {
        toolName: 'calendarAgent',
        appropriateness: result.appropriateness,
        reason: result.reason
      };
    } catch (error) {
      return {
        toolName: 'calendarAgent',
        appropriateness: 'suboptimal',
        reason: 'AI analysis failed - unable to determine appropriateness'
      };
    }
  }

  /**
   * Analyze SlackAgent usage using AI instead of string matching
   */
  private async analyzeSlackAgentUsage(query: string, _parameters: ToolParameters): Promise<{
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  }> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        return {
          toolName: 'slackAgent',
          appropriateness: 'suboptimal',
          reason: 'AI service unavailable'
        };
      }
      const result = await aiClassificationService.analyzeToolAppropriateness(query, 'slackAgent');
      
      return {
        toolName: 'slackAgent',
        appropriateness: result.appropriateness,
        reason: result.reason
      };
    } catch (error) {
      return {
        toolName: 'slackAgent',
        appropriateness: 'suboptimal',
        reason: 'AI analysis failed - unable to determine appropriateness'
      };
    }
  }

  /**
   * Determine overall verification status
   */
  private determineOverallStatus(
    toolAnalysis: Array<{ toolName: string; appropriateness: 'correct' | 'incorrect' | 'suboptimal'; reason: string; }>
  ): 'correct' | 'incorrect' | 'partial' | 'unclear' {
    if (toolAnalysis.length === 0) return 'unclear';

    // Convert appropriateness to counts
    const correctCount = toolAnalysis.filter(t => t.appropriateness === 'correct').length;
    const incorrectCount = toolAnalysis.filter(t => t.appropriateness === 'incorrect').length;
    const suboptimalCount = toolAnalysis.filter(t => t.appropriateness === 'suboptimal').length;

    if (incorrectCount > 0) return 'incorrect';
    if (suboptimalCount > 0 && correctCount === 0) return 'partial';
    if (suboptimalCount > 0) return 'partial';
    if (correctCount === toolAnalysis.length) return 'correct';

    return 'unclear';
  }

  /**
   * Generate detailed reasoning
   */
  private generateReasoning(query: string, toolAnalysis: Array<{ toolName: string; appropriateness: 'correct' | 'incorrect' | 'suboptimal'; reason: string; }>, context?: string): string {
    const reasoningParts = [`Analysis of query: "${query}"`];

    if (toolAnalysis.length === 0) {
      reasoningParts.push('No previous tool calls to analyze.');
      return reasoningParts.join('\n');
    }

    reasoningParts.push(`\nTool usage analysis (${toolAnalysis.length} tools):`);
    
    toolAnalysis.forEach(analysis => {
      const status = analysis.appropriateness === 'correct' ? '✅' : 
                    analysis.appropriateness === 'suboptimal' ? '⚠️' : '❌';
      reasoningParts.push(`${status} ${analysis.toolName}: ${analysis.reason}`);
    });

    if (context) {
      reasoningParts.push(`\nAdditional context: ${context}`);
    }

    return reasoningParts.join('\n');
  }

  /**
   * Generate improvement suggestions using AI analysis
   * Replaces regex patterns with AI contact name extraction
   */
  private async generateSuggestions(toolAnalysis: Array<{ toolName: string; appropriateness: 'correct' | 'incorrect' | 'suboptimal'; reason: string; }>, query: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Filter tools by appropriateness
    const incorrectTools = toolAnalysis.filter(t => t.appropriateness === 'incorrect');
    const suboptimalTools = toolAnalysis.filter(t => t.appropriateness === 'suboptimal');

    if (incorrectTools.length > 0) {
      suggestions.push(`Remove or replace incorrect tools: ${incorrectTools.map(t => t.toolName).join(', ')}`);
    }

    if (suboptimalTools.length > 0) {
      suggestions.push(`Consider alternative approaches for: ${suboptimalTools.map(t => t.toolName).join(', ')}`);
    }

    // Check for missing contact lookup using AI
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        return [];
      }
      const contactLookup = await aiClassificationService.extractContactNames(query);
      const hasContactAgent = toolAnalysis.some(t => t.toolName === 'contactAgent');

      if (contactLookup.needed && !hasContactAgent) {
        suggestions.push('Consider adding contactAgent to resolve contact names to email addresses');
      }
    } catch (error) {
      // Fallback to basic suggestion if AI fails
      suggestions.push('Consider whether contact lookup is needed for this query');
    }

    return suggestions;
  }

  /**
   * Generate overall assessment
   */
  private generateOverallAssessment(status: string, toolCount: number): string {
    switch (status) {
      case 'correct':
        return `✅ All ${toolCount} tool(s) were appropriately selected and used correctly for this request.`;
      case 'incorrect':
        return `❌ Significant issues found with tool selection - incorrect tools were used that won't achieve the desired outcome.`;
      case 'partial':
        return `⚠️ Partially correct approach - some tools were appropriate but there are opportunities for improvement.`;
      case 'unclear':
        return `❓ Unable to determine appropriateness - insufficient information or no tools to analyze.`;
      default:
        return `Analysis completed for ${toolCount} tool(s).`;
    }
  }

  /**
   * Analyze query when no previous actions exist using AI
   */
  private async analyzeQueryWithoutActions(query: string): Promise<{
    verificationStatus: 'correct' | 'incorrect' | 'partial' | 'unclear';
    reasoning: string;
    suggestions?: string[];
    overallAssessment: string;
  }> {
    const reasoning = `Analyzing query without previous actions: "${query}"\n\nThis appears to be an initial analysis request. I can provide guidance on appropriate tool selection for this type of query.`;

    // Suggest appropriate tools based on AI analysis
    const suggestions = await this.suggestToolsForQuery(query);

    const result: {
      verificationStatus: 'correct' | 'incorrect' | 'partial' | 'unclear';
      reasoning: string;
      suggestions?: string[];
      overallAssessment: string;
    } = {
      verificationStatus: 'unclear',
      reasoning,
      overallAssessment: '❓ No previous actions to verify - providing guidance for appropriate tool selection.'
    };
    
    if (suggestions.length > 0) {
      result.suggestions = suggestions;
    }
    
    return result;
  }

  /**
   * Suggest appropriate tools for a given query using AI
   * Replaces string matching with AI analysis
   */
  private async suggestToolsForQuery(query: string): Promise<string[]> {
    try {
      const aiClassificationService = getService<AIClassificationService>('aiClassificationService');
      if (!aiClassificationService) {
        return [];
      }
      
      // Use AI to detect operations and suggest appropriate tools
      const emailOperation = await aiClassificationService.detectOperation(query, 'emailAgent');
      const calendarOperation = await aiClassificationService.detectOperation(query, 'calendarAgent');
      const contactOperation = await aiClassificationService.detectOperation(query, 'contactAgent');
      const slackOperation = await aiClassificationService.detectOperation(query, 'slackAgent');
      
      const suggestions: string[] = [];
      
      if (emailOperation !== 'unknown') {
        suggestions.push('Consider using emailAgent for email operations');
        
        // Check if contact lookup is needed
        const contactLookup = await aiClassificationService.extractContactNames(query);
        if (contactLookup.needed) {
          suggestions.push('Add contactAgent to resolve contact names to email addresses');
        }
      }
      
      if (calendarOperation !== 'unknown') {
        suggestions.push('Consider using calendarAgent for calendar operations');
        
        // Check if attendees need to be resolved
        const contactLookup = await aiClassificationService.extractContactNames(query);
        if (contactLookup.needed) {
          suggestions.push('Add contactAgent to resolve attendee names');
        }
      }
      
      if (contactOperation !== 'unknown') {
        suggestions.push('Consider using contactAgent for contact lookup');
      }
      
      if (slackOperation !== 'unknown') {
        suggestions.push('Consider using slackAgent for Slack message operations');
      }
      
      return suggestions;
    } catch (error) {
      return ['Unable to analyze query for tool suggestions'];
    }
  }

  /**
   * Get system prompt for external use
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}