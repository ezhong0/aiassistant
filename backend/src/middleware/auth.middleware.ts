/**
 * Authentication Types
 *
 * Type definitions for authenticated requests.
 * OAuth is handled by Supabase Auth (see supabase-auth.middleware.ts)
 */

import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    [key: string]: any;
  };
  token?: string;
}
