/**
 * Contact validation schemas
 */

import { z } from 'zod';
import { EmailSchema, OptionalStringSchema } from './common.schemas';

// Contact schema
export const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: EmailSchema,
  photo: z.string().nullable(),
  source: z.enum(['contacts', 'gmail', 'manual']),
});

// Contact search request schema
export const ContactSearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).optional(),
  source: z.enum(['all', 'contacts', 'gmail', 'manual']).optional(),
});

// Create contact request schema
export const CreateContactRequestSchema = z.object({
  name: z.string().min(1),
  email: EmailSchema,
  photo: OptionalStringSchema,
});

// Update contact request schema
export const UpdateContactRequestSchema = z.object({
  contactId: z.string(),
  name: OptionalStringSchema,
  email: EmailSchema.optional(),
  photo: OptionalStringSchema,
});

// Contact group schema
export const ContactGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  contacts: z.array(ContactSchema),
  created: z.date(),
  modified: z.date(),
});

// Contact import schema
export const ContactImportSchema = z.object({
  contacts: z.array(CreateContactRequestSchema),
  source: z.enum(['csv', 'vcard', 'google']),
  overwrite: z.boolean().optional(),
});
