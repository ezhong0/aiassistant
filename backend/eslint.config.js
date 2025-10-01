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
      '@typescript-eslint/no-explicit-any': 'error', // Treat 'any' as error

      // Function types
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'warn',

      // Promises and async
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Nullish handling
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // Best practices
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',

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
      'custom-rules/no-console-production': ['warn', {
        allowedFiles: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/scripts/**',
          '**/tests/**',
        ],
        allowedMethods: ['time', 'timeEnd'],
      }],

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
      'custom-rules/no-performance-antipatterns': 'warn',

      // ==========================================
      // Custom Rules - Code Quality
      // ==========================================
      'custom-rules/enforce-code-quality': ['warn', {
        maxComplexity: 10,
        maxLines: 50,
        maxParams: 4,
        maxDepth: 4,
        maxChained: 3,
        allowedNumbers: [0, 1, -1, 2, 100, 1000],
      }],

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
      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',
      'prefer-spread': 'warn',
      'prefer-rest-params': 'warn',

      // Error handling
      'no-throw-literal': 'error',

      // Complexity
      'complexity': ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', {
        max: 50,
        skipBlankLines: true,
        skipComments: true,
      }],
      'max-params': ['warn', 4],

      // Style (minimal - let Prettier handle formatting)
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['warn', 'always-multiline'],
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