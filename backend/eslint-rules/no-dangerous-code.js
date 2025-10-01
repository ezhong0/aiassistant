/**
 * ESLint rule to prevent dangerous code patterns
 *
 * Detects:
 * - eval() usage
 * - new Function() with string
 * - setTimeout/setInterval with string
 * - process.exit() outside allowed files
 * - Hardcoded secrets patterns
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent dangerous code patterns that pose security risks',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noEval: 'eval() is dangerous and should never be used. It can execute arbitrary code and poses security risks.',
      noFunctionConstructor: 'new Function() with string is dangerous. Use regular functions instead.',
      noStringTimeout: 'setTimeout/setInterval with string is dangerous. Use a function instead.',
      noProcessExit: 'process.exit() should only be used in main entry points. Use proper error handling instead.',
      possibleSecret: 'Possible hardcoded secret detected: "{{pattern}}". Use environment variables instead.',
      noBufferConstructor: 'new Buffer() is deprecated. Use Buffer.from() or Buffer.alloc() instead.',
    },
    schema: [{
      type: 'object',
      properties: {
        allowProcessExitIn: {
          type: 'array',
          items: { type: 'string' },
          description: 'File patterns where process.exit() is allowed',
        },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowProcessExitIn = options.allowProcessExitIn || [
      '**/index.ts',
      '**/scripts/**',
      '**/cli/**',
    ];

    const filename = context.getFilename();

    // Check if current file allows process.exit()
    const isProcessExitAllowed = allowProcessExitIn.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    });

    /**
     * Check if string looks like a hardcoded secret
     */
    function looksLikeSecret(value) {
      if (typeof value !== 'string') return false;

      // Common secret patterns
      const secretPatterns = [
        /api[_-]?key/i,
        /secret[_-]?key/i,
        /password/i,
        /auth[_-]?token/i,
        /access[_-]?token/i,
        /private[_-]?key/i,
        /aws[_-]?secret/i,
        /client[_-]?secret/i,
      ];

      return secretPatterns.some(pattern => pattern.test(value));
    }

    return {
      // Detect eval()
      CallExpression(node) {
        // eval()
        if (node.callee.type === 'Identifier' && node.callee.name === 'eval') {
          context.report({
            node,
            messageId: 'noEval',
          });
        }

        // setTimeout/setInterval with string
        if (
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'setTimeout' || node.callee.name === 'setInterval')
        ) {
          if (node.arguments[0] && node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'string') {
            context.report({
              node,
              messageId: 'noStringTimeout',
            });
          }
        }

        // process.exit()
        if (
          !isProcessExitAllowed &&
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'process' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'exit'
        ) {
          context.report({
            node,
            messageId: 'noProcessExit',
          });
        }
      },

      // Detect new Function()
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
          context.report({
            node,
            messageId: 'noFunctionConstructor',
          });
        }

        // Detect new Buffer()
        if (node.callee.type === 'Identifier' && node.callee.name === 'Buffer') {
          context.report({
            node,
            messageId: 'noBufferConstructor',
          });
        }
      },

      // Detect potential hardcoded secrets
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && looksLikeSecret(node.id.name)) {
          // Check if initialized with a literal string
          if (node.init && node.init.type === 'Literal' && typeof node.init.value === 'string') {
            // Ignore if it's clearly using env vars or is a placeholder
            const value = node.init.value;
            if (!value.includes('process.env') && !value.includes('YOUR_') && !value.includes('PLACEHOLDER')) {
              context.report({
                node,
                messageId: 'possibleSecret',
                data: {
                  pattern: node.id.name,
                },
              });
            }
          }
        }
      },
    };
  },
};
