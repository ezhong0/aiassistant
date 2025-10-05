/**
 * Authentication and OAuth validation schemas
 */

import { z } from 'zod';
import { EmailSchema, OptionalStringSchema, OptionalNumberSchema } from './common.schemas';

// Google OAuth schemas
export const GoogleTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: OptionalStringSchema,
  id_token: OptionalStringSchema,
  token_type: z.string(),
  expires_in: z.number(),
  scope: OptionalStringSchema,
  expiry_date: OptionalNumberSchema,
});

export const GoogleUserInfoSchema = z.object({
  sub: z.string(),
  email: EmailSchema,
  email_verified: z.boolean(),
  name: z.string(),
  picture: z.string(),
  locale: OptionalStringSchema,
  hd: OptionalStringSchema,
});

export const AuthenticatedUserSchema = z.object({
  userId: z.string(),
  email: EmailSchema,
  name: z.string(),
  picture: OptionalStringSchema,
  givenName: OptionalStringSchema,
  familyName: OptionalStringSchema,
  locale: OptionalStringSchema,
  verifiedEmail: z.boolean().optional(),
});

// JWT schemas
export const JWTPayloadSchema = z.object({
  userId: z.string(),
  email: EmailSchema,
  name: z.string(),
  iat: z.number(),
  exp: z.number(),
});

// Auth request/response schemas
export const AuthSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  tokens: GoogleTokensSchema,
  user: AuthenticatedUserSchema,
  jwt: z.string(),
});

export const TokenRefreshRequestSchema = z.object({
  refresh_token: z.string(),
});

export const TokenRefreshResponseSchema = z.object({
  success: z.boolean(),
  tokens: GoogleTokensSchema,
  jwt: z.string(),
});

// OAuth callback schemas
export const GoogleOAuthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

// Login request schema
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8),
});

// Register request schema
export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8),
  name: z.string().min(1),
});

// Logout request schema
export const LogoutRequestSchema = z.object({
  access_token: OptionalStringSchema,
  everywhere: z.boolean().optional(),
});

// Mobile token exchange schema
export const MobileTokenExchangeSchema = z.object({
  access_token: z.string(),
  platform: z.string(),
});
