import crypto from 'crypto';
import { BaseService } from './base-service';
import { ErrorFactory } from '../errors/error-factory';

/**
 * Encryption service for handling sensitive data encryption/decryption
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionService extends BaseService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16;  // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  
  private encryptionKey: Buffer | null = null;
  
  constructor() {
    super('EncryptionService');
  }

  /**
   * Cleanup resources when service is destroyed
   */
  protected async onDestroy(): Promise<void> {
    // Clear encryption key from memory
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    this.logInfo('Initializing EncryptionService...');
    
    try {
      await this.initializeEncryptionKey();
      this.logInfo('EncryptionService initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize EncryptionService', { error });
      throw error;
    }
  }

  /**
   * Initialize encryption key from environment or generate one
   */
  private async initializeEncryptionKey(): Promise<void> {
    const envKey = process.env.TOKEN_ENCRYPTION_KEY;
    
    if (envKey) {
      // Use provided key (should be base64 encoded)
      try {
        this.encryptionKey = Buffer.from(envKey, 'base64');
        if (this.encryptionKey.length !== EncryptionService.KEY_LENGTH) {
          throw ErrorFactory.domain.serviceError('EncryptionService', `Invalid key length: ${this.encryptionKey.length}, expected ${EncryptionService.KEY_LENGTH}`);
        }
        this.logDebug('Using provided token encryption key', {
          operation: 'encryption_key_initialization',
        });
      } catch (error) {
        this.logWarn('Invalid TOKEN_ENCRYPTION_KEY format, generating new key', {
          operation: 'encryption_key_generation',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
        this.encryptionKey = crypto.randomBytes(EncryptionService.KEY_LENGTH);
      }
    } else {
      // Generate a new key (will be lost on restart - should use env var in production)
      this.encryptionKey = crypto.randomBytes(EncryptionService.KEY_LENGTH);
      const keyBase64 = this.encryptionKey.toString('base64');
      this.logWarn(`No TOKEN_ENCRYPTION_KEY provided, generated temporary key. Set TOKEN_ENCRYPTION_KEY=${  keyBase64  } in production`, {
        operation: 'encryption_temp_key_generation',
      });
    }
  }

  /**
   * Encrypt sensitive data (like refresh tokens)
   */
  public encryptSensitiveData(plaintext: string): string {
    this.assertReady();
    
    if (!plaintext || typeof plaintext !== 'string') {
      throw ErrorFactory.api.badRequest('Invalid plaintext for encryption');
    }
    
    if (!this.encryptionKey) {
      throw ErrorFactory.domain.serviceError('EncryptionService', 'Encryption key not initialized');
    }
    
    try {
      const iv = crypto.randomBytes(EncryptionService.IV_LENGTH);
      const cipher = crypto.createCipheriv(EncryptionService.ALGORITHM, this.encryptionKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV + tag + encrypted data
      const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
      
      this.logDebug('Successfully encrypted sensitive data', {
        operation: 'encryption_success',
        metadata: { dataLength: plaintext.length },
      });
      
      return combined.toString('base64');
    } catch (error) {
      this.logError('Token encryption failed', { error });
      throw ErrorFactory.domain.serviceError('EncryptionService', 'Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data (like refresh tokens)
   */
  public decryptSensitiveData(encryptedData: string): string {
    this.assertReady();
    
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw ErrorFactory.api.badRequest('Invalid encrypted data for decryption');
    }
    
    if (!this.encryptionKey) {
      throw ErrorFactory.domain.serviceError('EncryptionService', 'Encryption key not initialized');
    }
    
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      if (combined.length < EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH) {
        throw ErrorFactory.api.badRequest('Invalid encrypted data format');
      }
      
      // Extract IV, tag, and encrypted data
      const iv = combined.subarray(0, EncryptionService.IV_LENGTH);
      const tag = combined.subarray(EncryptionService.IV_LENGTH, EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH);
      const encrypted = combined.subarray(EncryptionService.IV_LENGTH + EncryptionService.TAG_LENGTH);
      
      const decipher = crypto.createDecipheriv(EncryptionService.ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      this.logDebug('Successfully decrypted sensitive data', {
        operation: 'decryption_success',
        metadata: { dataLength: decrypted.length },
      });
      
      return decrypted;
    } catch (error) {
      this.logError('Token decryption failed', { error });
      throw ErrorFactory.domain.serviceError('EncryptionService', 'Failed to decrypt sensitive data');
    }
  }

  /**
   * Generate a new encryption key (for key rotation)
   */
  public generateNewKey(): string {
    this.assertReady();
    
    const newKey = crypto.randomBytes(EncryptionService.KEY_LENGTH);
    const keyBase64 = newKey.toString('base64');
    
    this.logInfo('Generated new encryption key', {
      operation: 'encryption_key_generation',
    });
    
    return keyBase64;
  }

  /**
   * Rotate encryption key (requires re-encryption of all existing data)
   */
  public async rotateEncryptionKey(newKeyBase64: string): Promise<void> {
    this.assertReady();
    
    try {
      const newKey = Buffer.from(newKeyBase64, 'base64');
      if (newKey.length !== EncryptionService.KEY_LENGTH) {
        throw ErrorFactory.domain.serviceError('EncryptionService', `Invalid key length: ${newKey.length}, expected ${EncryptionService.KEY_LENGTH}`);
      }
      
      this.encryptionKey = newKey;
      
      this.logInfo('Encryption key rotated successfully', {
        operation: 'encryption_key_rotation',
      });
    } catch (error) {
      this.logError('Failed to rotate encryption key', { error });
      throw ErrorFactory.domain.serviceError('EncryptionService', 'Failed to rotate encryption key');
    }
  }

  /**
   * Get encryption service health status
   */
  public getHealth(): { healthy: boolean; details?: Record<string, unknown> } {
    return {
      healthy: this.isReady() && !!this.encryptionKey,
      details: {
        state: this._state,
        hasEncryptionKey: !!this.encryptionKey,
        algorithm: EncryptionService.ALGORITHM,
        keyLength: EncryptionService.KEY_LENGTH,
      },
    };
  }

  /**
   * Get encryption service statistics
   */
  public getStats(): { algorithm: string; keyLength: number; hasKey: boolean } {
    return {
      algorithm: EncryptionService.ALGORITHM,
      keyLength: EncryptionService.KEY_LENGTH,
      hasKey: !!this.encryptionKey,
    };
  }
}
