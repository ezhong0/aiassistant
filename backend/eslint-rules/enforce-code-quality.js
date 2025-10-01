/**
 * ESLint rule to enforce code quality standards
 *
 * Checks:
 * - Cyclomatic complexity
 * - Function length
 * - Parameter count
 * - Nesting depth
 * - Magic numbers
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce code quality standards for maintainability',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      tooComplex: 'Function has complexity of {{complexity}}. Maximum allowed is {{max}}. Consider breaking it down into smaller functions.',
      tooLong: 'Function is {{lines}} lines long. Maximum allowed is {{max}}. Consider breaking it down.',
      tooManyParams: 'Function has {{count}} parameters. Maximum allowed is {{max}}. Consider using an options object.',
      tooDeepNesting: 'Code is nested {{depth}} levels deep. Maximum allowed is {{max}}. Consider extracting nested logic.',
      magicNumber: 'Magic number {{value}} detected. Use a named constant instead.',
      tooManyChained: 'Too many chained method calls ({{count}}). Consider breaking into multiple statements for readability.',
    },
    schema: [{
      type: 'object',
      properties: {
        maxComplexity: {
          type: 'number',
          default: 10,
        },
        maxLines: {
          type: 'number',
          default: 50,
        },
        maxParams: {
          type: 'number',
          default: 4,
        },
        maxDepth: {
          type: 'number',
          default: 4,
        },
        maxChained: {
          type: 'number',
          default: 3,
        },
        allowedNumbers: {
          type: 'array',
          items: { type: 'number' },
          default: [0, 1, -1, 2],
        },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const options = context.options[0] || {};
    const maxComplexity = options.maxComplexity || 10;
    const maxLines = options.maxLines || 50;
    const maxParams = options.maxParams || 4;
    const maxDepth = options.maxDepth || 4;
    const maxChained = options.maxChained || 3;
    const allowedNumbers = options.allowedNumbers || [0, 1, -1, 2];

    const filename = context.getFilename();

    // Skip test files
    if (filename.includes('.test.') || filename.includes('.spec.')) {
      return {};
    }

    let currentDepth = 0;
    const functionComplexity = new Map();

    /**
     * Calculate cyclomatic complexity
     */
    function incrementComplexity(node) {
      let func = node;
      while (func && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(func.type)) {
        func = func.parent;
      }
      if (func) {
        const current = functionComplexity.get(func) || 1;
        functionComplexity.set(func, current + 1);
      }
    }

    /**
     * Count chained method calls
     */
    function countChainedCalls(node) {
      let count = 0;
      let current = node;

      while (current.type === 'MemberExpression' || current.type === 'CallExpression') {
        if (current.type === 'CallExpression') {
          count++;
          current = current.callee;
        } else {
          current = current.object;
        }
      }

      return count;
    }

    return {
      // Track function start
      FunctionDeclaration(node) {
        functionComplexity.set(node, 1);

        // Check parameter count
        if (node.params.length > maxParams) {
          context.report({
            node,
            messageId: 'tooManyParams',
            data: {
              count: node.params.length,
              max: maxParams,
            },
          });
        }
      },

      FunctionExpression(node) {
        functionComplexity.set(node, 1);

        if (node.params.length > maxParams) {
          context.report({
            node,
            messageId: 'tooManyParams',
            data: {
              count: node.params.length,
              max: maxParams,
            },
          });
        }
      },

      ArrowFunctionExpression(node) {
        functionComplexity.set(node, 1);

        if (node.params.length > maxParams) {
          context.report({
            node,
            messageId: 'tooManyParams',
            data: {
              count: node.params.length,
              max: maxParams,
            },
          });
        }
      },

      // Check function complexity and length on exit
      'FunctionDeclaration:exit'(node) {
        const complexity = functionComplexity.get(node) || 1;
        if (complexity > maxComplexity) {
          context.report({
            node,
            messageId: 'tooComplex',
            data: {
              complexity,
              max: maxComplexity,
            },
          });
        }

        // Check function length
        const lines = node.loc.end.line - node.loc.start.line;
        if (lines > maxLines) {
          context.report({
            node,
            messageId: 'tooLong',
            data: {
              lines,
              max: maxLines,
            },
          });
        }
      },

      'FunctionExpression:exit'(node) {
        const complexity = functionComplexity.get(node) || 1;
        if (complexity > maxComplexity) {
          context.report({
            node,
            messageId: 'tooComplex',
            data: {
              complexity,
              max: maxComplexity,
            },
          });
        }

        const lines = node.loc.end.line - node.loc.start.line;
        if (lines > maxLines) {
          context.report({
            node,
            messageId: 'tooLong',
            data: {
              lines,
              max: maxLines,
            },
          });
        }
      },

      // Increment complexity for control flow
      IfStatement(node) {
        incrementComplexity(node);
      },

      ConditionalExpression(node) {
        incrementComplexity(node);
      },

      LogicalExpression(node) {
        if (node.operator === '||' || node.operator === '&&') {
          incrementComplexity(node);
        }
      },

      ForStatement(node) {
        incrementComplexity(node);
      },

      ForInStatement(node) {
        incrementComplexity(node);
      },

      ForOfStatement(node) {
        incrementComplexity(node);
      },

      WhileStatement(node) {
        incrementComplexity(node);
      },

      DoWhileStatement(node) {
        incrementComplexity(node);
      },

      CatchClause(node) {
        incrementComplexity(node);
      },

      SwitchCase(node) {
        if (node.test) {
          incrementComplexity(node);
        }
      },

      // Track nesting depth
      BlockStatement() {
        currentDepth++;
        if (currentDepth > maxDepth) {
          // Only report once per function
          const sourceCode = context.getSourceCode();
          const token = sourceCode.getFirstToken(arguments[0]);

          if (token) {
            context.report({
              loc: token.loc,
              messageId: 'tooDeepNesting',
              data: {
                depth: currentDepth,
                max: maxDepth,
              },
            });
          }
        }
      },

      'BlockStatement:exit'() {
        currentDepth--;
      },

      // Detect magic numbers
      Literal(node) {
        if (typeof node.value === 'number' && !allowedNumbers.includes(node.value)) {
          // Skip if in variable declaration or const
          const parent = node.parent;
          if (
            parent.type === 'VariableDeclarator' ||
            (parent.type === 'VariableDeclaration' && parent.kind === 'const')
          ) {
            return;
          }

          // Skip array indices
          if (
            parent.type === 'MemberExpression' &&
            parent.computed &&
            parent.property === node
          ) {
            return;
          }

          context.report({
            node,
            messageId: 'magicNumber',
            data: {
              value: node.value,
            },
          });
        }
      },

      // Detect excessive method chaining
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression') {
          const chainLength = countChainedCalls(node);
          if (chainLength > maxChained) {
            context.report({
              node,
              messageId: 'tooManyChained',
              data: {
                count: chainLength,
              },
            });
          }
        }
      },
    };
  },
};
