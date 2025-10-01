/**
 * Development ESLint Configuration
 *
 * More lenient rules for development
 * Focuses on critical errors only
 * Use this for:
 * - Local development
 * - Fast feedback loops
 * - Prototyping
 *
 * Usage: eslint --config .eslintrc.dev.js src/**/*.ts
 */

module.exports = {
  extends: './eslint.config.js',
  rules: {
    // Relax code quality rules during development
    'custom-rules/enforce-code-quality': 'off',
    'complexity': 'off',
    'max-lines-per-function': 'off',
    'max-depth': 'off',

    // Keep critical rules
    'custom-rules/no-raw-error-throw': 'error',
    'custom-rules/no-dangerous-code': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',

    // Warn on architecture violations
    'custom-rules/enforce-base-service': 'warn',
    'custom-rules/enforce-layer-boundaries': 'warn',
    'custom-rules/enforce-dependency-injection': 'warn',
  },
};
