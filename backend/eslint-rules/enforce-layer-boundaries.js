/**
 * ESLint rule to enforce architectural layer boundaries
 *
 * Prevents:
 * - Routes from importing services directly (should use DI)
 * - Services from importing routes
 * - Circular dependencies between services
 * - Domain layer violations
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce architectural layer boundaries and prevent improper imports',
      category: 'Architecture',
      recommended: true,
    },
    messages: {
      noDirectServiceImport: 'Routes should not import services directly. Use dependency injection via ServiceManager instead.',
      noRouteImportInService: 'Services should not import routes. This violates separation of concerns.',
      noCircularDependency: 'Potential circular dependency detected between services.',
      noCrossLayerImport: 'Invalid cross-layer import: {{from}} cannot import from {{to}}',
      useServiceManager: 'Import services through ServiceManager for proper dependency injection.',
    },
    schema: [{
      type: 'object',
      properties: {
        layers: {
          type: 'object',
          description: 'Layer definitions and allowed dependencies',
        },
      },
      additionalProperties: false,
    }],
  },

  create(context) {
    const filename = context.getFilename();

    /**
     * Determine which layer a file belongs to
     */
    function getFileLayer(filePath) {
      if (filePath.includes('/routes/')) return 'routes';
      if (filePath.includes('/services/')) return 'services';
      if (filePath.includes('/agents/')) return 'agents';
      if (filePath.includes('/middleware/')) return 'middleware';
      if (filePath.includes('/utils/')) return 'utils';
      if (filePath.includes('/types/')) return 'types';
      if (filePath.includes('/errors/')) return 'errors';
      if (filePath.includes('/schemas/')) return 'schemas';
      if (filePath.includes('/di/')) return 'di';
      return 'other';
    }

    /**
     * Check if import is allowed based on layer rules
     */
    function isImportAllowed(fromLayer, toLayer, importPath) {
      const rules = {
        'routes': {
          allowed: ['middleware', 'utils', 'types', 'errors', 'schemas', 'di'],
          forbidden: ['services', 'agents'],
          message: 'Routes should use dependency injection for services and agents',
        },
        'services': {
          allowed: ['utils', 'types', 'errors', 'schemas'],
          forbidden: ['routes', 'middleware'],
          message: 'Services should not import routes or middleware',
        },
        'agents': {
          allowed: ['utils', 'types', 'errors', 'schemas'],
          forbidden: ['routes', 'services'],
          message: 'Agents should not import routes or services directly',
        },
        'middleware': {
          allowed: ['utils', 'types', 'errors', 'schemas', 'di'],
          forbidden: ['routes', 'agents'],
          message: 'Middleware should not import routes or agents',
        },
      };

      const layerRules = rules[fromLayer];
      if (!layerRules) return { allowed: true };

      // Check if explicitly forbidden
      if (layerRules.forbidden.includes(toLayer)) {
        return {
          allowed: false,
          reason: layerRules.message,
        };
      }

      return { allowed: true };
    }

    /**
     * Check if import path is a service
     */
    function isServiceImport(importPath) {
      return importPath.includes('/services/') && importPath.endsWith('.service');
    }

    /**
     * Check if import path is a route
     */
    function isRouteImport(importPath) {
      return importPath.includes('/routes/');
    }

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;

        // Skip external packages and relative parent imports
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
          return;
        }

        const currentLayer = getFileLayer(filename);
        const importLayer = getFileLayer(importPath);

        // Special checks for routes importing services
        if (currentLayer === 'routes' && isServiceImport(importPath)) {
          context.report({
            node,
            messageId: 'noDirectServiceImport',
          });
          return;
        }

        // Check for services importing routes
        if (currentLayer === 'services' && isRouteImport(importPath)) {
          context.report({
            node,
            messageId: 'noRouteImportInService',
          });
          return;
        }

        // Check layer boundary rules
        const importCheck = isImportAllowed(currentLayer, importLayer, importPath);
        if (!importCheck.allowed) {
          context.report({
            node,
            messageId: 'noCrossLayerImport',
            data: {
              from: currentLayer,
              to: importLayer,
            },
          });
        }

        // Check for circular dependencies between services
        if (
          currentLayer === 'services' &&
          importLayer === 'services' &&
          !importPath.includes('base-service')
        ) {
          // This is a simplified check - a full circular dependency detector would require a graph
          const currentServiceName = filename.match(/([^/]+)\.service\.ts$/)?.[1];
          const importServiceName = importPath.match(/([^/]+)\.service/)?.[1];

          if (currentServiceName && importServiceName && currentServiceName !== importServiceName) {
            context.report({
              node,
              messageId: 'noCircularDependency',
            });
          }
        }
      },
    };
  },
};
