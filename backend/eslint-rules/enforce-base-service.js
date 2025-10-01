/**
 * ESLint rule to enforce BaseService inheritance for services
 *
 * Ensures all services in the services/ directory extend BaseService
 * This provides consistent lifecycle management, error handling, and logging
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce BaseService inheritance for all services',
      category: 'Architecture',
      recommended: true,
    },
    messages: {
      mustExtendBaseService: 'Service classes must extend BaseService for consistent lifecycle management and error handling.',
      missingOnInitialize: 'Services extending BaseService must implement the onInitialize() method.',
      missingOnDestroy: 'Services extending BaseService must implement the onDestroy() method.',
      useHandleError: 'Use this.handleError() instead of throwing raw errors in service methods.',
      useAssertReady: 'Check service readiness with this.assertReady() before performing operations.',
    },
    schema: [{
      type: 'object',
      properties: {
        serviceDirectories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Directories where services must extend BaseService',
        },
        excludePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to exclude from this rule',
        },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const options = context.options[0] || {};
    const serviceDirectories = options.serviceDirectories || [
      '**/services/**',
    ];
    const excludePatterns = options.excludePatterns || [
      '**/mocks/**',
      '**/types/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/base-service.ts',
    ];

    const filename = context.getFilename();

    // Check if this is a service file
    const isServiceFile = serviceDirectories.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename) && filename.endsWith('.service.ts');
    });

    // Check if file is excluded
    const isExcluded = excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    });

    if (!isServiceFile || isExcluded) {
      return {};
    }

    let classNode = null;
    let extendsBaseService = false;
    let hasOnInitialize = false;
    let hasOnDestroy = false;

    return {
      ClassDeclaration(node) {
        classNode = node;

        // Check if extends BaseService
        if (node.superClass) {
          if (node.superClass.type === 'Identifier' && node.superClass.name === 'BaseService') {
            extendsBaseService = true;
          }
        }

        // If doesn't extend BaseService, report
        if (!extendsBaseService) {
          context.report({
            node,
            messageId: 'mustExtendBaseService',
          });
        }
      },

      MethodDefinition(node) {
        if (!extendsBaseService || !classNode) return;

        // Check for onInitialize
        if (
          node.key.type === 'Identifier' &&
          node.key.name === 'onInitialize'
        ) {
          hasOnInitialize = true;
        }

        // Check for onDestroy
        if (
          node.key.type === 'Identifier' &&
          node.key.name === 'onDestroy'
        ) {
          hasOnDestroy = true;
        }
      },

      'Program:exit'() {
        if (!extendsBaseService || !classNode) return;

        // Check if abstract methods are implemented
        if (!hasOnInitialize) {
          context.report({
            node: classNode,
            messageId: 'missingOnInitialize',
          });
        }

        if (!hasOnDestroy) {
          context.report({
            node: classNode,
            messageId: 'missingOnDestroy',
          });
        }
      },
    };
  },
};
