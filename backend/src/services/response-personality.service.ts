import { BaseService } from './base-service';
import { OpenAIService } from './openai.service';
import { serviceManager } from './service-manager';
import { CacheService } from './cache.service';

export interface PersonalityConfig {
  personality: 'cute' | 'professional' | 'friendly' | 'casual';
  useEmojis: boolean;
  enthusiasmLevel: 'low' | 'medium' | 'high';
  cacheResponses: boolean;
}

export interface ResponseContext {
  action: string;
  success: boolean;
  details?: {
    recipient?: string;
    subject?: string;
    count?: number;
    itemType?: string;
  };
  error?: string;
}

/**
 * Fast, cost-effective response personality service
 * Uses cheap models and caching for dynamic personality responses
 */
export class ResponsePersonalityService extends BaseService {
  private openAIService: OpenAIService | null = null;
  private cacheService: CacheService | null = null;
  private config: PersonalityConfig;

  // Fast model for response generation (much cheaper than GPT-4)
  private readonly FAST_MODEL = 'gpt-3.5-turbo';
  private readonly MAX_TOKENS = 100; // Keep responses short
  private readonly CACHE_TTL = 86400; // 24 hours

  constructor(config: PersonalityConfig = {
    personality: 'cute',
    useEmojis: true,
    enthusiasmLevel: 'high',
    cacheResponses: true
  }) {
    super('ResponsePersonalityService');
    this.config = config;
  }

  protected async onInitialize(): Promise<void> {
    this.openAIService = serviceManager.getService<OpenAIService>('openaiService') || null;
    this.cacheService = serviceManager.getService<CacheService>('cacheService') || null;

    if (!this.openAIService) {
      throw new Error('OpenAIService is required for ResponsePersonalityService');
    }

    this.logInfo('ResponsePersonalityService initialized', this.config as any);
  }

  protected async onDestroy(): Promise<void> {
    this.openAIService = null;
    this.cacheService = null;
  }

  /**
   * Generate a personalized response message
   */
  async generateResponse(context: ResponseContext): Promise<string> {
    try {
      // Check cache first if enabled
      if (this.config.cacheResponses && this.cacheService) {
        const cacheKey = this.getCacheKey(context);
        const cached = await this.cacheService.get<string>(cacheKey);
        if (cached) {
          this.logDebug('Response cache hit', { cacheKey });
          return cached;
        }
      }

      // Generate new response using fast model
      const prompt = this.buildPrompt(context);
      const response = await this.openAIService!.createChatCompletion([
        { role: 'user', content: prompt }
      ], this.MAX_TOKENS);

      const generatedText = response.content?.trim() || this.getFallback(context);

      // Cache the result
      if (this.config.cacheResponses && this.cacheService) {
        const cacheKey = this.getCacheKey(context);
        await this.cacheService.set(cacheKey, generatedText, this.CACHE_TTL);
      }

      this.logDebug('Generated response', {
        action: context.action,
        length: generatedText.length,
        cached: false
      });

      return generatedText;

    } catch (error) {
      this.logError('Failed to generate response', error, context as any);
      return this.getFallback(context);
    }
  }

  /**
   * Build optimized prompt for response generation
   */
  private buildPrompt(context: ResponseContext): string {
    const { personality, useEmojis, enthusiasmLevel } = this.config;

    let basePrompt = `Generate a ${personality} response message for: ${context.action}`;

    if (context.success) {
      basePrompt += ' (successful)';
      if (context.details) {
        const details = [];
        if (context.details.recipient) details.push(`to: ${context.details.recipient}`);
        if (context.details.subject) details.push(`subject: ${context.details.subject}`);
        if (context.details.count) details.push(`count: ${context.details.count}`);
        if (details.length > 0) {
          basePrompt += ` - ${details.join(', ')}`;
        }
      }
    } else {
      basePrompt += ` (failed: ${context.error || 'unknown error'})`;
    }

    // Add personality constraints
    const constraints = [];
    constraints.push(`Tone: ${personality}`);
    constraints.push(`Enthusiasm: ${enthusiasmLevel}`);
    if (useEmojis) constraints.push('Include 2-4 relevant emojis');
    constraints.push('Keep under 50 words');
    constraints.push('Be conversational and natural');

    if (personality === 'cute') {
      constraints.push('Use phrases like "Yay!", "Woohoo!", "Amazing!"');
      constraints.push('Express happiness about helping');
    }

    return `${basePrompt}

Requirements: ${constraints.join(', ')}

Response:`;
  }

  /**
   * Generate cache key for response
   */
  private getCacheKey(context: ResponseContext): string {
    const keyData = {
      action: context.action,
      success: context.success,
      personality: this.config.personality,
      emojis: this.config.useEmojis,
      enthusiasm: this.config.enthusiasmLevel,
      // Include relevant details in cache key
      recipient: context.details?.recipient ? 'has_recipient' : 'no_recipient',
      subject: context.details?.subject ? 'has_subject' : 'no_subject',
      count: context.details?.count ? 'has_count' : 'no_count'
    };

    return `response:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Get fallback response if LLM fails
   */
  private getFallback(context: ResponseContext): string {
    if (!context.success) {
      return this.config.personality === 'cute'
        ? "🥺 Oops! Something went wrong, but I'm still here to help! 💕"
        : "Something went wrong with your request. Please try again.";
    }

    const emojis = this.config.useEmojis ? ' ✨' : '';

    switch (this.config.personality) {
      case 'cute':
        return `🎉 Yay! Your ${context.action} completed successfully!${emojis}`;
      case 'friendly':
        return `Great! Your ${context.action} was completed successfully!${emojis}`;
      case 'professional':
        return `${context.action} completed successfully.${emojis}`;
      default:
        return `${context.action} completed successfully.${emojis}`;
    }
  }

  /**
   * Update personality configuration
   */
  updateConfig(newConfig: Partial<PersonalityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logInfo('Personality config updated', this.config as any);
  }

  /**
   * Get current configuration
   */
  getConfig(): PersonalityConfig {
    return { ...this.config };
  }
}