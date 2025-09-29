/**
 * Detailed Execution Logger for E2E Tests
 * Captures all execution details and outputs to readable files
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../../src/utils/logger';
import { ReportCleanup } from './report-cleanup';

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

    // Clean up old reports after saving new one
    await ReportCleanup.cleanupReports();

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

    let markdown = `# E2E Test Execution Log\n\n`;
    
    // Header information
    markdown += `## Test Information\n`;
    markdown += `- **Test ID**: ${testId}\n`;
    markdown += `- **Scenario ID**: ${scenarioId}\n`;
    markdown += `- **Status**: ${success ? '✅ PASSED' : '❌ FAILED'}\n`;
    markdown += `- **Start Time**: ${startTime}\n`;
    markdown += `- **End Time**: ${endTime || 'N/A'}\n`;
    markdown += `- **Duration**: ${summary.totalDuration}ms\n\n`;

    // Summary
    markdown += `## Execution Summary\n`;
    markdown += `- **Total LLM Calls**: ${summary.totalLLMCalls}\n`;
    markdown += `- **Total API Calls**: ${summary.totalAPICalls}\n`;
    markdown += `- **Stages Executed**: ${summary.stages.join(', ')}\n\n`;

    // User Input
    markdown += `## Initial User Input\n`;
    markdown += `\`\`\`\n${userInput}\n\`\`\`\n\n`;

    // Execution Entries
    markdown += `## Detailed Execution Log\n\n`;

    let currentStage = '';
    for (const entry of entries) {
      // Add stage header if stage changed
      if (entry.stage && entry.stage !== currentStage) {
        currentStage = entry.stage;
        markdown += `### Stage: ${currentStage}\n\n`;
      }

      // Add entry
      const icon = this.getEntryIcon(entry.type);
      markdown += `#### ${icon} ${entry.type.replace(/_/g, ' ').toUpperCase()}\n`;
      markdown += `**Time**: ${entry.timestamp}\n\n`;
      
      if (entry.metadata) {
        markdown += `**Metadata**:\n\`\`\`json\n${JSON.stringify(entry.metadata, null, 2)}\n\`\`\`\n\n`;
      }

      // Format content based on type
      if (entry.type === 'api_call' || entry.type === 'api_response') {
        markdown += `**Content**:\n\`\`\`\n${entry.content}\n\`\`\`\n\n`;
      } else {
        // For other types, format content more readably
        const formattedContent = this.formatContentForDisplay(entry.content, entry.type);
        markdown += `**Content**:\n${formattedContent}\n\n`;
      }
      
      markdown += `---\n\n`;
    }

    return markdown;
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
