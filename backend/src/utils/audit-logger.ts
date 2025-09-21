import logger from './logger';
import { CryptoUtil } from './crypto.util';

export interface AuditEvent {
  event: string;
  userId?: string | undefined;
  sessionId?: string | undefined;
  teamId?: string | undefined;
  details?: Record<string, any> | undefined;
  timestamp?: Date | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Audit logger for security-sensitive events
 */
export class AuditLogger {
  private static readonly AUDIT_EVENTS = {
    // Session events
    SESSION_CREATED: 'session_created',
    SESSION_EXPIRED: 'session_expired',
    SESSION_DESTROYED: 'session_destroyed',
    
    // OAuth events
    OAUTH_TOKENS_STORED: 'oauth_tokens_stored',
    OAUTH_TOKENS_RETRIEVED: 'oauth_tokens_retrieved',
    OAUTH_TOKENS_REFRESHED: 'oauth_tokens_refreshed',
    OAUTH_TOKENS_EXPIRED: 'oauth_tokens_expired',
    OAUTH_TOKENS_REVOKED: 'oauth_tokens_revoked',
    
    // Security events
    TOKEN_ENCRYPTION_FAILED: 'token_encryption_failed',
    TOKEN_DECRYPTION_FAILED: 'token_decryption_failed',
    SUSPICIOUS_TOKEN_ACCESS: 'suspicious_token_access',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    
    // Cache events
    CACHE_INVALIDATION: 'cache_invalidation',
    CACHE_MISS: 'cache_miss',
    CACHE_HIT: 'cache_hit'
  } as const;

  /**
   * Log a security audit event
   */
  static logSecurityEvent(event: AuditEvent): void {
    const auditData = {
      ...event,
      timestamp: event.timestamp || new Date(),
      service: 'session-oauth-service',
      level: 'audit'
    };
    
    // Sanitize sensitive data before logging
    if (auditData.details) {
      auditData.details = this.sanitizeAuditDetails(auditData.details);
    }
    
    logger.info('AUDIT_EVENT', {
      correlationId: `audit-${Date.now()}`,
      operation: 'audit_event',
      ...auditData
    });
  }

  /**
   * Log session-related events
   */
  static logSessionEvent(
    event: keyof typeof AuditLogger.AUDIT_EVENTS,
    sessionId: string,
    details?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      event: this.AUDIT_EVENTS[event],
      sessionId,
      details
    });
  }

  /**
   * Log OAuth token events
   */
  static logOAuthEvent(
    event: keyof typeof AuditLogger.AUDIT_EVENTS,
    sessionId: string,
    userId?: string,
    teamId?: string,
    details?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      event: this.AUDIT_EVENTS[event],
      sessionId,
      userId,
      teamId,
      details
    });
  }

  /**
   * Log cache-related events (for debugging cache issues)
   */
  static logCacheEvent(
    event: keyof typeof AuditLogger.AUDIT_EVENTS,
    cacheKey: string,
    details?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      event: this.AUDIT_EVENTS[event],
      details: {
        cacheKey,
        ...details
      }
    });
  }

  /**
   * Log token refresh events with security context
   */
  static logTokenRefresh(
    sessionId: string,
    userId: string,
    teamId: string,
    success: boolean,
    reason?: string
  ): void {
    this.logOAuthEvent('OAUTH_TOKENS_REFRESHED', sessionId, userId, teamId, {
      success,
      reason,
      refreshTimestamp: new Date().toISOString()
    });
  }

  /**
   * Log suspicious activities
   */
  static logSuspiciousActivity(
    event: string,
    sessionId?: string,
    details?: Record<string, any>
  ): void {
    this.logSecurityEvent({
      event: `suspicious_${event}`,
      sessionId,
      details: {
        ...details,
        severity: 'high'
      }
    });
  }

  /**
   * Sanitize sensitive data from audit logs
   */
  private static sanitizeAuditDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    
    // Sanitize common sensitive fields
    const sensitiveFields = [
      'access_token', 'refresh_token', 'password', 'secret', 'key',
      'authorization', 'cookie', 'session_token'
    ];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        if (typeof sanitized[field] === 'string') {
          sanitized[field] = CryptoUtil.sanitizeTokenForLogging(sanitized[field]);
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    }
    
    // Sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeAuditDetails(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Get audit events enum for external use
   */
  static get EVENTS() {
    return this.AUDIT_EVENTS;
  }
}