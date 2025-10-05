import { z } from 'zod';
import { BaseValidationSchemas } from './api-client.validation';

/**
 * Shared validation schemas for DRY
 * Extract common schemas used across multiple validation files
 */

// Name schema (used in Contacts)
export const NameSchema = z.object({
  givenName: z.string().max(100, 'Given name too long').optional(),
  familyName: z.string().max(100, 'Family name too long').optional(),
  middleName: z.string().max(100, 'Middle name too long').optional(),
});

// Email address schema (used in Contacts, Calendar)
export const EmailAddressSchema = z.object({
  value: BaseValidationSchemas.email,
  type: z.string().optional(),
  displayName: z.string().max(100, 'Display name too long').optional(),
});

// Phone number schema (used in Contacts)
export const PhoneNumberSchema = z.object({
  value: z.string().min(1, 'Phone number is required'),
  type: z.string().optional(),
});

// Address schema (used in Contacts)
export const AddressSchema = z.object({
  streetAddress: z.string().max(200, 'Street address too long').optional(),
  city: z.string().max(100, 'City too long').optional(),
  region: z.string().max(100, 'Region too long').optional(),
  postalCode: z.string().max(20, 'Postal code too long').optional(),
  country: z.string().max(100, 'Country too long').optional(),
  type: z.string().optional(),
});

// Organization schema (used in Contacts)
export const OrganizationSchema = z.object({
  name: z.string().max(200, 'Organization name too long').optional(),
  title: z.string().max(200, 'Title too long').optional(),
  type: z.string().optional(),
});

// Birthday schema (used in Contacts)
export const BirthdaySchema = z.object({
  date: z.object({
    year: z.number().int().min(1900).max(2100).optional(),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
  }).optional(),
});

// Contact base fields (used for both create and update)
export const ContactBaseFieldsSchema = z.object({
  names: z.array(NameSchema).optional(),
  emailAddresses: z.array(EmailAddressSchema).optional(),
  phoneNumbers: z.array(PhoneNumberSchema).optional(),
  addresses: z.array(AddressSchema).optional(),
  organizations: z.array(OrganizationSchema).optional(),
  birthdays: z.array(BirthdaySchema).optional(),
});
