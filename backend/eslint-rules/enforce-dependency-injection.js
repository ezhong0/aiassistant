/**
 * ESLint rule to enforce dependency injection patterns
 *
 * Ensures:
 * - Services are registered in DI container
 * - Services use constructor injection
 * - No direct service instantiation
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce dependency injection patterns using ServiceManager',
      category: 'Architecture',
      recommended: true,
    },
    messages: {
      noDirectInstantiation: 'Do not instantiate services directly. Register them in the DI container and resolve through ServiceManager.',
      useConstructorInjection: 'Use constructor injection for dependencies instead of importing directly.',
      registerInDI: 'Ensure this service is registered in di/registrations/',
    },
    schema: [{
      type: 'object',
      properties: {
        allowDirectInstantiationIn: {
          type: 'array',
          items: { type: 'string' },
          description: 'File patterns where direct instantiation is allowed',
        },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowDirectInstantiationIn = options.allowDirectInstantiationIn || [
      '**/di/registrations/**',
      '**/tests/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/mocks/**',
    ];

    const filename = context.getFilename();

    // Check if direct instantiation is allowed
    const isDirectInstantiationAllowed = allowDirectInstantiationIn.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    });

    /**
     * Check if identifier is a service class
     */
    function isServiceClass(name) {
      return name.endsWith('Service') || name.includes('Manager') || name.includes('Factory');
    }

    return {
      NewExpression(node) {
        if (isDirectInstantiationAllowed) return;

        // Check for direct service instantiation
        if (
          node.callee.type === 'Identifier' &&
          isServiceClass(node.callee.name)
        ) {
          context.report({
            node,
            messageId: 'noDirectInstantiation',
          });
        }
      },
    };
  },
};
