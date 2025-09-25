FROM node:20-slim AS base

# Enable BuildKit for better caching
WORKDIR /app

FROM base AS deps
# Copy only package files for better layer caching
COPY backend/package.json ./backend/
WORKDIR /app/backend
ENV RAILWAY_ENVIRONMENT=production
RUN npm install --omit=dev && npm cache clean --force

FROM base AS build
# Copy package files and install all deps (including dev for building)
COPY backend/package.json ./backend/
WORKDIR /app/backend
ENV RAILWAY_ENVIRONMENT=production
RUN npm install

# Copy source and build
COPY backend/src ./src/
COPY backend/tsconfig*.json ./
RUN npm run build

FROM base AS runtime
# Copy production node_modules from deps stage
COPY --from=deps /app/backend/node_modules ./backend/node_modules/
# Copy built application from build stage
COPY --from=build /app/backend/dist ./backend/dist/
# Copy package.json for npm start
COPY backend/package.json ./backend/

WORKDIR /app/backend
EXPOSE 3000

# Use node directly instead of npm for better signal handling
CMD ["node", "dist/index.js"]