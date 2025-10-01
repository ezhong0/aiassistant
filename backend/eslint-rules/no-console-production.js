/**
 * ESLint rule to prevent console.log in production code
 *
 * Allows console in:
 * - Test files
 * - Scripts
 * - Development utilities
 *
 * Warns about console.log, suggests using logger instead
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prevent console.log in production code, use logger instead',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noConsole: 'Avoid console.{{method}}() in production code. Use logger.{{loggerMethod}}() from utils/logger instead.',
      noConsoleGeneric: 'Avoid console.{{method}}() in production code. Use the logger utility instead.',
    },
    schema: [{
      type: 'object',
      properties: {
        allowedFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'File patterns to exclude from this rule',
        },
        allowedMethods: {
          type: 'array',
          items: { type: 'string' },
          description: 'Console methods that are allowed',
        },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedFiles = options.allowedFiles || [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/scripts/**',
      '**/tests/**',
      '**/dev/**',
    ];
    const allowedMethods = options.allowedMethods || [];

    const filename = context.getFilename();

    // Check if current file is excluded
    const isExcluded = allowedFiles.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    });

    if (isExcluded) {
      return {};
    }

    /**
     * Get suggested logger method
     */
    function getLoggerMethod(consoleMethod) {
      const mapping = {
        'log': 'info',
        'info': 'info',
        'warn': 'warn',
        'error': 'error',
        'debug': 'debug',
      };
      return mapping[consoleMethod] || null;
    }

    return {
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'console' &&
          node.property.type === 'Identifier'
        ) {
          const method = node.property.name;

          // Skip if method is allowed
          if (allowedMethods.includes(method)) {
            return;
          }

          const loggerMethod = getLoggerMethod(method);

          if (loggerMethod) {
            context.report({
              node,
              messageId: 'noConsole',
              data: {
                method,
                loggerMethod,
              },
            });
          } else {
            context.report({
              node,
              messageId: 'noConsoleGeneric',
              data: {
                method,
              },
            });
          }
        }
      },
    };
  },
};
