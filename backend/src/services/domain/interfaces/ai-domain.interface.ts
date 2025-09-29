/**
 * AI Domain Service Interface
 * Focused interface for AI-related operations
 */

import { IDomainService } from './base-domain.interface';

/**
 * AI model configuration
 */
export interface AIModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  timeout?: number;
}

/**
 * AI prompt for structured data generation
 */
export interface AIPrompt {
  systemPrompt: string;
  userPrompt: string;
  context?: string;
  options?: AIModelConfig;
}

/**
 * JSON Schema for structured responses
 */
export interface StructuredSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, StructuredSchema>;
  items?: StructuredSchema;
  required?: string[];
  description?: string;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | StructuredSchema;
}

/**
 * Parameters for structured data generation
 */
export interface StructuredDataParams {
  prompt: string;
  schema: StructuredSchema;
  systemPrompt?: string;
  context?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  timeout?: number;
}

/**
 * AI response metadata
 */
export interface AIResponseMetadata {
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  executionTime: number;
  finishReason?: 'stop' | 'length' | 'function_call' | 'content_filter';
  requestId?: string;
  cached?: boolean;
}

/**
 * AI text completion parameters
 */
export interface TextCompletionParams {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  model?: string;
  stream?: boolean;
}

/**
 * AI text completion result
 */
export interface TextCompletionResult {
  text: string;
  metadata: AIResponseMetadata;
}

/**
 * AI chat message
 */
export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

/**
 * AI chat completion parameters
 */
export interface ChatCompletionParams {
  messages: AIChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  model?: string;
  functions?: Array<{
    name: string;
    description: string;
    parameters: StructuredSchema;
  }>;
  functionCall?: 'none' | 'auto' | { name: string };
  stream?: boolean;
}

/**
 * AI chat completion result
 */
export interface ChatCompletionResult {
  message: AIChatMessage;
  metadata: AIResponseMetadata;
}

/**
 * AI embedding parameters
 */
export interface EmbeddingParams {
  input: string | string[];
  model?: string;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
}

/**
 * AI embedding result
 */
export interface EmbeddingResult {
  embeddings: number[][];
  metadata: {
    model: string;
    dimensions: number;
    tokensUsed: number;
    executionTime: number;
  };
}

/**
 * AI text analysis parameters
 */
export interface TextAnalysisParams {
  text: string;
  analysisType: 'sentiment' | 'entities' | 'keywords' | 'summary' | 'classification';
  options?: {
    categories?: string[];
    maxKeywords?: number;
    summaryLength?: 'short' | 'medium' | 'long';
    includeConfidence?: boolean;
  };
}

/**
 * AI text analysis result
 */
export interface TextAnalysisResult {
  analysis: {
    sentiment?: {
      score: number; // -1 to 1
      label: 'positive' | 'negative' | 'neutral';
      confidence: number;
    };
    entities?: Array<{
      text: string;
      type: string;
      confidence: number;
      startIndex?: number;
      endIndex?: number;
    }>;
    keywords?: Array<{
      text: string;
      score: number;
      type?: string;
    }>;
    summary?: {
      text: string;
      length: number;
      compressionRatio: number;
    };
    classification?: Array<{
      category: string;
      confidence: number;
    }>;
  };
  metadata: AIResponseMetadata;
}

/**
 * AI conversation context
 */
export interface ConversationContext {
  conversationId: string;
  messages: AIChatMessage[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI function definition
 */
export interface AIFunction {
  name: string;
  description: string;
  parameters: StructuredSchema;
  handler?: (args: any) => Promise<any>;
}

/**
 * AI Domain Service Interface
 * Handles all AI-related operations and integrations
 */
export interface IAIDomainService extends IDomainService {
  // ===== Text Generation =====

  /**
   * Generate structured data using AI
   */
  generateStructuredData<T = any>(params: StructuredDataParams): Promise<T>;

  /**
   * Generate text completion
   */
  generateTextCompletion(params: TextCompletionParams): Promise<TextCompletionResult>;

  /**
   * Generate chat completion
   */
  generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;

  /**
   * Generate streaming text completion
   */
  generateStreamingCompletion(params: TextCompletionParams): AsyncIterableIterator<{
    delta: string;
    metadata?: Partial<AIResponseMetadata>;
  }>;

  /**
   * Generate streaming chat completion
   */
  generateStreamingChat(params: ChatCompletionParams): AsyncIterableIterator<{
    delta: AIChatMessage;
    metadata?: Partial<AIResponseMetadata>;
  }>;

  // ===== Text Analysis =====

  /**
   * Analyze text for various insights
   */
  analyzeText(params: TextAnalysisParams): Promise<TextAnalysisResult>;

  /**
   * Extract entities from text
   */
  extractEntities(text: string, entityTypes?: string[]): Promise<Array<{
    text: string;
    type: string;
    confidence: number;
    startIndex: number;
    endIndex: number;
  }>>;

  /**
   * Analyze sentiment of text
   */
  analyzeSentiment(text: string): Promise<{
    score: number;
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }>;

  /**
   * Generate text summary
   */
  summarizeText(text: string, options?: {
    length?: 'short' | 'medium' | 'long';
    maxWords?: number;
    style?: 'extractive' | 'abstractive';
  }): Promise<{
    summary: string;
    compressionRatio: number;
  }>;

  /**
   * Classify text into categories
   */
  classifyText(text: string, categories: string[]): Promise<Array<{
    category: string;
    confidence: number;
  }>>;

  /**
   * Extract keywords from text
   */
  extractKeywords(text: string, maxKeywords?: number): Promise<Array<{
    text: string;
    score: number;
    type?: string;
  }>>;

  // ===== Embeddings =====

  /**
   * Generate text embeddings
   */
  generateEmbeddings(params: EmbeddingParams): Promise<EmbeddingResult>;

  /**
   * Calculate similarity between texts
   */
  calculateSimilarity(text1: string, text2: string): Promise<{
    similarity: number;
    method: string;
  }>;

  /**
   * Find similar texts from a corpus
   */
  findSimilarTexts(query: string, corpus: string[], topK?: number): Promise<Array<{
    text: string;
    similarity: number;
    index: number;
  }>>;

  // ===== Conversation Management =====

  /**
   * Create conversation context
   */
  createConversation(initialMessage?: AIChatMessage, metadata?: Record<string, any>): Promise<ConversationContext>;

  /**
   * Get conversation context
   */
  getConversation(conversationId: string): Promise<ConversationContext>;

  /**
   * Add message to conversation
   */
  addMessageToConversation(conversationId: string, message: AIChatMessage): Promise<ConversationContext>;

  /**
   * Generate response in conversation context
   */
  generateConversationResponse(
    conversationId: string,
    message: AIChatMessage,
    options?: AIModelConfig
  ): Promise<{
    response: AIChatMessage;
    updatedContext: ConversationContext;
    metadata: AIResponseMetadata;
  }>;

  /**
   * Delete conversation
   */
  deleteConversation(conversationId: string): Promise<void>;

  /**
   * List conversations
   */
  listConversations(limit?: number, offset?: number): Promise<{
    conversations: ConversationContext[];
    total: number;
  }>;

  // ===== Function Calling =====

  /**
   * Register AI function
   */
  registerFunction(func: AIFunction): Promise<void>;

  /**
   * Unregister AI function
   */
  unregisterFunction(name: string): Promise<void>;

  /**
   * List registered functions
   */
  listFunctions(): Promise<AIFunction[]>;

  /**
   * Execute function call
   */
  executeFunction(name: string, args: any): Promise<any>;

  // ===== Model Management =====

  /**
   * List available models
   */
  listModels(): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    contextLength?: number;
    capabilities: string[];
    pricing?: {
      inputTokens: number;
      outputTokens: number;
    };
  }>>;

  /**
   * Get model info
   */
  getModelInfo(modelId: string): Promise<{
    id: string;
    name: string;
    description?: string;
    contextLength?: number;
    capabilities: string[];
    pricing?: {
      inputTokens: number;
      outputTokens: number;
    };
  }>;

  /**
   * Test model availability
   */
  testModel(modelId: string): Promise<{
    available: boolean;
    latency?: number;
    error?: string;
  }>;

  // ===== Utility Methods =====

  /**
   * Count tokens in text
   */
  countTokens(text: string, model?: string): Promise<number>;

  /**
   * Validate schema
   */
  validateSchema(schema: StructuredSchema): Promise<{
    valid: boolean;
    errors?: string[];
  }>;

  /**
   * Get usage statistics
   */
  getUsageStats(timeframe?: 'hour' | 'day' | 'week' | 'month'): Promise<{
    requests: number;
    tokensUsed: number;
    cost?: number;
    models: Record<string, {
      requests: number;
      tokens: number;
    }>;
  }>;

  /**
   * Clear cache
   */
  clearCache(): Promise<void>;
}