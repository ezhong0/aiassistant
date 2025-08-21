import { ToolMetadata } from '../types/agent.types';
import { ThinkAgent } from '../agents/think.agent';
import { EmailAgentWrapper } from '../agents/email.agent.registry';
import { ContactAgentWrapper } from '../agents/contact.agent.registry';
import { CalendarAgent } from '../agents/calendar.agent';
import { ContentCreatorAgent } from '../agents/content-creator.agent';
import { TavilyAgent } from '../agents/tavily.agent';

/**
 * Centralized tool definitions configuration
 * Add new tools here to automatically register them with the system
 */
export const TOOL_DEFINITIONS: ToolMetadata[] = [
  {
    name: 'Think',
    description: 'Analyze and reason about user requests, verify correct actions were taken',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The query or request to analyze and think about'
        },
        context: {
          type: 'string',
          description: 'Additional context for analysis',
          nullable: true
        },
        previousActions: {
          type: 'array',
          description: 'Previous tool calls that were executed',
          items: { type: 'object' },
          nullable: true
        }
      },
      required: ['query']
    },
    keywords: ['think', 'analyze', 'reason', 'verify', 'check'],
    requiresConfirmation: false,
    isCritical: false,
    agentClass: ThinkAgent
  },
  {
    name: 'emailAgent',
    description: 'Send, reply to, search, and manage emails using Gmail API',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The email request in natural language'
        },
        contacts: {
          type: 'array',
          description: 'Contact information if provided by contact agent',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string', nullable: true }
            }
          },
          nullable: true
        },
        contactResults: {
          type: 'array',
          description: 'Raw contact results from contact agent',
          items: { type: 'object' },
          nullable: true
        }
      },
      required: ['query']
    },
    keywords: ['email', 'send', 'reply', 'draft', 'message', 'mail', 'gmail'],
    requiresConfirmation: true,
    isCritical: true,
    agentClass: EmailAgentWrapper
  },
  {
    name: 'contactAgent',
    description: 'Search and manage contacts from Google Contacts and email history',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The contact search request in natural language'
        },
        operation: {
          type: 'string',
          description: 'The type of operation to perform',
          enum: ['search', 'create', 'update'],
          nullable: true
        }
      },
      required: ['query']
    },
    keywords: ['contact', 'find', 'lookup', 'search', 'person', 'email address'],
    requiresConfirmation: false,
    isCritical: true,
    agentClass: ContactAgentWrapper
  },
  {
    name: 'calendarAgent',
    description: 'Create, update, and manage calendar events',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The calendar request in natural language'
        },
        title: {
          type: 'string',
          description: 'Event title',
          nullable: true
        },
        startTime: {
          type: 'string',
          description: 'Event start time in ISO format',
          nullable: true
        },
        endTime: {
          type: 'string',
          description: 'Event end time in ISO format',
          nullable: true
        },
        attendees: {
          type: 'array',
          description: 'List of attendee email addresses',
          items: { type: 'string' },
          nullable: true
        },
        description: {
          type: 'string',
          description: 'Event description',
          nullable: true
        }
      },
      required: ['query']
    },
    keywords: ['calendar', 'meeting', 'schedule', 'event', 'appointment', 'book'],
    requiresConfirmation: true,
    isCritical: true,
    agentClass: CalendarAgent
  },
  {
    name: 'contentCreator',
    description: 'Create blog posts, articles, and other written content',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The content creation request in natural language'
        },
        topic: {
          type: 'string',
          description: 'The main topic or subject',
          nullable: true
        },
        tone: {
          type: 'string',
          description: 'The desired tone (professional, casual, etc.)',
          nullable: true
        },
        length: {
          type: 'string',
          description: 'Desired length (short, medium, long)',
          nullable: true
        },
        format: {
          type: 'string',
          description: 'Content format',
          enum: ['blog', 'article', 'social', 'email'],
          nullable: true
        }
      },
      required: ['query']
    },
    keywords: ['blog', 'write', 'create', 'content', 'article', 'post', 'draft'],
    requiresConfirmation: false,
    isCritical: false,
    agentClass: ContentCreatorAgent
  },
  {
    name: 'Tavily',
    description: 'Search the web for information using Tavily API',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
          nullable: true
        },
        includeAnswer: {
          type: 'boolean',
          description: 'Whether to include AI-generated answer',
          nullable: true
        },
        searchDepth: {
          type: 'string',
          description: 'Search depth level',
          enum: ['basic', 'advanced'],
          nullable: true
        }
      },
      required: ['query']
    },
    keywords: ['search', 'web', 'find', 'lookup', 'internet', 'what is', 'who is'],
    requiresConfirmation: false,
    isCritical: false,
    agentClass: TavilyAgent
  }
];

/**
 * Helper function to get tool definition by name
 */
export function getToolDefinition(name: string): ToolMetadata | undefined {
  return TOOL_DEFINITIONS.find(tool => tool.name === name);
}

/**
 * Helper function to get all tool names
 */
export function getAllToolNames(): string[] {
  return TOOL_DEFINITIONS.map(tool => tool.name);
}

/**
 * Helper function to get tools that require confirmation
 */
export function getConfirmationTools(): string[] {
  return TOOL_DEFINITIONS
    .filter(tool => tool.requiresConfirmation)
    .map(tool => tool.name);
}

/**
 * Helper function to get critical tools
 */
export function getCriticalTools(): string[] {
  return TOOL_DEFINITIONS
    .filter(tool => tool.isCritical)
    .map(tool => tool.name);
}