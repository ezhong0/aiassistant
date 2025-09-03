import crypto from 'crypto';
import logger from './logger';

/**
 * Crypto utilities for token encryption/decryption
 * Uses AES-256-GCM for authenticated encryption
 */
export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16;  // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  
  private static encryptionKey: Buffer | null = null;
  
  /**
   * Initialize encryption key from environment or generate one
   */
  static initialize(): void {
    const envKey = process.env.TOKEN_ENCRYPTION_KEY;
    
    if (envKey) {
      // Use provided key (should be base64 encoded)
      try {
        this.encryptionKey = Buffer.from(envKey, 'base64');
        if (this.encryptionKey.length !== this.KEY_LENGTH) {
          throw new Error(`Invalid key length: ${this.encryptionKey.length}, expected ${this.KEY_LENGTH}`);
        }
        logger.info('Using provided token encryption key');
      } catch (error) {
        logger.warn('Invalid TOKEN_ENCRYPTION_KEY format, generating new key', { error: error instanceof Error ? error.message : 'Unknown error' });
        this.encryptionKey = crypto.randomBytes(this.KEY_LENGTH);
      }
    } else {
      // Generate a new key (will be lost on restart - should use env var in production)
      this.encryptionKey = crypto.randomBytes(this.KEY_LENGTH);
      const keyBase64 = this.encryptionKey.toString('base64');
      logger.warn('No TOKEN_ENCRYPTION_KEY provided, generated temporary key. Set TOKEN_ENCRYPTION_KEY=' + keyBase64 + ' in production');
    }
  }
  
  /**
   * Encrypt sensitive data (like refresh tokens)
   */
  static encryptSensitiveData(plaintext: string): string {
    if (!this.encryptionKey) {
      this.initialize();
    }
    
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Invalid plaintext for encryption');
    }
    
    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, this.encryptionKey!, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV + tag + encrypted data
      const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
      return combined.toString('base64');
    } catch (error) {
      logger.error('Token encryption failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to encrypt sensitive data');
    }
  }
  
  /**
   * Decrypt sensitive data (like refresh tokens)
   */
  static decryptSensitiveData(encryptedData: string): string {
    if (!this.encryptionKey) {
      this.initialize();
    }
    
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid encrypted data for decryption');
    }
    
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract IV, tag, and encrypted data
      const iv = combined.subarray(0, this.IV_LENGTH);
      const tag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = combined.subarray(this.IV_LENGTH + this.TAG_LENGTH);
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.encryptionKey!, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Token decryption failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to decrypt sensitive data');
    }
  }
  
  /**
   * Check if data appears to be encrypted
   */
  static isEncrypted(data: string): boolean {
    if (!data || typeof data !== 'string') {
      return false;
    }
    
    try {
      // Check if it's valid base64 and has reasonable length
      const decoded = Buffer.from(data, 'base64');
      return decoded.length >= (this.IV_LENGTH + this.TAG_LENGTH + 10); // Minimum reasonable size
    } catch {
      return false;
    }
  }
  
  /**
   * Sanitize token for logging (show only first and last few characters)
   */
  static sanitizeTokenForLogging(token: string): string {
    if (!token || token.length < 10) {
      return '[REDACTED]';
    }
    
    return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
  }
  
  /**
   * Generate a secure random session ID
   */
  static generateSecureSessionId(prefix: string = 'session'): string {
    const randomBytes = crypto.randomBytes(16);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomBytes.toString('hex')}`;
  }
}

// Initialize on import
CryptoUtil.initialize();