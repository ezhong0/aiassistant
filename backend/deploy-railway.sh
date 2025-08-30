#!/bin/bash

# Railway Deployment Script for AI Assistant
# This script ensures a clean build and deployment to Railway

echo "🚀 Starting Railway deployment..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf node_modules/.cache

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build for production
echo "🔨 Building for production..."
npm run railway:build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📁 Build output:"
    ls -la dist/
    
    # Deploy to Railway
    echo "🚀 Deploying to Railway..."
    railway up
    
    echo "🎉 Deployment complete!"
    echo "🌐 Your app should be available at:"
    railway domain
else
    echo "❌ Build failed! Please check the errors above."
    exit 1
fi
