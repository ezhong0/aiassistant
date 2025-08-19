#!/bin/bash

echo "Installing additional dependencies for refactored codebase..."

# Security and validation dependencies
npm install zod cors helmet compression

# Type definitions
npm install --save-dev @types/cors @types/compression

# Testing dependencies (recommended)
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest

# Environment validation
npm install --save-dev cross-env

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with proper JWT_SECRET (at least 32 characters)"
echo "2. Configure CORS_ORIGIN for your frontend domain"
echo "3. Run 'npm run test' to ensure everything works"
echo "4. Run 'npm run build' to build the TypeScript"
echo "5. Run 'npm start' to start the server"