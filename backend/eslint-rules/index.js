/**
 * Custom ESLint Plugin for AI Assistant App
 *
 * Enforces:
 * - Error handling patterns using ErrorFactory
 * - Security best practices
 * - Architecture boundaries
 * - Dependency injection patterns
 * - Performance best practices
 * - Code quality standards
 */

const noRawErrorThrow = require('./no-raw-error-throw');
const noDangerousCode = require('./no-dangerous-code');
const noConsoleProduction = require('./no-console-production');
const enforceBaseService = require('./enforce-base-service');
const enforceLayerBoundaries = require('./enforce-layer-boundaries');
const enforceDependencyInjection = require('./enforce-dependency-injection');
const noPerformanceAntipatterns = require('./no-performance-antipatterns');
const enforceCodeQuality = require('./enforce-code-quality');

module.exports = {
  rules: {
    // Error handling
    'no-raw-error-throw': noRawErrorThrow,

    // Security
    'no-dangerous-code': noDangerousCode,
    'no-console-production': noConsoleProduction,

    // Architecture
    'enforce-base-service': enforceBaseService,
    'enforce-layer-boundaries': enforceLayerBoundaries,
    'enforce-dependency-injection': enforceDependencyInjection,

    // Performance
    'no-performance-antipatterns': noPerformanceAntipatterns,

    // Code quality
    'enforce-code-quality': enforceCodeQuality,
  },
  configs: {
    recommended: {
      plugins: ['custom-rules'],
      rules: {
        // Error handling - ERROR
        'custom-rules/no-raw-error-throw': 'error',

        // Security - ERROR
        'custom-rules/no-dangerous-code': 'error',
        'custom-rules/no-console-production': 'warn',

        // Architecture - ERROR
        'custom-rules/enforce-base-service': 'error',
        'custom-rules/enforce-layer-boundaries': 'error',
        'custom-rules/enforce-dependency-injection': 'error',

        // Performance - WARN
        'custom-rules/no-performance-antipatterns': 'warn',

        // Code quality - WARN
        'custom-rules/enforce-code-quality': 'warn',
      },
    },
    strict: {
      plugins: ['custom-rules'],
      rules: {
        // All rules as ERROR
        'custom-rules/no-raw-error-throw': 'error',
        'custom-rules/no-dangerous-code': 'error',
        'custom-rules/no-console-production': 'error',
        'custom-rules/enforce-base-service': 'error',
        'custom-rules/enforce-layer-boundaries': 'error',
        'custom-rules/enforce-dependency-injection': 'error',
        'custom-rules/no-performance-antipatterns': 'error',
        'custom-rules/enforce-code-quality': 'error',
      },
    },
  },
};
