const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const customRulesPlugin = require('./eslint-rules');

/**
 * Comprehensive ESLint Configuration for AI Assistant App
 *
 * Enforces:
 * - TypeScript strict type checking
 * - Custom error handling patterns
 * - Security best practices
 * - Architecture boundaries and patterns
 * - Performance best practices
 * - Code quality standards
 */

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        NodeJS: 'readonly',
        fetch: 'readonly', // Node 18+ native fetch
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'custom-rules': customRulesPlugin,
    },
    rules: {
      // ==========================================
      // TypeScript Rules - Strict Type Safety
      // ==========================================
      ...tsPlugin.configs.recommended.rules,

      // Variables and types
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn', // Warn on any usage - should have explicit types

      // Function types
      '@typescript-eslint/explicit-function-return-type': 'off', // Allow implicit return types
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',

      // Promises and async
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Nullish handling
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Stylistic preference
      '@typescript-eslint/prefer-optional-chain': 'off', // Stylistic preference

      // Best practices
      '@typescript-eslint/prefer-for-of': 'off',
      '@typescript-eslint/prefer-as-const': 'off',

      // ==========================================
      // Custom Rules - Error Handling
      // ==========================================
      'custom-rules/no-raw-error-throw': ['error', {
        allowedFiles: [
          '**/errors/**',
          '**/types/**',
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/eslint-rules/**',
          '**/scripts/**',
        ],
      }],

      // ==========================================
      // Custom Rules - Security
      // ==========================================
      'custom-rules/no-dangerous-code': ['error', {
        allowProcessExitIn: [
          '**/index.ts',
          '**/scripts/**',
        ],
      }],
      'custom-rules/no-console-production': 'off', // Allow console usage with logger abstraction

      // ==========================================
      // Custom Rules - Architecture
      // ==========================================
      'custom-rules/enforce-base-service': ['error', {
        serviceDirectories: ['**/services/**'],
        excludePatterns: [
          '**/mocks/**',
          '**/types/**',
          '**/*.test.ts',
          '**/base-service.ts',
        ],
      }],
      'custom-rules/enforce-layer-boundaries': 'error',
      'custom-rules/enforce-dependency-injection': ['error', {
        allowDirectInstantiationIn: [
          '**/di/registrations/**',
          '**/tests/**',
          '**/*.test.ts',
          '**/mocks/**',
        ],
      }],

      // ==========================================
      // Custom Rules - Performance
      // ==========================================
      'custom-rules/no-performance-antipatterns': 'off', // Disable for flexibility

      // ==========================================
      // Custom Rules - Code Quality
      // ==========================================
      'custom-rules/enforce-code-quality': 'off', // Disable code quality metrics warnings

      // ==========================================
      // Standard ESLint Rules
      // ==========================================

      // Best practices
      'no-console': 'off', // Handled by custom rule
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      // Restrict process.env usage - use UnifiedConfig instead
      // Exceptions: unified-config.ts (reads env), logger.ts (circular dependency),
      // debug routes, sentry (optional config), base-route-handler (fallback error)
      'no-process-env': 'warn',
      'prefer-arrow-callback': 'off',
      'prefer-template': 'off',
      'prefer-spread': 'off',
      'prefer-rest-params': 'off',

      // Error handling
      'no-throw-literal': 'error',

      // Complexity - turned off for flexibility
      'complexity': 'off',
      'max-depth': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',

      // Style (minimal - let Prettier handle formatting)
      'quotes': 'off',
      'semi': ['error', 'always'],
      'comma-dangle': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      // Relax rules for tests
      '@typescript-eslint/no-explicit-any': 'off',
      'custom-rules/no-raw-error-throw': 'off',
      'custom-rules/enforce-code-quality': 'off',
      'custom-rules/enforce-base-service': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['**/config/unified-config.ts', '**/config/config-loader.ts', '**/utils/logger.ts'],
    rules: {
      // These files are the source of truth for env vars - allow process.env
      'no-process-env': 'off',
    },
  },
  {
    files: ['**/config/config-loader.ts'],
    rules: {
      // Legacy config loader - allow some flexibility
      '@typescript-eslint/no-explicit-any': 'off',
      'custom-rules/no-raw-error-throw': 'off',
    },
  },
  {
    files: ['**/sentry.service.ts'],
    rules: {
      // Sentry needs process.env for optional DSN and version
      'no-process-env': 'off',
    },
  },
  {
    files: ['**/framework/base-route-handler.ts'],
    rules: {
      // Fallback error handling in base class - allow process.env for NODE_ENV
      'no-process-env': 'off',
    },
  },
  {
    files: ['**/routes/auth/debug/**/*.ts'],
    rules: {
      // Debug routes can use process.env - they're excluded from production build
      'no-process-env': 'off',
    },
  },
  {
    files: ['**/services/api/**/*.ts', '**/services/ai-circuit-breaker.service.ts'],
    rules: {
      // E2E_TESTING is a test-specific env var - allow in API clients
      // These are documented with inline comments
      'no-process-env': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '*.js',
      '!eslint.config.js',
      '!eslint-rules/**/*.js',
    ],
  },
];