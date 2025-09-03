import { ToolCall, ToolResult, ThinkParams, AgentResponse, ToolExecutionContext } from '../types/tools';
import { BaseAgent } from '../framework/base-agent';

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

export class ThinkAgent extends BaseAgent<ThinkParams, ThinkAgentResponse> {
  
  constructor() {
    super({
      name: 'Think',
      description: 'Analyze and reason about user requests, verify correct actions were taken',
      enabled: true,
      timeout: 15000,
      retryCount: 2
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
Tools: [contentCreator, Think]
Analysis: ⚠️ Suboptimal - contentCreator works but Tavily would be more appropriate for current information
`;

  /**
   * Core thinking and verification logic - required by framework BaseAgent
   */
  protected async processQuery(params: ThinkParams, context: ToolExecutionContext): Promise<ThinkAgentResponse> {
    return await this.processThinking(params);
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
      return this.analyzeQueryWithoutActions(query);
    }

    // Analyze each tool call
    const toolAnalysis = previousActions
      .filter(action => action.name !== 'Think') // Don't analyze Think calls
      .map(action => this.analyzeIndividualTool(action, query, context));

    // Determine overall verification status
    const verificationStatus = this.determineOverallStatus(toolAnalysis);

    // Generate reasoning
    const reasoning = this.generateReasoning(query, toolAnalysis, context);

    // Generate suggestions if needed
    const suggestions = this.generateSuggestions(toolAnalysis, query);

    // Create overall assessment
    const overallAssessment = this.generateOverallAssessment(verificationStatus, toolAnalysis.length);

    return {
      verificationStatus,
      reasoning,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      toolAnalysis,
      overallAssessment
    };
  }

  /**
   * Analyze individual tool call appropriateness
   */
  private analyzeIndividualTool(
    toolCall: ToolCall, 
    originalQuery: string, 
    context?: string
  ): {
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  } {
    const { name: toolName, parameters } = toolCall;
    const query = originalQuery.toLowerCase();

    switch (toolName) {
      case 'contactAgent':
        return this.analyzeContactAgentUsage(query, parameters);
      
      case 'emailAgent':
        return this.analyzeEmailAgentUsage(query, parameters);
      
      case 'calendarAgent':
        return this.analyzeCalendarAgentUsage(query, parameters);
      
      case 'contentCreator':
        return this.analyzeContentCreatorUsage(query, parameters);
      
      case 'Tavily':
        return this.analyzeTavilyUsage(query, parameters);
      
      default:
        return {
          toolName,
          appropriateness: 'unclear' as any,
          reason: `Unknown tool "${toolName}" - cannot assess appropriateness`
        };
    }
  }

  /**
   * Analyze ContactAgent usage
   */
  private analyzeContactAgentUsage(query: string, parameters: any): {
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  } {
    const hasNameReference = /\b(?:send|email|meeting|schedule|invite).*?(?:to|with)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i.test(query);
    const hasEmailAddress = /@/.test(query);

    if (hasNameReference && !hasEmailAddress) {
      return {
        toolName: 'contactAgent',
        appropriateness: 'correct',
        reason: 'Correctly used to resolve contact name to email address before email/calendar operations'
      };
    }

    if (query.includes('contact') || query.includes('find') && (query.includes('person') || query.includes('email'))) {
      return {
        toolName: 'contactAgent',
        appropriateness: 'correct',
        reason: 'Appropriately used for contact lookup request'
      };
    }

    return {
      toolName: 'contactAgent',
      appropriateness: 'suboptimal',
      reason: 'ContactAgent called but may not be necessary for this query'
    };
  }

  /**
   * Analyze EmailAgent usage
   */
  private analyzeEmailAgentUsage(query: string, parameters: any): {
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  } {
    const isEmailRelated = query.includes('email') || query.includes('send') || query.includes('reply') || query.includes('draft');

    if (isEmailRelated) {
      return {
        toolName: 'emailAgent',
        appropriateness: 'correct',
        reason: 'Correctly used for email-related operations'
      };
    }

    return {
      toolName: 'emailAgent',
      appropriateness: 'incorrect',
      reason: 'EmailAgent used for non-email related query'
    };
  }

  /**
   * Analyze CalendarAgent usage
   */
  private analyzeCalendarAgentUsage(query: string, parameters: any): {
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  } {
    const isCalendarRelated = query.includes('calendar') || query.includes('meeting') || 
                             query.includes('schedule') || query.includes('event') ||
                             query.includes('appointment');

    if (isCalendarRelated) {
      return {
        toolName: 'calendarAgent',
        appropriateness: 'correct',
        reason: 'Correctly used for calendar/scheduling operations'
      };
    }

    return {
      toolName: 'calendarAgent',
      appropriateness: 'incorrect',
      reason: 'CalendarAgent used for non-calendar related query'
    };
  }

  /**
   * Analyze ContentCreator usage
   */
  private analyzeContentCreatorUsage(query: string, parameters: any): {
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  } {
    const isContentRelated = query.includes('blog') || query.includes('write') || 
                            query.includes('create') && query.includes('post') ||
                            query.includes('article') || query.includes('content');

    if (isContentRelated) {
      return {
        toolName: 'contentCreator',
        appropriateness: 'correct',
        reason: 'Correctly used for content creation requests'
      };
    }

    // Check if this might be better served by search
    if (query.includes('what') || query.includes('how') || query.includes('when')) {
      return {
        toolName: 'contentCreator',
        appropriateness: 'suboptimal',
        reason: 'ContentCreator used for informational query - Tavily search might be more appropriate'
      };
    }

    return {
      toolName: 'contentCreator',
      appropriateness: 'incorrect',
      reason: 'ContentCreator used for non-content creation query'
    };
  }

  /**
   * Analyze Tavily search usage
   */
  private analyzeTavilyUsage(query: string, parameters: any): {
    toolName: string;
    appropriateness: 'correct' | 'incorrect' | 'suboptimal';
    reason: string;
  } {
    const isSearchRelated = query.includes('search') || query.includes('find') || 
                           query.includes('look up') || query.includes('what is') ||
                           query.includes('what are') || query.includes('how') ||
                           query.includes('when') || query.includes('where') ||
                           query.includes('current') || query.includes('latest');

    if (isSearchRelated) {
      return {
        toolName: 'Tavily',
        appropriateness: 'correct',
        reason: 'Correctly used for information search and research queries'
      };
    }

    return {
      toolName: 'Tavily',
      appropriateness: 'suboptimal',
      reason: 'Tavily used but query may not require web search'
    };
  }

  /**
   * Determine overall verification status
   */
  private determineOverallStatus(
    toolAnalysis: Array<{ appropriateness: 'correct' | 'incorrect' | 'suboptimal'; }>
  ): 'correct' | 'incorrect' | 'partial' | 'unclear' {
    if (toolAnalysis.length === 0) return 'unclear';

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
  private generateReasoning(query: string, toolAnalysis: any[], context?: string): string {
    const reasoningParts = [`Analysis of query: "${query}"`];

    if (toolAnalysis.length === 0) {
      reasoningParts.push('No previous tool calls to analyze.');
      return reasoningParts.join('\n');
    }

    reasoningParts.push(`\nTool usage analysis (${toolAnalysis.length} tools):`);
    
    toolAnalysis.forEach(analysis => {
      const status = analysis.appropriateness === 'correct' ? '✅' : 
                    analysis.appropriateness === 'incorrect' ? '❌' : '⚠️';
      reasoningParts.push(`${status} ${analysis.toolName}: ${analysis.reason}`);
    });

    if (context) {
      reasoningParts.push(`\nAdditional context: ${context}`);
    }

    return reasoningParts.join('\n');
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(toolAnalysis: any[], query: string): string[] {
    const suggestions: string[] = [];

    const incorrectTools = toolAnalysis.filter(t => t.appropriateness === 'incorrect');
    const suboptimalTools = toolAnalysis.filter(t => t.appropriateness === 'suboptimal');

    if (incorrectTools.length > 0) {
      suggestions.push(`Remove or replace incorrect tools: ${incorrectTools.map(t => t.toolName).join(', ')}`);
    }

    if (suboptimalTools.length > 0) {
      suggestions.push(`Consider alternative approaches for: ${suboptimalTools.map(t => t.toolName).join(', ')}`);
    }

    // Check for missing contact lookup
    const lowerQuery = query.toLowerCase();
    const hasNameReference = /\b(?:send|email|meeting|schedule).*?(?:to|with)\s+([a-zA-Z]+)/i.test(query);
    const hasContactAgent = toolAnalysis.some(t => t.toolName === 'contactAgent');
    const hasEmailAddress = /@/.test(query);

    if (hasNameReference && !hasContactAgent && !hasEmailAddress) {
      suggestions.push('Consider adding contactAgent to resolve contact names to email addresses');
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
   * Analyze query when no previous actions exist
   */
  private analyzeQueryWithoutActions(query: string): {
    verificationStatus: 'correct' | 'incorrect' | 'partial' | 'unclear';
    reasoning: string;
    suggestions?: string[];
    overallAssessment: string;
  } {
    const reasoning = `Analyzing query without previous actions: "${query}"\n\nThis appears to be an initial analysis request. I can provide guidance on appropriate tool selection for this type of query.`;

    // Suggest appropriate tools based on query analysis
    const suggestions = this.suggestToolsForQuery(query);

    return {
      verificationStatus: 'unclear',
      reasoning,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      overallAssessment: '❓ No previous actions to verify - providing guidance for appropriate tool selection.'
    };
  }

  /**
   * Suggest appropriate tools for a given query
   */
  private suggestToolsForQuery(query: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('email') || lowerQuery.includes('send')) {
      suggestions.push('Consider using emailAgent for email operations');
      
      if (!/[@]/.test(query) && /\b(?:to|send.*?to)\s+([a-zA-Z]+)/i.test(query)) {
        suggestions.push('Add contactAgent to resolve contact names to email addresses');
      }
    }

    if (lowerQuery.includes('calendar') || lowerQuery.includes('meeting') || lowerQuery.includes('schedule')) {
      suggestions.push('Consider using calendarAgent for calendar operations');
      
      if (lowerQuery.includes('with ')) {
        suggestions.push('Add contactAgent to resolve attendee names');
      }
    }

    if (lowerQuery.includes('contact') || lowerQuery.includes('find') && lowerQuery.includes('person')) {
      suggestions.push('Consider using contactAgent for contact lookup');
    }

    if (lowerQuery.includes('blog') || lowerQuery.includes('write') || lowerQuery.includes('create')) {
      suggestions.push('Consider using contentCreator for content creation');
    }

    if (lowerQuery.includes('search') || lowerQuery.includes('what') || lowerQuery.includes('how')) {
      suggestions.push('Consider using Tavily for web search and information gathering');
    }

    return suggestions;
  }

  /**
   * Get system prompt for external use
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}