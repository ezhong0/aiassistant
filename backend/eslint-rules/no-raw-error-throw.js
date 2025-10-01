/**
 * ESLint rule to enforce ErrorFactory usage instead of raw Error throws
 *
 * This rule detects:
 * - throw new Error()
 * - throw Error()
 * - throw new TypeError()
 * - throw new RangeError()
 * And suggests using ErrorFactory instead
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce use of ErrorFactory instead of throwing raw Error objects',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      useErrorFactory: 'Use ErrorFactory instead of throwing raw Error. Example: ErrorFactory.domain.serviceError() or ErrorFactory.api.badRequest()',
      useErrorFactorySpecific: 'Use ErrorFactory.{{factoryMethod}}() instead of throwing {{errorType}}',
    },
    schema: [{
      type: 'object',
      properties: {
        allowedFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'File patterns to exclude from this rule',
        },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedFiles = options.allowedFiles || [
      // Allow raw errors in error system files themselves
      '**/errors/**',
      '**/types/**',
      // Allow in test files
      '**/*.test.ts',
      '**/*.spec.ts',
    ];

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
     * Suggest appropriate ErrorFactory method based on error message
     */
    function suggestFactoryMethod(errorMessage) {
      const message = errorMessage.toLowerCase();

      // API-related errors
      if (message.includes('unauthorized') || message.includes('authentication')) {
        return 'api.unauthorized';
      }
      if (message.includes('forbidden') || message.includes('permission')) {
        return 'api.forbidden';
      }
      if (message.includes('not found')) {
        return 'api.notFound';
      }
      if (message.includes('rate limit')) {
        return 'api.rateLimited';
      }
      if (message.includes('bad request') || message.includes('invalid')) {
        return 'api.badRequest';
      }

      // Service-related errors
      if (message.includes('service') && message.includes('unavailable')) {
        return 'domain.serviceUnavailable';
      }
      if (message.includes('timeout')) {
        return 'domain.serviceTimeout';
      }
      if (message.includes('service')) {
        return 'domain.serviceError';
      }

      // Validation errors
      if (message.includes('validation') || message.includes('invalid')) {
        return 'validation.fieldValidationFailed';
      }

      // Workflow errors
      if (message.includes('iteration') || message.includes('limit')) {
        return 'workflow.iterationLimit';
      }
      if (message.includes('workflow') || message.includes('execution')) {
        return 'workflow.executionFailed';
      }

      // Default suggestion
      return 'domain.serviceError or api.badRequest';
    }

    return {
      ThrowStatement(node) {
        const argument = node.argument;

        // Check for: throw new Error(...), throw new TypeError(...), etc.
        if (
          argument &&
          argument.type === 'NewExpression' &&
          argument.callee.type === 'Identifier'
        ) {
          const errorType = argument.callee.name;
          const isErrorType = [
            'Error',
            'TypeError',
            'RangeError',
            'ReferenceError',
            'SyntaxError',
            'URIError',
            'EvalError',
          ].includes(errorType);

          if (isErrorType) {
            // Try to extract error message for better suggestion
            const errorMessage =
              argument.arguments[0]?.type === 'Literal'
                ? argument.arguments[0].value
                : '';

            const suggestedMethod = suggestFactoryMethod(errorMessage);

            context.report({
              node,
              messageId: 'useErrorFactorySpecific',
              data: {
                errorType,
                factoryMethod: suggestedMethod,
              },
            });
          }
        }

        // Check for: throw Error(...) without new
        if (
          argument &&
          argument.type === 'CallExpression' &&
          argument.callee.type === 'Identifier' &&
          argument.callee.name === 'Error'
        ) {
          context.report({
            node,
            messageId: 'useErrorFactory',
          });
        }
      },
    };
  },
};
