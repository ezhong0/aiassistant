import { EncryptionService } from '../services/encryption.service';
import { serviceManager } from '../services/service-locator-compat';

/**
 * Legacy crypto utilities - now delegates to EncryptionService
 * @deprecated Use EncryptionService directly for new code
 */
export class CryptoUtil {
  private static encryptionService: EncryptionService | null = null;

  /**
   * Get or create encryption service instance
   */
  private static getEncryptionService(): EncryptionService {
    if (!this.encryptionService) {
      this.encryptionService = serviceManager.getService<EncryptionService>('encryptionService') || null;
      if (!this.encryptionService) {
        throw new Error('EncryptionService not available');
      }
    }
    return this.encryptionService;
  }

  /**
   * Initialize encryption key from environment or generate one
   * @deprecated Use EncryptionService directly
   */
  static initialize(): void {
    // No-op - initialization is handled by EncryptionService
  }
  
  /**
   * Encrypt sensitive data (like refresh tokens)
   * @deprecated Use EncryptionService.encryptSensitiveData() directly
   */
  static encryptSensitiveData(plaintext: string): string {
    return this.getEncryptionService().encryptSensitiveData(plaintext);
  }
  
  /**
   * Decrypt sensitive data (like refresh tokens)
   * @deprecated Use EncryptionService.decryptSensitiveData() directly
   */
  static decryptSensitiveData(encryptedData: string): string {
    return this.getEncryptionService().decryptSensitiveData(encryptedData);
  }
  
  /**
   * Check if data appears to be encrypted
   * @deprecated Use EncryptionService directly
   */
  static isEncrypted(data: string): boolean {
    if (!data || typeof data !== 'string') {
      return false;
    }
    
    try {
      // Check if it's valid base64 and has reasonable length
      const decoded = Buffer.from(data, 'base64');
      return decoded.length >= 42; // Minimum reasonable size for AES-256-GCM
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
    const crypto = globalThis.require('crypto');
    const randomBytes = crypto.randomBytes(16);
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomBytes.toString('hex')}`;
  }

  /**
   * Generate a new encryption key (for key rotation)
   * @deprecated Use EncryptionService.generateNewKey() directly
   */
  static generateNewKey(): string {
    return this.getEncryptionService().generateNewKey();
  }
  
  /**
   * Get current encryption key status
   * @deprecated Use EncryptionService.getStats() directly
   */
  static getKeyStatus(): { hasKey: boolean; keyLength?: number } {
    const stats = this.getEncryptionService().getStats();
    return {
      hasKey: stats.hasKey,
      keyLength: stats.keyLength
    };
  }
}