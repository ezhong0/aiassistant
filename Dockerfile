FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install root dependencies (if any)
RUN npm install --only=production

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Copy source code
WORKDIR /app
COPY . .

# Build the application
WORKDIR /app/backend
RUN npm run build

# Expose the port
EXPOSE 3000

# Start command
CMD ["npm", "start"]