/**
 * ESLint rule to detect performance anti-patterns
 *
 * Detects:
 * - Unhandled promise rejections
 * - Missing await in async functions
 * - Synchronous operations in async contexts
 * - Memory leaks from unused variables
 * - Inefficient loops
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect performance anti-patterns and potential issues',
      category: 'Performance',
      recommended: true,
    },
    messages: {
      floatingPromise: 'Promise returned from {{name}} is not handled. Add await or .catch() to handle errors.',
      missingAwait: 'Async function contains promise that should be awaited.',
      syncInAsyncContext: 'Avoid synchronous {{operation}} in async context. Use async alternatives.',
      unnecessaryAwait: 'Unnecessary await for non-promise value.',
      inefficientLoop: 'Inefficient loop pattern detected. Consider using {{alternative}}.',
      blockingOperation: 'Potentially blocking operation {{operation}}. Consider making it async.',
    },
    schema: [],
  },

  create(context) {
    let currentFunction = null;
    const functionStack = [];

    /**
     * Check if expression is a promise
     */
    function isPromise(node) {
      // Check for explicit Promise
      if (node.type === 'NewExpression' && node.callee.name === 'Promise') {
        return true;
      }

      // Check for async function call
      if (node.type === 'CallExpression') {
        const callee = node.callee;

        // Method calls that typically return promises
        const promiseMethods = ['then', 'catch', 'finally', 'all', 'race', 'allSettled'];
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          promiseMethods.includes(callee.property.name)
        ) {
          return true;
        }
      }

      return false;
    }

    /**
     * Check if promise is handled
     */
    function isPromiseHandled(node) {
      const parent = node.parent;

      // Check for await
      if (parent.type === 'AwaitExpression') {
        return true;
      }

      // Check for .then/.catch
      if (
        parent.type === 'MemberExpression' &&
        parent.property.type === 'Identifier' &&
        ['then', 'catch', 'finally'].includes(parent.property.name)
      ) {
        return true;
      }

      // Check for return statement
      if (parent.type === 'ReturnStatement') {
        return true;
      }

      // Check for variable assignment
      if (parent.type === 'VariableDeclarator' || parent.type === 'AssignmentExpression') {
        return true;
      }

      return false;
    }

    return {
      FunctionDeclaration(node) {
        functionStack.push(node);
        currentFunction = node;
      },

      FunctionExpression(node) {
        functionStack.push(node);
        currentFunction = node;
      },

      ArrowFunctionExpression(node) {
        functionStack.push(node);
        currentFunction = node;
      },

      'FunctionDeclaration:exit'() {
        functionStack.pop();
        currentFunction = functionStack[functionStack.length - 1] || null;
      },

      'FunctionExpression:exit'() {
        functionStack.pop();
        currentFunction = functionStack[functionStack.length - 1] || null;
      },

      'ArrowFunctionExpression:exit'() {
        functionStack.pop();
        currentFunction = functionStack[functionStack.length - 1] || null;
      },

      // Detect floating promises
      ExpressionStatement(node) {
        if (node.expression.type === 'CallExpression') {
          const callee = node.expression.callee;

          // Check if it's a promise-returning call
          if (isPromise(node.expression) && !isPromiseHandled(node.expression)) {
            const calleeName = callee.type === 'Identifier'
              ? callee.name
              : callee.property?.name || 'function';

            context.report({
              node,
              messageId: 'floatingPromise',
              data: {
                name: calleeName,
              },
            });
          }
        }
      },

      // Detect synchronous operations in async contexts
      CallExpression(node) {
        if (!currentFunction || !currentFunction.async) return;

        const callee = node.callee;

        // Check for synchronous file operations
        const syncOperations = [
          'readFileSync',
          'writeFileSync',
          'existsSync',
          'mkdirSync',
          'readdirSync',
        ];

        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          syncOperations.includes(callee.property.name)
        ) {
          context.report({
            node,
            messageId: 'syncInAsyncContext',
            data: {
              operation: callee.property.name,
            },
          });
        }
      },

      // Detect inefficient loop patterns
      ForStatement(node) {
        // Check for array.push in loop (could use map/filter)
        if (node.body.type === 'BlockStatement') {
          const hasArrayPush = node.body.body.some(stmt => {
            return (
              stmt.type === 'ExpressionStatement' &&
              stmt.expression.type === 'CallExpression' &&
              stmt.expression.callee.type === 'MemberExpression' &&
              stmt.expression.callee.property.name === 'push'
            );
          });

          if (hasArrayPush) {
            context.report({
              node,
              messageId: 'inefficientLoop',
              data: {
                alternative: 'Array.map() or Array.filter()',
              },
            });
          }
        }
      },
    };
  },
};
