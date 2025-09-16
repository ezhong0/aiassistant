/**
 * Common validation schemas used across the application
 */

import { z } from 'zod';

// Base schemas
export const EmailSchema = z.string().email();
export const NonEmptyStringSchema = z.string().min(1);
export const OptionalStringSchema = z.string().optional();
export const OptionalNumberSchema = z.number().optional();
export const OptionalBooleanSchema = z.boolean().optional();
export const OptionalDateSchema = z.date().optional();

// Array schemas
export const EmailArraySchema = z.array(EmailSchema);
export const StringArraySchema = z.array(z.string());

// ID schemas
export const UserIdSchema = z.string().uuid();
export const ChannelIdSchema = z.string();
export const MessageIdSchema = z.string();
export const ThreadIdSchema = z.string();

// Timestamp schemas
export const TimestampSchema = z.string();
export const OptionalTimestampSchema = z.string().optional();

// Common object schemas
export const PaginationSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

export const SortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).optional(),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
});

// Success response schema
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.any().optional(),
});

// Base API response schema
export const BaseAPIResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  metadata: z.object({
    timestamp: z.string(),
    requestId: z.string().optional(),
    sessionId: z.string().optional(),
    userId: z.string().optional(),
    executionTime: z.number().optional(),
    version: z.string().optional(),
  }).optional(),
});
