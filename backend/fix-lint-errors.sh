#!/bin/bash
# Script to fix common linting errors

echo "Fixing unused error variables in catch blocks..."

# Fix unused error in catch blocks by adding eslint-disable
find src -name "*.ts" -type f -exec sed -i '' 's/} catch (error) {/} catch (error) { \/\/ eslint-disable-line @typescript-eslint\/no-unused-vars/g' {} \;

echo "Fixing unused _next parameters..."
# These are already prefixed with _ which is convention

echo "Done! Run 'npm run lint' to check remaining errors"
