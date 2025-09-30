/**
 * Detailed Execution Logger for E2E Tests
 * Captures all execution details and outputs to readable files
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../../src/utils/logger';

export interface ExecutionLogEntry {
  timestamp: string;
  type: 'initial_prompt' | 'llm_output' | 'agent_communication' | 'api_call' | 'api_response' | 'final_response' | 'test_analysis';
  stage?: string;
  content: string;
  metadata?: any;
}

export interface DetailedExecutionLog {
  testId: string;
  scenarioId: string;
  userInput: string;
  startTime: string;
  endTime?: string;
  success: boolean;
  entries: ExecutionLogEntry[];
  summary: {
    totalLLMCalls: number;
    totalAPICalls: number;
    totalDuration: number;
    stages: string[];
  };
}

export class DetailedExecutionLogger {
  private currentLog: DetailedExecutionLog | null = null;
  private outputDir: string;

  constructor(outputDir: string = 'tests/e2e/reports/detailed-executions') {
    this.outputDir = outputDir;
  }

  /**
   * Start logging a new test execution
   */
  startExecution(testId: string, scenarioId: string, userInput: string): void {
    this.currentLog = {
      testId,
      scenarioId,
      userInput,
      startTime: new Date().toISOString(),
      success: false,
      entries: [],
      summary: {
        totalLLMCalls: 0,
        totalAPICalls: 0,
        totalDuration: 0,
        stages: []
      }
    };

    this.addEntry('initial_prompt', 'Initial user input received', userInput);
  }

  /**
   * Add an entry to the current log
   */
  addEntry(
    type: ExecutionLogEntry['type'],
    content: string,
    metadata?: any,
    stage?: string
  ): void {
    if (!this.currentLog) {
      logger.warn('No active execution log, cannot add entry');
      return;
    }

    const entry: ExecutionLogEntry = {
      timestamp: new Date().toISOString(),
      type,
      content: this.formatContent(content),
      metadata,
      stage
    };

    this.currentLog.entries.push(entry);

    // Update summary
    if (type === 'llm_output' || type === 'agent_communication') {
      this.currentLog.summary.totalLLMCalls++;
    } else if (type === 'api_call') {
      this.currentLog.summary.totalAPICalls++;
    }

    if (stage && !this.currentLog.summary.stages.includes(stage)) {
      this.currentLog.summary.stages.push(stage);
    }
  }

  /**
   * Log LLM output
   */
  logLLMOutput(stage: string, output: string, metadata?: any): void {
    this.addEntry('llm_output', output, metadata, stage);
  }

  /**
   * Log agent communication
   */
  logAgentCommunication(fromAgent: string, toAgent: string, message: string, metadata?: any): void {
    const content = `[${fromAgent} → ${toAgent}]: ${message}`;
    this.addEntry('agent_communication', content, metadata);
  }

  /**
   * Log API call
   */
  logAPICall(clientName: string, endpoint: string, method: string, request: any, metadata?: any): void {
    const content = `${clientName} ${method.toUpperCase()} ${endpoint}`;
    this.addEntry('api_call', content, { 
      request: this.sanitizeRequest(request), 
      ...metadata 
    });
  }

  /**
   * Log API response
   */
  logAPIResponse(clientName: string, endpoint: string, response: any, metadata?: any): void {
    const content = `${clientName} response for ${endpoint}`;
    this.addEntry('api_response', content, { 
      response: this.sanitizeResponse(response), 
      ...metadata 
    });
  }

  /**
   * Log final response
   */
  logFinalResponse(response: string, metadata?: any): void {
    this.addEntry('final_response', response, metadata);
  }

  /**
   * Log test analysis
   */
  logTestAnalysis(analysis: string, metadata?: any): void {
    this.addEntry('test_analysis', analysis, metadata);
  }

  /**
   * Complete the execution and save to file
   */
  async completeExecution(success: boolean): Promise<string> {
    if (!this.currentLog) {
      throw new Error('No active execution to complete');
    }

    this.currentLog.endTime = new Date().toISOString();
    this.currentLog.success = success;
    this.currentLog.summary.totalDuration = 
      new Date(this.currentLog.endTime).getTime() - 
      new Date(this.currentLog.startTime).getTime();

    const filename = await this.saveToFile();
    this.currentLog = null;
    
    return filename;
  }

  /**
   * Format content to be human-readable
   */
  private formatContent(content: string): string {
    if (!content) {
      return '';
    }
    
    if (typeof content !== 'string') {
      content = JSON.stringify(content, null, 2);
    }

    // Replace common escape sequences with readable versions
    return content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }

  /**
   * Save the current log to a file
   */
  private async saveToFile(): Promise<string> {
    if (!this.currentLog) {
      throw new Error('No log to save');
    }

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.currentLog.testId}_${this.currentLog.scenarioId}_${timestamp}.md`;
    const filepath = path.join(this.outputDir, filename);

    // Generate markdown content
    const markdown = this.generateMarkdown();

    // Write to file
    await fs.writeFile(filepath, markdown, 'utf8');

    logger.info('Detailed execution log saved', {
      operation: 'detailed_log_save',
      filepath,
      testId: this.currentLog.testId,
      scenarioId: this.currentLog.scenarioId
    });

    return filepath;
  }

  /**
   * Generate markdown content for the log
   */
  private generateMarkdown(): string {
    if (!this.currentLog) {
      return '# No Execution Log Available\n';
    }

    const { testId, scenarioId, userInput, startTime, endTime, success, entries, summary } = this.currentLog;

    let markdown = `# 🧪 E2E Test Execution Report\n\n`;

    // Header information - simplified
    markdown += `## 📋 Overview\n`;
    markdown += `- **Status**: ${success ? '✅ PASSED' : '❌ FAILED'}\n`;
    markdown += `- **Duration**: ${(summary.totalDuration / 1000).toFixed(2)}s\n`;
    markdown += `- **AI Calls**: ${summary.totalLLMCalls} | **API Calls**: ${summary.totalAPICalls}\n\n`;

    // User Input - prominent
    markdown += `## 💬 User Request\n`;
    markdown += `> ${userInput}\n\n`;

    // Execution Timeline - simplified
    markdown += `## ⏱️ Execution Timeline\n\n`;

    let eventNumber = 0;
    for (const entry of entries) {
      if (entry.type === 'initial_prompt') continue; // Skip redundant initial prompt

      eventNumber++;
      const time = new Date(entry.timestamp).toLocaleTimeString();

      markdown += `### ${eventNumber}. ${this.getSimpleEntryTitle(entry.type)} (${time})\n\n`;
      markdown += this.formatSimpleEntry(entry);
      markdown += `\n---\n\n`;
    }

    return markdown;
  }

  /**
   * Get simple, human-readable entry title
   */
  private getSimpleEntryTitle(type: ExecutionLogEntry['type']): string {
    const titles = {
      'initial_prompt': '🎯 User Request',
      'llm_output': '🤖 AI Response',
      'agent_communication': '🔄 Agent Communication',
      'api_call': '📤 API Request',
      'api_response': '📥 API Response',
      'final_response': '✅ Final Answer',
      'test_analysis': '📊 Test Analysis'
    };
    return titles[type] || '📝 Event';
  }

  /**
   * Format entry in a simple, readable way
   */
  private formatSimpleEntry(entry: ExecutionLogEntry): string {
    const { type, content, metadata } = entry;

    switch (type) {
      case 'api_call':
        return this.formatApiCall(metadata);

      case 'api_response':
        return this.formatApiResponse(metadata);

      case 'llm_output':
      case 'final_response':
        return this.formatLLMOutput(content, metadata);

      case 'agent_communication':
        return `**Message**: ${content}\n`;

      case 'test_analysis':
        return content;

      default:
        return content;
    }
  }

  /**
   * Format API call in a simple way
   */
  private formatApiCall(metadata: any): string {
    if (!metadata || !metadata.request) return '';

    const req = metadata.request;
    let output = '';

    // Show what API is being called
    const endpoint = req.endpoint || '';
    const method = req.method || '';

    // Detect service from endpoint or data
    let clientName = 'API';
    let isOpenAI = false;
    if (endpoint.includes('openai') || endpoint.includes('/chat/completions') || endpoint.includes('/embeddings')) {
      clientName = '🤖 OpenAI';
      isOpenAI = true;
    } else if (endpoint.includes('gmail')) {
      clientName = '📧 Gmail';
    } else if (endpoint.includes('calendar')) {
      clientName = '📅 Google Calendar';
    } else if (endpoint.includes('slack')) {
      clientName = '💬 Slack';
    }

    // For non-OpenAI APIs, just show a compact summary
    if (!isOpenAI) {
      output += `**Calling**: ${clientName} \`${method} ${endpoint}\`\n`;
      return output;
    }

    // For OpenAI calls, show minimal info (just that we're calling it)
    output += `**Calling**: ${clientName}\n`;

    // Show model if available
    if (req.data && req.data.model) {
      output += `**Model**: ${req.data.model}\n`;
    }

    // Show prompt builder name if available (from request data or metadata)
    const promptBuilder = req.data?._promptBuilder || metadata?.promptBuilder;
    if (promptBuilder && promptBuilder !== 'unknown') {
      output += `**Prompt Builder**: \`${promptBuilder}\`\n`;
    }

    return output;
  }

  /**
   * Format API response in a simple way
   */
  private formatApiResponse(metadata: any): string {
    if (!metadata || !metadata.response) return '';

    const resp = metadata.response;
    let output = '';

    const status = resp.statusCode || resp.status || 200;
    const statusIcon = status >= 200 && status < 300 ? '✅' : '❌';

    // Show duration if available
    if (metadata.duration) {
      const seconds = (metadata.duration / 1000).toFixed(2);
      output += `**Completed** (${seconds}s)\n\n`;
    }

    // Show key response data
    if (resp.data) {
      const data = resp.data;

      // For OpenAI responses - show the actual response content
      if (data.choices) {
        const choices = Array.isArray(data.choices) ? data.choices : Object.values(data.choices || {});
        const firstChoice = choices[0];

        if (firstChoice && firstChoice.message) {
          const message = firstChoice.message;

          // Show text response
          if (message.content) {
            const content = String(message.content);
            output += `**AI Response**:\n> ${content}\n\n`;
          }

          // Show function call with parsed arguments
          if (message.function_call) {
            output += `**Function**: \`${message.function_call.name}\`\n\n`;

            // Parse and display function arguments in a readable way
            if (message.function_call.arguments) {
              try {
                const args = JSON.parse(message.function_call.arguments);
                let hasDisplayedSomething = false;

                // Show steps array (from MasterAgent planning)
                if (args.steps && Array.isArray(args.steps)) {
                  output += `**📝 Workflow Steps**:\n`;
                  args.steps.forEach((step: any, idx: number) => {
                    const stepText = typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step);
                    output += `${idx + 1}. ${stepText}\n`;
                  });
                  output += `\n`;
                  hasDisplayedSomething = true;
                }

                // Show context if present (important for tracking state)
                if (args.context) {
                  try {
                    const context = typeof args.context === 'string' ? JSON.parse(args.context) : args.context;
                    output += `**📋 Context Update**:\n`;
                    if (context.GOAL) output += `- Goal: ${context.GOAL}\n`;
                    if (context.PROGRESS) output += `- Progress: ${context.PROGRESS}\n`;
                    if (context.NEXT) output += `- Next: ${context.NEXT}\n`;
                    if (context.BLOCKERS && context.BLOCKERS.length > 0) output += `- Blockers: ${context.BLOCKERS.join(', ')}\n`;
                    output += `\n`;
                    hasDisplayedSomething = true;
                  } catch (e) {
                    // If context parsing fails, just show raw
                  }
                }

                // Show agent routing
                if (args.agent) {
                  output += `**🎯 Routing to**: ${args.agent} agent\n`;
                  hasDisplayedSomething = true;
                }
                if (args.request) {
                  output += `**📤 Request**: ${args.request}\n`;
                  hasDisplayedSomething = true;
                }

                // Show response text if present
                if (args.response) {
                  const responseText = typeof args.response === 'string'
                    ? args.response
                    : JSON.stringify(args.response, null, 2);
                  output += `**💬 Response**:\n${responseText}\n\n`;
                  hasDisplayedSomething = true;
                }

                // Show tool_calls or toolCalls array (from SubAgent planning)
                const toolCallsArray = args.tool_calls || args.toolCalls;
                if (toolCallsArray && Array.isArray(toolCallsArray)) {
                  output += `**🔧 Tool Calls Planned**:\n`;
                  for (const tool of toolCallsArray) {
                    const toolName = tool.tool || tool.function || tool.name || 'unknown';
                    const toolParams = tool.parameters || tool.params || tool.args || {};
                    const toolDesc = tool.description || '';

                    output += `  - **${toolName}**`;
                    if (toolDesc) {
                      output += ` - ${toolDesc}`;
                    }
                    output += `\n`;

                    // Show key parameters
                    const paramKeys = Object.keys(toolParams);
                    if (paramKeys.length > 0 && paramKeys.length <= 5) {
                      for (const key of paramKeys) {
                        const value = toolParams[key];
                        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                        const truncated = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
                        output += `    - ${key}: ${truncated}\n`;
                      }
                    } else if (paramKeys.length > 5) {
                      output += `    - (${paramKeys.length} parameters)\n`;
                    }
                  }
                  output += `\n`;
                  hasDisplayedSomething = true;
                }

                // Show REQUEST and TOOL_CALLS in context (SubAgent planning format)
                if (args.context) {
                  try {
                    const context = typeof args.context === 'string' ? JSON.parse(args.context) : args.context;

                    // Show REQUEST from context
                    if (context.REQUEST) {
                      output += `**📋 SubAgent Context**:\n`;
                      output += `- Request: ${context.REQUEST}\n`;
                      if (context.STATUS) output += `- Status: ${context.STATUS}\n`;
                      output += `\n`;
                      hasDisplayedSomething = true;
                    }

                    // Show TOOL_CALLS array from context
                    if (context.TOOL_CALLS && Array.isArray(context.TOOL_CALLS)) {
                      output += `**🔧 Tool Calls from Context**:\n`;
                      for (const tool of context.TOOL_CALLS) {
                        if (typeof tool === 'string') {
                          output += `  - ${tool}\n`;
                        } else {
                          const toolStr = JSON.stringify(tool, null, 2);
                          output += `\`\`\`json\n${toolStr}\n\`\`\`\n`;
                        }
                      }
                      output += `\n`;
                      hasDisplayedSomething = true;
                    }
                  } catch (e) {
                    // Ignore
                  }
                }

                // Show execution plan if present
                if (args.executionPlan && !hasDisplayedSomething) {
                  output += `**📋 Execution Plan**:\n`;
                  output += `${args.executionPlan}\n\n`;
                  hasDisplayedSomething = true;
                }

                // If nothing was displayed, show the raw arguments (for debugging)
                if (!hasDisplayedSomething) {
                  const argKeys = Object.keys(args);
                  if (argKeys.length > 0) {
                    output += `**⚠️ Raw Function Arguments**:\n`;
                    const jsonStr = JSON.stringify(args, null, 2);
                    const truncated = jsonStr.length > 500 ? jsonStr.substring(0, 500) + '...\n(truncated)' : jsonStr;
                    output += `\`\`\`json\n${truncated}\n\`\`\`\n\n`;
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // For Gmail/Calendar/Slack responses - compact
      else if (data.messages) {
        output += `**Result**: Found ${Array.isArray(data.messages) ? data.messages.length : 'some'} messages (${(metadata.duration / 1000).toFixed(2)}s)\n\n`;
      }
      else if (data.items) {
        output += `**Result**: Found ${Array.isArray(data.items) ? data.items.length : 'some'} items (${(metadata.duration / 1000).toFixed(2)}s)\n\n`;
      }
      else if (data.ok !== undefined) {
        output += `**Result**: ${data.ok ? '✅ Success' : '❌ Failed'} (${(metadata.duration / 1000).toFixed(2)}s)\n\n`;
      }
      else {
        output += `**Result**: ✅ Success (${(metadata.duration / 1000).toFixed(2)}s)\n\n`;
      }
    }

    return output;
  }

  /**
   * Format LLM output in a simple way
   */
  private formatLLMOutput(content: string, metadata?: any): string {
    let output = '';

    // Show the actual response
    output += `**Response**:\n`;
    output += `> ${content}\n\n`;

    return output;
  }

  /**
   * Get icon for entry type
   */
  private getEntryIcon(type: ExecutionLogEntry['type']): string {
    const icons = {
      'initial_prompt': '🎯',
      'llm_output': '🤖',
      'agent_communication': '🔄',
      'api_call': '📡',
      'api_response': '📨',
      'final_response': '✅',
      'test_analysis': '📊'
    };
    return icons[type] || '📝';
  }

  /**
   * Sanitize request data for human readability
   */
  private sanitizeRequest(request: any): any {
    if (!request || typeof request !== 'object') {
      return request;
    }

    const sanitized = { ...request };

    // Remove or truncate large data fields
    if (sanitized.data && typeof sanitized.data === 'object') {
      sanitized.data = this.sanitizeData(sanitized.data);
    }

    // Truncate very long messages/content
    if (sanitized.messages && Array.isArray(sanitized.messages)) {
      sanitized.messages = sanitized.messages.map((msg: any) => {
        if (msg.content && msg.content.length > 500) {
          return { ...msg, content: msg.content.substring(0, 500) + '... [truncated]' };
        }
        return msg;
      });
    }

    return sanitized;
  }

  /**
   * Sanitize response data for human readability
   */
  private sanitizeResponse(response: any): any {
    if (!response || typeof response !== 'object') {
      return response;
    }

    const sanitized = { ...response };

    // Remove or truncate large data fields
    if (sanitized.data && typeof sanitized.data === 'object') {
      sanitized.data = this.sanitizeData(sanitized.data);
    }

    // Truncate very long content
    if (sanitized.choices && Array.isArray(sanitized.choices)) {
      sanitized.choices = sanitized.choices.map((choice: any) => {
        if (choice.message?.content && choice.message.content.length > 1000) {
          return {
            ...choice,
            message: {
              ...choice.message,
              content: choice.message.content.substring(0, 1000) + '... [truncated]'
            }
          };
        }
        return choice;
      });
    }

    return sanitized;
  }

  /**
   * Sanitize nested data objects
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 1000) + '... [truncated]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Format content for display based on type
   */
  private formatContentForDisplay(content: string, type: string): string {
    if (!content) return '';

    // For LLM outputs and final responses, format as text
    if (type === 'llm_output' || type === 'final_response') {
      return `\`\`\`\n${content}\n\`\`\``;
    }

    // For agent communication, format as a quote
    if (type === 'agent_communication') {
      return `> ${content}`;
    }

    // For test analysis, format as markdown
    if (type === 'test_analysis') {
      return content;
    }

    // Default formatting
    return `\`\`\`\n${content}\n\`\`\``;
  }

  /**
   * Get current log (for debugging)
   */
  getCurrentLog(): DetailedExecutionLog | null {
    return this.currentLog;
  }
}
