import crypto from 'crypto';
import logger from '../utils/logger';
import { BaseService } from './base-service';
import { CacheService } from './cache.service';
import { SlackContext } from '../types/slack/slack.types';

/**
 * OAuthStateService
 * Issues and validates signed OAuth state with nonce using Redis via CacheService.
 * Ensures tamper protection and single-use (anti-replay) across multiple instances.
 */
export class OAuthStateService extends BaseService {
  private readonly ttlMs = 10 * 60 * 1000; // 10 minutes
  private readonly prefix = 'oauth_state';

  constructor(private readonly cache: CacheService) {
    super('oauthStateService');
  }

  protected async onInitialize(): Promise<void> {
    try {
      // Check if cache is available (avoid proxy access with typeof check)
      const hasCacheService = this.cache && typeof this.cache === 'object';
      if (!hasCacheService) {
        logger.warn('OAuthStateService initialized without CacheService - falling back to stateless behavior', {
          correlationId: `oauth-state-init-${Date.now()}`,
          operation: 'oauth_state_init'
        });
      }
    } catch (error) {
      this.handleError(error as Error, 'onInitialize');
    }
  }

  protected async onDestroy(): Promise<void> {
    // Nothing to clean up
  }

  /** Issue a signed state and persist nonce with TTL */
  issueState(context: SlackContext): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const payloadObj = {
      userId: context.userId,
      teamId: context.teamId,
      channelId: context.channelId,
      ts: Date.now(),
      n: nonce
    };
    const payload = JSON.stringify(payloadObj);
    const sig = this.sign(payload);
    const b64 = Buffer.from(payload).toString('base64');

    // Store nonce -> issued with TTL in seconds
    const ttlSeconds = Math.ceil(this.ttlMs / 1000);
    if (this.cache) {
      void this.cache.setex(this.key(nonce), ttlSeconds, 'issued');
    }

    return `${b64}.${sig}`;
  }

  /** Validate signature, freshness and consume nonce (single-use) */
  async validateAndConsume(state: string): Promise<SlackContext | null> {
    try {
      const [b64, providedSig] = state.split('.');
      if (!b64 || !providedSig) return null;
      const payload = Buffer.from(b64, 'base64').toString('utf8');
      const expectedSig = this.sign(payload);
      if (!this.timingSafeEqual(Buffer.from(providedSig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        return null;
      }
      const obj = JSON.parse(payload) as { userId: string; channelId: string; ts: number; n: string };
      if (Date.now() - obj.ts > this.ttlMs) return null; // expired

      // Check and consume nonce in Redis
      if (this.cache) {
        const exists = await this.cache.exists(this.key(obj.n));
        if (!exists) return null; // unknown or already consumed
        await this.cache.del(this.key(obj.n));
      }

      return {
        userId: obj.userId,
        channelId: obj.channelId,
        teamId: '',
        isDirectMessage: true
      };
    } catch {
      return null;
    }
  }

  private key(nonce: string): string {
    return `${this.prefix}:nonce:${nonce}`;
  }

  private sign(payload: string): string {
    const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'default-unsafe-secret-change-me';
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}

