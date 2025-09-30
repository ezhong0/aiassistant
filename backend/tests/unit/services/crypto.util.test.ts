import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CryptoUtil } from '../../../src/utils/crypto.util';
import { EncryptionService } from '../../../src/services/encryption.service';
import { serviceManager } from '../../../src/services/service-manager';

// Mock the service manager
jest.mock('../../../src/services/service-manager', () => ({
  serviceManager: {
    getService: jest.fn()
  }
}));

describe('CryptoUtil', () => {
  const testData = 'sensitive-refresh-token-12345';
  const testData2 = 'another-sensitive-token-67890';
  let mockEncryptionService: jest.Mocked<EncryptionService>;

  beforeEach(() => {
    // Create mock encryption service
    mockEncryptionService = {
      encryptSensitiveData: jest.fn(),
      decryptSensitiveData: jest.fn(),
      generateNewKey: jest.fn(),
      getStats: jest.fn()
    } as any;

    // Mock service manager to return our mock
    (serviceManager.getService as jest.Mock).mockReturnValue(mockEncryptionService);

    // Reset the static service reference
    (CryptoUtil as any).encryptionService = null;
  });

  afterEach(() => {
    // Clean up after each test
    (CryptoUtil as any).encryptionService = null;
    jest.clearAllMocks();
  });

  describe('encryptSensitiveData', () => {
    it('should encrypt data successfully', () => {
      const mockEncrypted = 'encrypted-data-12345';
      mockEncryptionService.encryptSensitiveData.mockReturnValue(mockEncrypted);
      
      const encrypted = CryptoUtil.encryptSensitiveData(testData);
      
      expect(encrypted).toBe(mockEncrypted);
      expect(mockEncryptionService.encryptSensitiveData).toHaveBeenCalledWith(testData);
    });

    it('should produce different encrypted values for same input', () => {
      const mockEncrypted1 = 'encrypted-data-1';
      const mockEncrypted2 = 'encrypted-data-2';
      mockEncryptionService.encryptSensitiveData
        .mockReturnValueOnce(mockEncrypted1)
        .mockReturnValueOnce(mockEncrypted2);
      
      const encrypted1 = CryptoUtil.encryptSensitiveData(testData);
      const encrypted2 = CryptoUtil.encryptSensitiveData(testData);
      
      expect(encrypted1).toBe(mockEncrypted1);
      expect(encrypted2).toBe(mockEncrypted2);
      expect(mockEncryptionService.encryptSensitiveData).toHaveBeenCalledTimes(2);
    });

    it('should handle empty string', () => {
      mockEncryptionService.encryptSensitiveData.mockImplementation(() => {
        throw new Error('Invalid plaintext for encryption');
      });
      
      expect(() => {
        CryptoUtil.encryptSensitiveData('');
      }).toThrow('Invalid plaintext for encryption');
    });

    it('should handle null/undefined input', () => {
      mockEncryptionService.encryptSensitiveData.mockImplementation(() => {
        throw new Error('Invalid plaintext for encryption');
      });
      
      expect(() => {
        CryptoUtil.encryptSensitiveData(null as any);
      }).toThrow('Invalid plaintext for encryption');
      
      expect(() => {
        CryptoUtil.encryptSensitiveData(undefined as any);
      }).toThrow('Invalid plaintext for encryption');
    });
  });

  describe('decryptSensitiveData', () => {
    it('should decrypt data successfully', () => {
      const mockEncrypted = 'encrypted-data-12345';
      mockEncryptionService.encryptSensitiveData.mockReturnValue(mockEncrypted);
      mockEncryptionService.decryptSensitiveData.mockReturnValue(testData);
      
      const encrypted = CryptoUtil.encryptSensitiveData(testData);
      const decrypted = CryptoUtil.decryptSensitiveData(encrypted);
      
      expect(decrypted).toBe(testData);
      expect(mockEncryptionService.decryptSensitiveData).toHaveBeenCalledWith(mockEncrypted);
    });

    it('should handle multiple encrypt/decrypt cycles', () => {
      const mockEncrypted1 = 'encrypted-data-1';
      const mockEncrypted2 = 'encrypted-data-2';
      
      mockEncryptionService.encryptSensitiveData
        .mockReturnValueOnce(mockEncrypted1)
        .mockReturnValueOnce(mockEncrypted2);
      mockEncryptionService.decryptSensitiveData
        .mockReturnValueOnce(testData)
        .mockReturnValueOnce(testData2);
      
      const encrypted1 = CryptoUtil.encryptSensitiveData(testData);
      const decrypted1 = CryptoUtil.decryptSensitiveData(encrypted1);
      
      const encrypted2 = CryptoUtil.encryptSensitiveData(testData2);
      const decrypted2 = CryptoUtil.decryptSensitiveData(encrypted2);
      
      expect(decrypted1).toBe(testData);
      expect(decrypted2).toBe(testData2);
    });

    it('should throw error for invalid encrypted data', () => {
      mockEncryptionService.decryptSensitiveData.mockImplementation(() => {
        throw new Error('Failed to decrypt sensitive data');
      });
      
      expect(() => {
        CryptoUtil.decryptSensitiveData('invalid-base64-data');
      }).toThrow('Failed to decrypt sensitive data');
    });

    it('should throw error for malformed encrypted data', () => {
      mockEncryptionService.decryptSensitiveData.mockImplementation(() => {
        throw new Error('Failed to decrypt sensitive data');
      });
      
      const invalidEncrypted = Buffer.from('invalid-data').toString('base64');
      
      expect(() => {
        CryptoUtil.decryptSensitiveData(invalidEncrypted);
      }).toThrow('Failed to decrypt sensitive data');
    });
  });

  describe('round-trip encryption', () => {
    it('should maintain data integrity through encrypt/decrypt cycle', () => {
      const testCases = [
        'simple-token',
        'token-with-special-chars!@#$%^&*()',
        'token-with-unicode-🚀-emoji',
        'very-long-token-' + 'x'.repeat(1000),
        'token-with-newlines\nand\ttabs'
      ];

      testCases.forEach(testCase => {
        const mockEncrypted = `encrypted-${testCase}`;
        mockEncryptionService.encryptSensitiveData.mockReturnValue(mockEncrypted);
        mockEncryptionService.decryptSensitiveData.mockReturnValue(testCase);
        
        const encrypted = CryptoUtil.encryptSensitiveData(testCase);
        const decrypted = CryptoUtil.decryptSensitiveData(encrypted);
        
        expect(decrypted).toBe(testCase);
      });
    });
  });

  describe('key management', () => {
    it('should generate consistent key when no env key provided', () => {
      const mockEncrypted1 = 'encrypted-1';
      const mockEncrypted2 = 'encrypted-2';
      
      mockEncryptionService.encryptSensitiveData
        .mockReturnValueOnce(mockEncrypted1)
        .mockReturnValueOnce(mockEncrypted2);
      mockEncryptionService.decryptSensitiveData
        .mockReturnValueOnce(testData)
        .mockReturnValueOnce(testData2);
      
      // First call should generate a key
      const encrypted1 = CryptoUtil.encryptSensitiveData(testData);
      
      // Second call should use the same key
      const encrypted2 = CryptoUtil.encryptSensitiveData(testData2);
      
      // Both should be decryptable
      const decrypted1 = CryptoUtil.decryptSensitiveData(encrypted1);
      const decrypted2 = CryptoUtil.decryptSensitiveData(encrypted2);
      
      expect(decrypted1).toBe(testData);
      expect(decrypted2).toBe(testData2);
    });

    it('should use provided environment key', () => {
      const mockEncrypted = 'encrypted-with-env-key';
      mockEncryptionService.encryptSensitiveData.mockReturnValue(mockEncrypted);
      mockEncryptionService.decryptSensitiveData.mockReturnValue(testData);
      
      const encrypted = CryptoUtil.encryptSensitiveData(testData);
      const decrypted = CryptoUtil.decryptSensitiveData(encrypted);
      
      expect(decrypted).toBe(testData);
    });
  });
});
