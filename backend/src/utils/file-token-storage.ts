import fs from 'fs/promises';
import path from 'path';
import { CryptoUtil } from './crypto.util';
import logger from './logger';

export interface FileTokenData {
  sessionId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
  createdAt: number;
  updatedAt: number;
}

export class FileTokenStorage {
  private readonly storagePath: string;
  
  constructor() {
    this.storagePath = path.join(process.cwd(), 'data', 'oauth-tokens');
  }

  async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create token storage directory', { 
        path: this.storagePath, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private getTokenFilePath(sessionId: string): string {
    // Use a safe filename based on session ID
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storagePath, `${safeSessionId}.json`);
  }

  async storeTokens(tokenData: FileTokenData): Promise<boolean> {
    try {
      await this.ensureStorageDirectory();
      
      const filePath = this.getTokenFilePath(tokenData.sessionId);
      
      // Encrypt sensitive data before storing
      const encryptedData = {
        ...tokenData,
        accessToken: CryptoUtil.encryptSensitiveData(tokenData.accessToken),
        refreshToken: tokenData.refreshToken ? CryptoUtil.encryptSensitiveData(tokenData.refreshToken) : undefined,
        updatedAt: Date.now()
      };
      
      await fs.writeFile(filePath, JSON.stringify(encryptedData, null, 2), 'utf8');
      
      logger.info('Stored OAuth tokens to file', { 
        sessionId: tokenData.sessionId,
        filePath: filePath,
        hasRefreshToken: !!tokenData.refreshToken
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to store OAuth tokens to file', { 
        sessionId: tokenData.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async getTokens(sessionId: string): Promise<FileTokenData | null> {
    try {
      const filePath = this.getTokenFilePath(sessionId);
      
      try {
        await fs.access(filePath);
      } catch {
        // File doesn't exist
        return null;
      }
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      const encryptedData = JSON.parse(fileContent);
      
      // Decrypt sensitive data
      const tokenData: FileTokenData = {
        ...encryptedData,
        accessToken: CryptoUtil.decryptSensitiveData(encryptedData.accessToken),
        refreshToken: encryptedData.refreshToken ? CryptoUtil.decryptSensitiveData(encryptedData.refreshToken) : undefined
      };
      
      // Check if token has expired
      if (tokenData.expiresAt < Date.now()) {
        logger.warn('Stored token has expired, removing file', { 
          sessionId,
          expiresAt: new Date(tokenData.expiresAt).toISOString()
        });
        
        await this.deleteTokens(sessionId);
        return null;
      }
      
      logger.debug('Retrieved OAuth tokens from file', { 
        sessionId,
        hasRefreshToken: !!tokenData.refreshToken,
        expiresAt: new Date(tokenData.expiresAt).toISOString()
      });
      
      return tokenData;
    } catch (error) {
      logger.error('Failed to retrieve OAuth tokens from file', { 
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  async deleteTokens(sessionId: string): Promise<boolean> {
    try {
      const filePath = this.getTokenFilePath(sessionId);
      
      try {
        await fs.unlink(filePath);
        logger.info('Deleted OAuth token file', { sessionId, filePath });
        return true;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, which is fine
          return true;
        }
        throw error;
      }
    } catch (error) {
      logger.error('Failed to delete OAuth token file', { 
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async listStoredSessions(): Promise<string[]> {
    try {
      await this.ensureStorageDirectory();
      
      const files = await fs.readdir(this.storagePath);
      const sessionIds = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', '').replace(/_/g, ':'));
      
      return sessionIds;
    } catch (error) {
      logger.error('Failed to list stored sessions', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const sessionIds = await this.listStoredSessions();
      let cleanupCount = 0;
      
      for (const sessionId of sessionIds) {
        const tokens = await this.getTokens(sessionId);
        if (!tokens) {
          // Token was expired and automatically deleted
          cleanupCount++;
        }
      }
      
      if (cleanupCount > 0) {
        logger.info('Cleaned up expired OAuth token files', { count: cleanupCount });
      }
      
      return cleanupCount;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }
}