/**
 * Slack validation schemas
 */

import { z } from 'zod';
import { OptionalStringSchema, OptionalNumberSchema, OptionalBooleanSchema } from './common.schemas';

// Slack context schema
export const SlackContextSchema = z.object({
  userId: z.string(),
  channelId: z.string(),
  teamId: z.string(),
  threadTs: OptionalStringSchema,
  isDirectMessage: z.boolean(),
  userName: OptionalStringSchema,
  userEmail: OptionalStringSchema,
});

// Slack message event schema
export const SlackMessageEventSchema = z.object({
  type: z.literal('message'),
  channel: z.string(),
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  thread_ts: OptionalStringSchema,
  channel_type: OptionalStringSchema,
});

// Slack app mention event schema
export const SlackAppMentionEventSchema = z.object({
  type: z.literal('app_mention'),
  channel: z.string(),
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  thread_ts: OptionalStringSchema,
});

// Slack slash command payload schema
export const SlackSlashCommandPayloadSchema = z.object({
  token: z.string(),
  team_id: z.string(),
  team_domain: z.string(),
  channel_id: z.string(),
  channel_name: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  command: z.string(),
  text: z.string(),
  response_url: z.string(),
  trigger_id: z.string(),
});

// Slack interactive component payload schema
export const SlackInteractiveComponentPayloadSchema = z.object({
  type: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
  }),
  channel: z.object({
    id: z.string(),
    name: z.string(),
  }),
  actions: z.array(z.object({
    action_id: z.string(),
    block_id: z.string(),
    value: OptionalStringSchema,
    type: z.string(),
  })),
  response_url: z.string(),
  trigger_id: z.string(),
  team: z.object({
    id: z.string(),
    domain: z.string(),
  }),
});

// Slack attachment schema
export const SlackAttachmentSchema = z.object({
  id: z.string(),
  title: OptionalStringSchema,
  title_link: OptionalStringSchema,
  text: OptionalStringSchema,
  color: OptionalStringSchema,
  author_name: OptionalStringSchema,
  author_link: OptionalStringSchema,
  author_icon: OptionalStringSchema,
  image_url: OptionalStringSchema,
  thumb_url: OptionalStringSchema,
  footer: OptionalStringSchema,
  footer_icon: OptionalStringSchema,
  ts: OptionalNumberSchema,
});

// Slack reaction schema
export const SlackReactionSchema = z.object({
  name: z.string(),
  count: z.number(),
  users: z.array(z.string()),
});

// Slack message schema
export const SlackMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  userId: z.string(),
  channelId: z.string(),
  timestamp: z.string(),
  threadTs: OptionalStringSchema,
  isBot: z.boolean(),
  attachments: z.array(SlackAttachmentSchema).optional(),
  reactions: z.array(SlackReactionSchema).optional(),
  blocks: z.array(z.any()).optional(),
});

// Slack thread schema
export const SlackThreadSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  timestamp: z.string(),
  messages: z.array(SlackMessageSchema),
  participantCount: z.number(),
  lastActivity: z.string(),
});

// Slack draft schema
export const SlackDraftSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  text: z.string(),
  timestamp: z.string(),
  userId: z.string(),
  isEdited: z.boolean(),
});

// Slack channel schema
export const SlackChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  isPrivate: z.boolean(),
  memberCount: OptionalNumberSchema,
  topic: OptionalStringSchema,
  purpose: OptionalStringSchema,
});

// Slack agent request schema
export const SlackAgentRequestSchema = z.object({
  operation: z.enum(['read_messages', 'read_thread', 'detect_drafts', 'confirmation_handling']),
  context: SlackContextSchema,
  metadata: z.object({
    timestamp: z.string(),
    eventId: OptionalStringSchema,
    triggerId: OptionalStringSchema,
    responseUrl: OptionalStringSchema,
  }),
  parameters: z.object({
    searchTerm: OptionalStringSchema,
    channelId: OptionalStringSchema,
    threadTs: OptionalStringSchema,
    limit: OptionalNumberSchema,
  }),
});

// Slack agent result schema
export const SlackAgentResultSchema = z.object({
  messages: z.array(SlackMessageSchema),
  threads: z.array(SlackThreadSchema),
  drafts: z.array(SlackDraftSchema),
  operation: z.enum(['read_messages', 'read_thread', 'detect_drafts', 'confirmation_handling']),
  totalCount: z.number(),
  channelId: OptionalStringSchema,
  threadTs: OptionalStringSchema,
  searchTerm: OptionalStringSchema,
  confirmationStatus: z.enum(['pending', 'confirmed', 'rejected', 'expired']).optional(),
});

// Slack webhook event schema
export const SlackWebhookEventSchema = z.object({
  token: z.string(),
  team_id: z.string(),
  api_app_id: z.string(),
  event: z.union([SlackMessageEventSchema, SlackAppMentionEventSchema]),
  type: z.string(),
  event_id: z.string(),
  event_time: z.number(),
  authorizations: z.union([
    z.array(z.object({
      user_id: z.string(),
      is_bot: z.boolean(),
      is_enterprise_install: z.boolean(),
    })),
    z.record(z.string(), z.object({
      user_id: z.string(),
      is_bot: z.boolean(),
      is_enterprise_install: z.boolean(),
    }))
  ]).transform((auth) => {
    // Convert object format to array format if needed
    if (Array.isArray(auth)) {
      return auth;
    }
    return Object.values(auth);
  }),
  is_ext_shared_channel: z.boolean(),
  event_context: z.string(),
});

// Slack tokens schema
export const SlackTokensSchema = z.object({
  access_token: z.string(),
  team_id: z.string(),
  user_id: z.string(),
});
