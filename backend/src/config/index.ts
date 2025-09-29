/**
 * Consolidated Configuration Export
 * 
 * Clean, elegant configuration access for the entire application.
 * This replaces all previous config services with a unified approach.
 */

// Export the main configuration service and types
export { 
  UnifiedConfigService, 
  config as unifiedConfig,
  type UnifiedConfig,
  type EnvironmentConfig,
  type AuthConfig,
  type ServicesConfig,
  type AIConfig,
  type SecurityConfig 
} from './unified-config';

// Convenience aliases for clean imports
export { config as default } from './unified-config';

// Example of clean usage:
// import { config } from './config';
