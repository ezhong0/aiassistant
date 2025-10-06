/**
 * Layer 3: Synthesis Service
 *
 * Transforms structured findings from Layer 2 into natural language responses.
 * Production-ready implementation with user preference handling.
 */

import { BaseService } from '../../services/base-service';
import { ExecutionGraph } from '../layer1-decomposition/execution-graph.types';
import { ExecutionResults } from '../layer2-execution/execution.types';
import { SynthesisResult, UserPreferences, ResourceUsage, StructuredFindings } from './synthesis.types';
import { AIDomainService } from '../../services/domain/ai-domain.service';

export class SynthesisService extends BaseService {
  constructor(private aiService: AIDomainService) {
    super('SynthesisService');
  }

  /**
   * Service initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('SynthesisService initialized');
  }

  /**
   * Service cleanup
   */
  protected async onDestroy(): Promise<void> {
    this.logInfo('SynthesisService destroyed');
  }

  /**
   * Synthesize natural language response from structured findings
   * @param originalQuery - Original user query
   * @param executionGraph - The execution graph that was executed
   * @param results - Results from Layer 2 execution
   * @param userPreferences - User preferences for tone and format
   * @returns Natural language response
   */
  async synthesize(
    originalQuery: string,
    executionGraph: ExecutionGraph,
    results: ExecutionResults,
    userPreferences: UserPreferences
  ): Promise<SynthesisResult> {
    const startTime = Date.now();

    this.logInfo('Synthesizing response', {
      query: originalQuery.substring(0, 100),
      nodeCount: results.nodeResults.size
    });

    try {
      // Format findings (remove raw data, keep only summaries)
      const structuredFindings = this.formatFindings(results);

      // Calculate resource usage
      const resourceUsage = this.calculateResourceUsage(results);

      // Build synthesis prompt
      const prompt = this.buildSynthesisPrompt({
        original_query: originalQuery,
        investigation_summary: this.summarizeExecution(executionGraph),
        structured_findings: structuredFindings,
        resource_usage: resourceUsage,
        user_preferences: userPreferences
      });

      // Call LLM to generate natural language response
      const response = await this.aiService.chat({
        messages: [
          { role: 'system', content: this.getSystemPrompt(userPreferences) },
          { role: 'user', content: prompt }
        ],
        maxTokens: 2000, // Bounded output
        temperature: 0.7
      });

      const synthesisTime = Date.now() - startTime;

      this.logInfo('Synthesis complete', {
        synthesisTimeMs: synthesisTime,
        findingsCount: structuredFindings.information_gathered.length,
        responseLength: response.content.length
      });

      return {
        message: response.content,
        metadata: {
          tokens_used: this.estimateTokens(prompt) + 2000,
          findings_count: structuredFindings.information_gathered.length,
          synthesis_time_ms: synthesisTime
        }
      };
    } catch (error: any) {
      this.logError('Error synthesizing response', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate total resource usage from execution
   */
  private calculateResourceUsage(results: ExecutionResults): ResourceUsage {
    let totalTokens = 0;
    let totalLlmCalls = 0;
    let nodesFailed = 0;
    let totalTimeSeconds = 0;

    for (const result of results.nodeResults.values()) {
      totalTokens += result.tokens_used || 0;
      if (result.data?.metadata?.llm_calls) {
        totalLlmCalls += result.data.metadata.llm_calls as number;
      }
      if (result.data?.metadata?.execution_time_ms) {
        totalTimeSeconds += (result.data.metadata.execution_time_ms as number) / 1000;
      }
      if (!result.success) {
        nodesFailed++;
      }
    }

    return {
      total_tokens: totalTokens,
      total_llm_calls: totalLlmCalls,
      total_time_seconds: totalTimeSeconds,
      total_cost_usd: totalTokens * 0.00000015, // Rough estimate
      nodes_executed: results.nodeResults.size,
      nodes_failed: nodesFailed
    };
  }

  /**
   * Format findings for synthesis prompt (remove raw data)
   */
  private formatFindings(results: ExecutionResults): StructuredFindings {
    const information_gathered = [];

    for (const [nodeId, result] of results.nodeResults.entries()) {
      if (!result.success || !result.data) {
        // Skip failed nodes
        continue;
      }

      const data = result.data;

      // Extract summary and key findings, limiting items
      const summary = data.summary || this.generateSummary(data);
      const key_findings = this.extractKeyFindings(data);

      information_gathered.push({
        node_id: nodeId,
        node_description: String(data.description ?? ''),
        summary,
        key_findings: key_findings.slice(0, 10), // Limit to top 10 items
        item_count: data.count || data.items?.length || 0
      });
    }

    return { information_gathered };
  }

  /**
   * Generate summary from node data
   */
  private generateSummary(data: any): string {
    if (data.count !== undefined) {
      return `Found ${data.count} item(s)`;
    }
    if (data.operation_summary) {
      return `${data.operation_summary.operation_type}: ${data.operation_summary.items_after_filtering} items`;
    }
    if (data.analysis_summary) {
      return `Analyzed ${data.analysis_summary.total_items_analyzed} items`;
    }
    return 'Data retrieved';
  }

  /**
   * Extract key findings from node data (structured summaries only)
   */
  private extractKeyFindings(data: any): any[] {
    // For different strategy types, extract relevant structured data
    if (data.items && Array.isArray(data.items)) {
      // Metadata/keyword search results - keep only essential fields
      return data.items.map((item: any) => ({
        id: item.id,
        subject: item.subject,
        from: item.from,
        date: item.date,
        snippet: item.snippet?.substring(0, 150) // Truncate snippets
      }));
    }

    if (data.threads && Array.isArray(data.threads)) {
      // Thread analysis results - keep summaries only
      return data.threads.map((thread: any) => ({
        thread_id: thread.thread_id,
        context: thread.context?.substring(0, 100), // Truncate context to 100 chars
        urgency: thread.urgency_signals?.level,
        has_question: thread.question_or_request?.present,
        waiting: thread.waiting_indicators?.present
      }));
    }

    if (data.ranked_results && Array.isArray(data.ranked_results)) {
      // Cross-reference results
      return data.ranked_results.map((item: any) => ({
        item_id: item.item_id,
        rank: item.rank,
        score: item.score,
        reason: item.ranking_reason
      }));
    }

    if (data.item_results && Array.isArray(data.item_results)) {
      // Semantic analysis results
      return data.item_results.map((item: any) => ({
        item_id: item.item_id,
        intent: item.intent_classification,
        urgency: item.urgency_level,
        directed_at_user: item.directed_at_user
      }));
    }

    return [];
  }

  /**
   * Summarize execution graph for context
   */
  private summarizeExecution(graph: ExecutionGraph): string {
    const classification = graph.query_classification;
    const nodeCount = graph.information_needs.length;
    const domains = classification.domains.join(', ');

    return `Executed ${nodeCount} information gathering step(s) across ${domains}. Query type: ${classification.type}.`;
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(input: {
    original_query: string;
    investigation_summary: string;
    structured_findings: StructuredFindings;
    resource_usage: ResourceUsage;
    user_preferences: UserPreferences;
  }): string {
    let prompt = `ORIGINAL USER QUERY:\n${input.original_query}\n\n`;

    prompt += `INVESTIGATION SUMMARY:\n${input.investigation_summary}\n\n`;

    prompt += `STRUCTURED FINDINGS:\n`;
    for (const finding of input.structured_findings.information_gathered) {
      prompt += `\n--- ${finding.node_id} ---\n`;
      prompt += `Summary: ${finding.summary}\n`;
      if (finding.item_count) {
        prompt += `Items: ${finding.item_count}\n`;
      }
      if (finding.key_findings && finding.key_findings.length > 0) {
        prompt += `Key findings:\n`;
        prompt += JSON.stringify(finding.key_findings, null, 2).substring(0, 1000) + '\n';
      }
    }

    prompt += `\nRESOURCE USAGE:\n`;
    prompt += `- Nodes executed: ${input.resource_usage.nodes_executed}\n`;
    prompt += `- Total findings: ${input.structured_findings.information_gathered.length}\n`;

    prompt += `\nTASK:\n`;
    prompt += `Generate a natural language response to the user's query based on the structured findings above.\n`;

    // Add user preference hints
    if (input.user_preferences.verbosity === 'brief') {
      prompt += `Keep the response brief and to the point.\n`;
    } else if (input.user_preferences.verbosity === 'detailed') {
      prompt += `Provide a detailed response with context and explanations.\n`;
    }

    if (input.user_preferences.format_preference === 'bullets') {
      prompt += `Use bullet points to organize the information.\n`;
    } else if (input.user_preferences.format_preference === 'prose') {
      prompt += `Use natural flowing prose.\n`;
    }

    prompt += `\nProvide a helpful, accurate response based solely on the findings provided.`;

    return prompt;
  }

  /**
   * Get system prompt based on user preferences
   */
  private getSystemPrompt(userPreferences: UserPreferences): string {
    let systemPrompt = 'You are a helpful AI assistant that synthesizes information from structured data sources.';

    if (userPreferences.tone === 'professional') {
      systemPrompt += ' Use a professional and formal tone.';
    } else if (userPreferences.tone === 'casual') {
      systemPrompt += ' Use a friendly and casual tone.';
    } else if (userPreferences.tone === 'concise') {
      systemPrompt += ' Be concise and direct.';
    }

    systemPrompt += ' Never invent information not present in the findings.';
    systemPrompt += ' If the findings are insufficient, acknowledge this clearly.';

    return systemPrompt;
  }

  /**
   * Estimate token count for a prompt
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  getHealth() {
    return {
      healthy: true,
      service: 'SynthesisService',
      status: 'operational'
    };
  }
}
