/**
 * Service validation utilities using Zod schemas
 */

import { z } from 'zod';
import { ErrorFactory } from '../errors/error-factory';

// Common validation schemas for services
export const UserIdSchema = z.string().min(1);
export const AccessTokenSchema = z.string().min(20);
export const RefreshTokenSchema = z.string().min(1);
export const EmailSchema = z.string().email();
export const NonEmptyStringSchema = z.string().min(1);

// Service parameter validation schemas
export const CalendarEventValidationSchema = z.object({
  summary: NonEmptyStringSchema,
  start: z.object({
    dateTime: NonEmptyStringSchema,
  }),
  end: z.object({
    dateTime: NonEmptyStringSchema,
  }),
});

export const ContactValidationSchema = z.object({
  name: NonEmptyStringSchema.optional(),
  email: EmailSchema.optional(),
  phone: z.string().optional(),
});

export const TokenValidationSchema = z.object({
  access_token: AccessTokenSchema,
  refresh_token: RefreshTokenSchema.optional(),
  expires_in: z.number().optional(),
});

// Validation helper functions
export function validateServiceInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw ErrorFactory.api.badRequest(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateUserId(userId: unknown): string {
  return validateServiceInput(UserIdSchema, userId);
}

export function validateAccessToken(token: unknown): string {
  return validateServiceInput(AccessTokenSchema, token);
}

export function validateEmail(email: unknown): string {
  return validateServiceInput(EmailSchema, email);
}

export function validateCalendarEvent(event: unknown) {
  return validateServiceInput(CalendarEventValidationSchema, event);
}

export function validateContact(contact: unknown) {
  return validateServiceInput(ContactValidationSchema, contact);
}

export function validateTokenData(token: unknown) {
  return validateServiceInput(TokenValidationSchema, token);
}
