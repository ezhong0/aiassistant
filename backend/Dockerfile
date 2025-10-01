# Use Node.js 20 Alpine for smaller size
FROM node:20-alpine AS base

# Install build dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with npm ci for faster, reliable builds
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy production dependencies from base stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check - comprehensive application health monitoring
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
  CMD node -e " \
    const http = require('http'); \
    const options = { \
      hostname: 'localhost', \
      port: 3000, \
      path: '/healthz', \
      method: 'GET', \
      timeout: 10000 \
    }; \
    const req = http.request(options, (res) => { \
      if (res.statusCode === 200) { \
        let data = ''; \
        res.on('data', (chunk) => data += chunk); \
        res.on('end', () => { \
          try { \
            const health = JSON.parse(data); \
            if (health.status === 'healthy') { \
              process.exit(0); \
            } else { \
              console.error('Health check failed: service not healthy'); \
              process.exit(1); \
            } \
          } catch (e) { \
            console.error('Health check failed: invalid response format'); \
            process.exit(1); \
          } \
        }); \
      } else { \
        console.error('Health check failed: HTTP', res.statusCode); \
        process.exit(1); \
      } \
    }); \
    req.on('error', (err) => { \
      console.error('Health check failed:', err.message); \
      process.exit(1); \
    }); \
    req.on('timeout', () => { \
      console.error('Health check failed: timeout'); \
      req.destroy(); \
      process.exit(1); \
    }); \
    req.end(); \
  " || exit 1

# Start the application
CMD ["npm", "run", "railway:start"]