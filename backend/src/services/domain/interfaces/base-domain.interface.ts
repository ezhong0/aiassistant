/**
 * Base Domain Service Interface
 * Core interface that all domain services must implement
 *
 * Note: OAuth is handled by Supabase Auth. Domain services use SupabaseTokenProvider
 * to fetch Google provider tokens from Supabase.
 */

/**
 * Health status information
 */
export interface HealthStatus {
  healthy: boolean;
  details?: Record<string, unknown>;
}

/**
 * Base domain service interface
 * All domain services extend this interface
 */
export interface IDomainService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Destroy the service and clean up resources
   */
  destroy(): Promise<void>;

  /**
   * Get health status of the service
   */
  getHealth(): HealthStatus;
}