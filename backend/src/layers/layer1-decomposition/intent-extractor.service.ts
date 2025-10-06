/**
 * Intent Extractor
 *
 * Simplified Layer 1: Extracts semantic intent from user query.
 * NO knowledge of Gmail API syntax, execution graphs, or technical constraints.
 * Just understands WHAT the user wants in simple terms.
 */

import { AIDomainService } from '../../services/domain/ai-domain.service';
import { QueryIntent, IntentExtractionResult } from './query-intent.types';
import { DecompositionInput } from './execution-graph.types';

export class IntentExtractorService {
  constructor(private aiDomainService: AIDomainService) {
    console.log('🔍 DEBUG: IntentExtractorService constructor called');
    console.log('🔍 DEBUG: aiDomainService =', aiDomainService);
    console.log('🔍 DEBUG: aiDomainService type =', typeof aiDomainService);
  }

  async extractIntent(input: DecompositionInput): Promise<IntentExtractionResult> {
    console.log('🔍 DEBUG: extractIntent() called, aiDomainService =', this.aiDomainService);
    console.log('🔍 DEBUG: aiDomainService.executePrompt =', this.aiDomainService?.executePrompt);
    const prompt = this.buildIntentExtractionPrompt(input);
    const schema = this.getIntentSchema();

    // Simple LLM call - just extract semantic intent
    const response = await this.aiDomainService.executePrompt<QueryIntent>(
      {
        systemPrompt: this.getSystemPrompt(),
        userPrompt: prompt,
        options: {
          temperature: 0.2,
          maxTokens: 2000,
          model: 'gpt-5-mini' // Good balance of cost/quality for understanding
        }
      },
      schema,
      'IntentExtractor'
    );

    return {
      intent: response.parsed,
      confidence: 85, // Could analyze this from response
    };
  }

  private getSystemPrompt(): string {
    return `You extract user intent from natural language queries about email and calendar.

Your job is to understand WHAT the user wants, not HOW to get it.
Output simple, semantic criteria - no technical details like API syntax.

Focus on:
- What action they want (filter, summarize, schedule, etc.)
- What criteria matter (urgency, sender type, time, etc.)
- How they want results (format, sorting, grouping)

Do NOT think about:
- Gmail API syntax
- Execution order
- Technical implementation`;
  }

  private buildIntentExtractionPrompt(input: DecompositionInput): string {
    return `Extract the user's intent from this query.

User Query: "${input.user_query}"

Current Time: ${input.current_timestamp}

Examples of intent extraction:

Query: "Show me urgent emails"
Intent:
{
  "action": "filter_emails",
  "criteria": [
    {"type": "urgency", "value": "high"}
  ],
  "time_frame": "recent"
}

Query: "What haven't I responded to from investors?"
Intent:
{
  "action": "filter_emails",
  "criteria": [
    {"type": "requires_response", "value": true},
    {"type": "sender_type", "value": "investor"}
  ],
  "scope": "inbox"
}

Query: "Show me emails from Michael Roberts"
Intent:
{
  "action": "filter_emails",
  "criteria": [
    {"type": "sender_name", "value": "Michael Roberts"}
  ]
}

Query: "Find emails about data sync from last week"
Intent:
{
  "action": "filter_emails",
  "criteria": [
    {"type": "subject_contains", "value": "data sync"}
  ],
  "time_frame": "last_7d"
}

Query: "What's on my calendar today?"
Intent:
{
  "action": "filter_calendar",
  "criteria": [],
  "time_frame": "today"
}

Now extract intent from the user's query above.`;
  }

  private getIntentSchema(): any {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'filter_emails',
            'filter_calendar',
            'summarize_thread',
            'find_commitment',
            'schedule_meeting',
            'send_reply',
            'label_emails',
            'archive_emails',
            'search_context'
          ]
        },
        criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              value: { type: ['string', 'boolean', 'number'] },
              modifier: { type: 'string', enum: ['NOT', 'HIGH', 'LOW', 'ANY'] },
              confidence: { type: 'number' }
            },
            required: ['type', 'value']
          }
        },
        scope: {
          type: 'string',
          enum: ['inbox', 'sent', 'all', 'archive', 'important']
        },
        time_frame: { type: 'string' },
        output: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['list', 'summary', 'count', 'grouped'] },
            max_results: { type: 'number' },
            sort_by: { type: 'string', enum: ['date', 'relevance', 'urgency', 'sender'] },
            group_by: { type: 'string', enum: ['sender', 'thread', 'date', 'label'] }
          }
        },
        context: {
          type: 'object',
          properties: {
            thread_id: { type: 'string' },
            reference_emails: { type: 'array', items: { type: 'string' } },
            mentioned_people: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['action', 'criteria']
    };
  }
}
