/**
 * Unified Agent Framework - Public API
 *
 * This module exports all the new framework types and utilities.
 * Import from here to use the unified framework.
 */

// Core BaseSubAgent architecture
export * from './base-subagent';

// Agent factory
export * from './agent-factory';

// Individual SubAgents
export { CalendarAgent } from '../agents/calendar.agent';
export { EmailAgent } from '../agents/email.agent';
export { ContactAgent } from '../agents/contact.agent';
export { SlackAgent } from '../agents/slack.agent';

// Legacy types for compatibility
export * from '../types/agents/agent-result';