/**
 * Unified Tool Registry
 * 
 * Centralized tool definitions that serve as the single source of truth
 * for all tool-related information across the system.
 */

// import { z } from 'zod';

/**
 * Tool parameter schema definition
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
  format?: string; // e.g., 'email', 'datetime'
  items?: ToolParameterSchema; // for arrays
  properties?: Record<string, ToolParameterSchema>; // for objects
}

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameterSchema>;
  requiredParameters: string[];
  domains: Array<'email' | 'calendar' | 'contacts' | 'slack'>;
  serviceMethod: string;
  requiresAuth: boolean;
  requiresConfirmation: boolean;
  isCritical: boolean;
  examples: string[];
}

// Tool execution context moved to tool-execution.ts

// Tool execution result moved to tool-execution.ts

/**
 * Unified Tool Registry
 * Single source of truth for all tool definitions
 */
export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a tool definition
   */
  static registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get tool definition by name
   */
  static getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools for a domain
   */
  static getToolsForDomain(domain: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.domains.includes(domain as any));
  }

  /**
   * Get all registered tools
   */
  static getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names for a domain
   */
  static getToolNamesForDomain(domain: string): string[] {
    return this.getToolsForDomain(domain).map(tool => tool.name);
  }

  /**
   * Generate tool definitions string for prompts
   */
  static generateToolDefinitionsForDomain(domain: string): string {
    const tools = this.getToolsForDomain(domain);
    if (tools.length === 0) {
      return 'No tools available for this domain.';
    }

    return tools.map(tool => {
      const params = Object.entries(tool.parameters)
        .map(([name, schema]) => {
          const required = tool.requiredParameters.includes(name) ? '' : '?';
          const type = this.getTypeString(schema);
          return `${name}${required}: ${type}`;
        })
        .join(', ');

      return `- ${tool.name}(${params}): ${tool.description}`;
    }).join('\n');
  }

  /**
   * Generate tool metadata for agent capabilities
   */
  static generateToolMetadataForDomain(domain: string): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    requiresConfirmation: boolean;
    isCritical: boolean;
  }> {
    return this.getToolsForDomain(domain).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: this.convertToOpenAPISchema(tool.parameters),
        required: tool.requiredParameters,
      },
      requiresConfirmation: tool.requiresConfirmation,
      isCritical: tool.isCritical,
    }));
  }

  /**
   * Validate tool parameters against schema
   */
  static validateToolParameters(toolName: string, parameters: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { valid: false, errors: [`Unknown tool: ${toolName}`] };
    }

    const errors: string[] = [];

    // Check required parameters
    for (const requiredParam of tool.requiredParameters) {
      if (!(requiredParam in parameters)) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Validate parameter types
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const schema = tool.parameters[paramName];
      if (!schema) {
        errors.push(`Unknown parameter: ${paramName}`);
        continue;
      }

      const validation = this.validateParameterValue(paramName, paramValue, schema);
      if (!validation.valid) {
        errors.push(...validation.errors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get type string for parameter schema
   */
  private static getTypeString(schema: ToolParameterSchema): string {
    if (schema.enum) {
      return schema.enum.join(' | ');
    }
    if (schema.type === 'array' && schema.items) {
      return `${this.getTypeString(schema.items)}[]`;
    }
    if (schema.type === 'object' && schema.properties) {
      const props = Object.entries(schema.properties)
        .map(([name, prop]) => `${name}: ${this.getTypeString(prop)}`)
        .join(', ');
      return `{ ${props} }`;
    }
    return schema.type;
  }

  /**
   * Convert tool parameters to OpenAPI schema format
   */
  private static convertToOpenAPISchema(parameters: Record<string, ToolParameterSchema>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, schema] of Object.entries(parameters)) {
      result[name] = {
        type: schema.type,
        description: schema.description,
        ...(schema.enum && { enum: schema.enum }),
        ...(schema.format && { format: schema.format }),
        ...(schema.items && { items: this.convertToOpenAPISchema({ item: schema.items }).item }),
        ...(schema.properties && { properties: this.convertToOpenAPISchema(schema.properties) }),
      };
    }
    
    return result;
  }

  /**
   * Validate parameter value against schema
   */
  private static validateParameterValue(
    paramName: string, 
    value: unknown, 
    schema: ToolParameterSchema,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      if (schema.required) {
        errors.push(`${paramName} is required`);
      }
      return { valid: errors.length === 0, errors };
    }

    // Type validation
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${paramName} must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          errors.push(`${paramName} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${paramName} must be a boolean`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${paramName} must be an array`);
        } else if (schema.items) {
          value.forEach((item, index) => {
            const itemValidation = this.validateParameterValue(`${paramName}[${index}]`, item, schema.items!);
            if (!itemValidation.valid) {
              errors.push(...itemValidation.errors);
            }
          });
        }
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${paramName} must be an object`);
        } else if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const objValue = value as Record<string, unknown>;
            const propValidation = this.validateParameterValue(`${paramName}.${propName}`, objValue[propName], propSchema);
            if (!propValidation.valid) {
              errors.push(...propValidation.errors);
            }
          }
        }
        break;
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value as string)) {
      errors.push(`${paramName} must be one of: ${schema.enum.join(', ')}`);
    }

    // Format validation
    if (schema.format === 'email' && typeof value === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push(`${paramName} must be a valid email address`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Tool definitions for all domains
 */

// Email Tools
ToolRegistry.registerTool({
  name: 'send_email',
  description: 'Send an email to one or more recipients',
  parameters: {
    to: { type: 'string', description: 'Recipient email address', required: true, format: 'email' },
    subject: { type: 'string', description: 'Email subject', required: true },
    body: { type: 'string', description: 'Email body content', required: true },
    cc: { type: 'array', description: 'CC recipients', items: { type: 'string', description: 'CC email address', format: 'email' } },
    bcc: { type: 'array', description: 'BCC recipients', items: { type: 'string', description: 'BCC email address', format: 'email' } },
  },
  requiredParameters: ['to', 'subject', 'body'],
  domains: ['email'],
  serviceMethod: 'sendEmail',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: true,
  examples: [
    'Send an email to john@example.com with subject "Meeting" and body "Let\'s meet tomorrow"',
    'Send an email to the team about the project update',
  ],
});

ToolRegistry.registerTool({
  name: 'search_emails',
  description: 'Search for emails using a query (supports cross-account search)',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
    maxResults: { type: 'number', description: 'Maximum number of results to return' },
    account_ids: {
      type: 'array',
      description: 'Array of email account IDs to search (optional, searches default account if not provided)',
      items: { type: 'string', description: 'Account ID' }
    },
  },
  requiredParameters: ['query'],
  domains: ['email'],
  serviceMethod: 'searchEmails',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Search for emails from Sarah about budget',
    'Find all emails with attachments from last week',
    'Search across all accounts for newsletters',
  ],
});

ToolRegistry.registerTool({
  name: 'get_email',
  description: 'Get a specific email by message ID',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID', required: true },
  },
  requiredParameters: ['messageId'],
  domains: ['email'],
  serviceMethod: 'getEmail',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Get the email with message ID abc123',
    'Retrieve the latest email from my inbox',
  ],
});

ToolRegistry.registerTool({
  name: 'reply_to_email',
  description: 'Reply to a specific email',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID to reply to', required: true },
    replyBody: { type: 'string', description: 'Reply message content', required: true },
  },
  requiredParameters: ['messageId', 'replyBody'],
  domains: ['email'],
  serviceMethod: 'replyToEmail',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: true,
  examples: [
    'Reply to the email with message ID abc123',
    'Send a reply to the latest email in my inbox',
  ],
});

ToolRegistry.registerTool({
  name: 'get_email_thread',
  description: 'Get an email thread by thread ID',
  parameters: {
    threadId: { type: 'string', description: 'Email thread ID', required: true },
  },
  requiredParameters: ['threadId'],
  domains: ['email'],
  serviceMethod: 'getEmailThread',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Get the full conversation thread about the proposal',
    'Retrieve all messages in the thread with ID xyz789',
  ],
});

ToolRegistry.registerTool({
  name: 'archive_email',
  description: 'Archive an email (move to archive, remove from inbox)',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID to archive', required: true },
  },
  requiredParameters: ['messageId'],
  domains: ['email'],
  serviceMethod: 'archiveEmail',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Archive the email from Sarah about the budget',
    'Move this email to archive',
  ],
});

ToolRegistry.registerTool({
  name: 'mark_read',
  description: 'Mark an email as read',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID to mark as read', required: true },
  },
  requiredParameters: ['messageId'],
  domains: ['email'],
  serviceMethod: 'markRead',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Mark the latest email as read',
    'Mark all emails from today as read',
  ],
});

ToolRegistry.registerTool({
  name: 'mark_unread',
  description: 'Mark an email as unread',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID to mark as unread', required: true },
  },
  requiredParameters: ['messageId'],
  domains: ['email'],
  serviceMethod: 'markUnread',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Mark this email as unread so I remember to respond',
    'Flag the email from John as unread',
  ],
});

ToolRegistry.registerTool({
  name: 'star_email',
  description: 'Star an email (add star/flag for importance)',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID to star', required: true },
  },
  requiredParameters: ['messageId'],
  domains: ['email'],
  serviceMethod: 'starEmail',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Star the email from the CEO',
    'Add a star to this important message',
  ],
});

ToolRegistry.registerTool({
  name: 'unstar_email',
  description: 'Remove star from an email',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID to unstar', required: true },
  },
  requiredParameters: ['messageId'],
  domains: ['email'],
  serviceMethod: 'unstarEmail',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Unstar the email from yesterday',
    'Remove the star from this email',
  ],
});

ToolRegistry.registerTool({
  name: 'create_label',
  description: 'Create a new email label/category',
  parameters: {
    name: { type: 'string', description: 'Label name', required: true },
    color: { type: 'string', description: 'Label color (optional)' },
  },
  requiredParameters: ['name'],
  domains: ['email'],
  serviceMethod: 'createLabel',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Create a label called "Important Projects"',
    'Add a new category for client emails',
  ],
});

ToolRegistry.registerTool({
  name: 'add_label_to_email',
  description: 'Add a label to an email',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID', required: true },
    labelId: { type: 'string', description: 'Label ID to add', required: true },
  },
  requiredParameters: ['messageId', 'labelId'],
  domains: ['email'],
  serviceMethod: 'addLabel',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Label this email as "Important"',
    'Add the "Follow Up" label to this message',
  ],
});

ToolRegistry.registerTool({
  name: 'remove_label_from_email',
  description: 'Remove a label from an email',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID', required: true },
    labelId: { type: 'string', description: 'Label ID to remove', required: true },
  },
  requiredParameters: ['messageId', 'labelId'],
  domains: ['email'],
  serviceMethod: 'removeLabel',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Remove the "Urgent" label from this email',
    'Unlabel this message',
  ],
});

ToolRegistry.registerTool({
  name: 'get_attachment',
  description: 'Download an email attachment',
  parameters: {
    messageId: { type: 'string', description: 'Email message ID', required: true },
    attachmentId: { type: 'string', description: 'Attachment ID', required: true },
  },
  requiredParameters: ['messageId', 'attachmentId'],
  domains: ['email'],
  serviceMethod: 'downloadAttachment',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Download the PDF attachment from the contract email',
    'Get the attachment from Sarah\'s email',
  ],
});

// Calendar Tools
ToolRegistry.registerTool({
  name: 'create_event',
  description: 'Create a new calendar event',
  parameters: {
    title: { type: 'string', description: 'Event title', required: true },
    start: { type: 'string', description: 'Event start time (ISO 8601)', required: true, format: 'datetime' },
    end: { type: 'string', description: 'Event end time (ISO 8601)', required: true, format: 'datetime' },
    attendees: { type: 'array', description: 'Event attendees', items: { type: 'string', description: 'Attendee email', format: 'email' } },
    description: { type: 'string', description: 'Event description' },
    location: { type: 'string', description: 'Event location' },
  },
  requiredParameters: ['title', 'start', 'end'],
  domains: ['calendar'],
  serviceMethod: 'createEvent',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: false,
  examples: [
    'Create a meeting with John tomorrow at 2pm',
    'Schedule a team standup for next Monday at 9am',
  ],
});

ToolRegistry.registerTool({
  name: 'list_events',
  description: 'List calendar events in a date range (supports multiple calendars)',
  parameters: {
    start: { type: 'string', description: 'Start date (ISO 8601)', required: true, format: 'datetime' },
    end: { type: 'string', description: 'End date (ISO 8601)', required: true, format: 'datetime' },
    calendar_ids: {
      type: 'array',
      description: 'Array of calendar IDs to search (optional, searches default calendar if not provided)',
      items: { type: 'string', description: 'Calendar ID' }
    },
  },
  requiredParameters: ['start', 'end'],
  domains: ['calendar'],
  serviceMethod: 'listEvents',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'List all my events for next Monday',
    'Show my calendar for this week',
    'List events across all my calendars for tomorrow',
  ],
});

ToolRegistry.registerTool({
  name: 'get_event',
  description: 'Get a specific calendar event by ID',
  parameters: {
    eventId: { type: 'string', description: 'Event ID', required: true },
    calendarId: { type: 'string', description: 'Calendar ID' },
  },
  requiredParameters: ['eventId'],
  domains: ['calendar'],
  serviceMethod: 'getEvent',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Get details for the meeting with ID abc123',
    'Retrieve information about the project review event',
  ],
});

ToolRegistry.registerTool({
  name: 'update_event',
  description: 'Update an existing calendar event',
  parameters: {
    eventId: { type: 'string', description: 'Event ID to update', required: true },
    updates: { type: 'object', description: 'Event updates', properties: {
      title: { type: 'string', description: 'New event title' },
      start: { type: 'string', description: 'New start time', format: 'datetime' },
      end: { type: 'string', description: 'New end time', format: 'datetime' },
      attendees: { type: 'array', description: 'New attendees', items: { type: 'string', description: 'Attendee email', format: 'email' } },
      description: { type: 'string', description: 'New description' },
      location: { type: 'string', description: 'New location' },
    } },
  },
  requiredParameters: ['eventId', 'updates'],
  domains: ['calendar'],
  serviceMethod: 'updateEvent',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: false,
  examples: [
    'Update the project meeting to include Sarah',
    'Change the meeting time to 3pm',
  ],
});

ToolRegistry.registerTool({
  name: 'delete_event',
  description: 'Delete a calendar event',
  parameters: {
    eventId: { type: 'string', description: 'Event ID to delete', required: true },
    calendarId: { type: 'string', description: 'Calendar ID' },
  },
  requiredParameters: ['eventId'],
  domains: ['calendar'],
  serviceMethod: 'deleteEvent',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: false,
  examples: [
    'Cancel the meeting with ID abc123',
    'Delete the project review event',
  ],
});

ToolRegistry.registerTool({
  name: 'check_availability',
  description: 'Check availability for attendees',
  parameters: {
    attendees: { type: 'array', description: 'Attendees to check', required: true, items: { type: 'string', description: 'Attendee email', format: 'email' } },
    start: { type: 'string', description: 'Start time', required: true, format: 'datetime' },
    end: { type: 'string', description: 'End time', required: true, format: 'datetime' },
  },
  requiredParameters: ['attendees', 'start', 'end'],
  domains: ['calendar'],
  serviceMethod: 'checkAvailability',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Check if I\'m available Friday afternoon',
    'See if John and Sarah are free tomorrow at 2pm',
  ],
});

ToolRegistry.registerTool({
  name: 'find_available_slots',
  description: 'Find available time slots for a meeting',
  parameters: {
    attendees: { type: 'array', description: 'Attendees', required: true, items: { type: 'string', description: 'Attendee email', format: 'email' } },
    duration: { type: 'number', description: 'Meeting duration in minutes', required: true },
    start: { type: 'string', description: 'Search start time', required: true, format: 'datetime' },
    end: { type: 'string', description: 'Search end time', required: true, format: 'datetime' },
  },
  requiredParameters: ['attendees', 'duration', 'start', 'end'],
  domains: ['calendar'],
  serviceMethod: 'findAvailableSlots',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Find available 2-hour slots next month for 8 board members',
    'Show me free time slots for a 1-hour meeting this week',
  ],
});

ToolRegistry.registerTool({
  name: 'list_calendars',
  description: 'List available calendars',
  parameters: {},
  requiredParameters: [],
  domains: ['calendar'],
  serviceMethod: 'listCalendars',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Show me all my calendars',
    'List available calendars for scheduling',
  ],
});

ToolRegistry.registerTool({
  name: 'respond_to_event',
  description: 'Respond to a calendar event invitation (accept, decline, or tentative)',
  parameters: {
    eventId: { type: 'string', description: 'Event ID to respond to', required: true },
    response: {
      type: 'string',
      description: 'Response type',
      required: true,
      enum: ['accepted', 'declined', 'tentative']
    },
    calendarId: { type: 'string', description: 'Calendar ID (optional)' },
  },
  requiredParameters: ['eventId', 'response'],
  domains: ['calendar'],
  serviceMethod: 'respondToEvent',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Accept the meeting invitation from John',
    'Decline the team standup for tomorrow',
    'Mark the project review as tentative',
  ],
});

// Contact Tools
ToolRegistry.registerTool({
  name: 'search_contacts',
  description: 'Search for contacts by name or email',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  requiredParameters: ['query'],
  domains: ['email', 'calendar'],
  serviceMethod: 'searchContacts',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Search for contact information for David Smith',
    'Find contacts with email containing @company.com',
  ],
});

ToolRegistry.registerTool({
  name: 'get_contact',
  description: 'Get a specific contact by ID',
  parameters: {
    contactId: { type: 'string', description: 'Contact ID', required: true },
  },
  requiredParameters: ['contactId'],
  domains: ['email', 'calendar'],
  serviceMethod: 'getContact',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Get contact details for ID abc123',
    'Retrieve information about John Doe',
  ],
});

ToolRegistry.registerTool({
  name: 'list_contacts',
  description: 'List all contacts',
  parameters: {
    maxResults: { type: 'number', description: 'Maximum number of results' },
  },
  requiredParameters: [],
  domains: ['email', 'calendar'],
  serviceMethod: 'listContacts',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Show me all my contacts',
    'List the first 50 contacts',
  ],
});

ToolRegistry.registerTool({
  name: 'create_contact',
  description: 'Create a new contact',
  parameters: {
    name: { type: 'string', description: 'Contact name', required: true },
    email: { type: 'string', description: 'Contact email', format: 'email' },
    phone: { type: 'string', description: 'Contact phone number' },
  },
  requiredParameters: ['name'],
  domains: ['email', 'calendar'],
  serviceMethod: 'createContact',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: false,
  examples: [
    'Create a new contact for Jane Smith',
    'Add John Doe to my contacts with email john@example.com',
  ],
});

ToolRegistry.registerTool({
  name: 'update_contact',
  description: 'Update an existing contact',
  parameters: {
    contactId: { type: 'string', description: 'Contact ID to update', required: true },
    updates: { type: 'object', description: 'Contact updates', properties: {
      name: { type: 'string', description: 'New name' },
      email: { type: 'string', description: 'New email', format: 'email' },
      phone: { type: 'string', description: 'New phone number' },
    } },
  },
  requiredParameters: ['contactId', 'updates'],
  domains: ['email', 'calendar'],
  serviceMethod: 'updateContact',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: false,
  examples: [
    'Update John\'s phone number',
    'Change Sarah\'s email address',
  ],
});

ToolRegistry.registerTool({
  name: 'delete_contact',
  description: 'Delete a contact',
  parameters: {
    contactId: { type: 'string', description: 'Contact ID to delete', required: true },
  },
  requiredParameters: ['contactId'],
  domains: ['email', 'calendar'],
  serviceMethod: 'deleteContact',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: false,
  examples: [
    'Delete the contact with ID abc123',
    'Remove John Doe from my contacts',
  ],
});

// Slack Tools
ToolRegistry.registerTool({
  name: 'send_message',
  description: 'Send a message to a Slack channel',
  parameters: {
    channel: { type: 'string', description: 'Channel ID or name', required: true },
    text: { type: 'string', description: 'Message text', required: true },
    threadTs: { type: 'string', description: 'Thread timestamp for replies' },
  },
  requiredParameters: ['channel', 'text'],
  domains: ['slack'],
  serviceMethod: 'sendMessage',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Send a message to the #general channel',
    'Post an update to the team about the project',
  ],
});

ToolRegistry.registerTool({
  name: 'get_channel_history',
  description: 'Get recent messages from a Slack channel',
  parameters: {
    channel: { type: 'string', description: 'Channel ID or name', required: true },
    limit: { type: 'number', description: 'Maximum number of messages to retrieve' },
  },
  requiredParameters: ['channel'],
  domains: ['slack'],
  serviceMethod: 'getChannelHistory',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Read the latest messages from the #general channel',
    'Get the last 20 messages from #project-updates',
  ],
});

ToolRegistry.registerTool({
  name: 'get_thread_replies',
  description: 'Get replies to a specific thread',
  parameters: {
    channel: { type: 'string', description: 'Channel ID or name', required: true },
    threadTs: { type: 'string', description: 'Thread timestamp', required: true },
  },
  requiredParameters: ['channel', 'threadTs'],
  domains: ['slack'],
  serviceMethod: 'getThreadReplies',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Get the conversation thread about yesterday\'s meeting',
    'Show all replies to the project update message',
  ],
});

ToolRegistry.registerTool({
  name: 'get_user_info',
  description: 'Get information about a Slack user',
  parameters: {
    userId: { type: 'string', description: 'User ID', required: true },
  },
  requiredParameters: ['userId'],
  domains: ['slack'],
  serviceMethod: 'getUserInfo',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Find information about user John in Slack',
    'Get details for user ID U1234567890',
  ],
});

ToolRegistry.registerTool({
  name: 'list_users',
  description: 'List users in the Slack workspace',
  parameters: {
    limit: { type: 'number', description: 'Maximum number of users to retrieve' },
  },
  requiredParameters: [],
  domains: ['slack'],
  serviceMethod: 'listUsers',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Check who is in the workspace',
    'List all team members in Slack',
  ],
});

ToolRegistry.registerTool({
  name: 'upload_file',
  description: 'Upload a file to a Slack channel',
  parameters: {
    channel: { type: 'string', description: 'Channel ID or name', required: true },
    filename: { type: 'string', description: 'File name', required: true },
    content: { type: 'string', description: 'File content', required: true },
    title: { type: 'string', description: 'File title' },
  },
  requiredParameters: ['channel', 'filename', 'content'],
  domains: ['slack'],
  serviceMethod: 'uploadFile',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Upload the project file to the #design channel',
    'Share the report document with the team',
  ],
});

ToolRegistry.registerTool({
  name: 'update_message',
  description: 'Update an existing Slack message',
  parameters: {
    channel: { type: 'string', description: 'Channel ID or name', required: true },
    ts: { type: 'string', description: 'Message timestamp', required: true },
    text: { type: 'string', description: 'New message text', required: true },
  },
  requiredParameters: ['channel', 'ts', 'text'],
  domains: ['slack'],
  serviceMethod: 'updateMessage',
  requiresAuth: true,
  requiresConfirmation: false,
  isCritical: false,
  examples: [
    'Update my previous message with new information',
    'Correct the typo in the project update',
  ],
});

ToolRegistry.registerTool({
  name: 'delete_message',
  description: 'Delete a Slack message',
  parameters: {
    channel: { type: 'string', description: 'Channel ID or name', required: true },
    ts: { type: 'string', description: 'Message timestamp', required: true },
  },
  requiredParameters: ['channel', 'ts'],
  domains: ['slack'],
  serviceMethod: 'deleteMessage',
  requiresAuth: true,
  requiresConfirmation: true,
  isCritical: false,
  examples: [
    'Delete the message I just sent',
    'Remove the incorrect information from the channel',
  ],
});
