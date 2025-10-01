const baseConfig = require('./eslint.config');

/**
 * Strict ESLint Configuration for Production/CI
 *
 * All warnings are treated as errors
 * All rules are maximally enforced
 * Use this for:
 * - Production builds
 * - CI/CD pipelines
 * - Pre-release checks
 *
 * Usage: NODE_ENV=production eslint --config eslint.config.strict.js src/**/*.ts
 */

// Deep clone and modify the base config
const strictConfig = JSON.parse(JSON.stringify(baseConfig));

// Convert all 'warn' to 'error' in the main config
const mainConfig = strictConfig[1];
if (mainConfig && mainConfig.rules) {
  Object.keys(mainConfig.rules).forEach(ruleName => {
    const ruleConfig = mainConfig.rules[ruleName];

    if (ruleConfig === 'warn') {
      mainConfig.rules[ruleName] = 'error';
    } else if (Array.isArray(ruleConfig) && ruleConfig[0] === 'warn') {
      mainConfig.rules[ruleName][0] = 'error';
    }
  });

  // Additional strict rules for production
  mainConfig.rules['no-console'] = 'error'; // No console at all
  mainConfig.rules['no-debugger'] = 'error';
  mainConfig.rules['@typescript-eslint/no-explicit-any'] = 'error';
  mainConfig.rules['custom-rules/no-console-production'] = 'error';
  mainConfig.rules['custom-rules/enforce-code-quality'] = 'error';
  mainConfig.rules['custom-rules/no-performance-antipatterns'] = 'error';
}

module.exports = strictConfig;
