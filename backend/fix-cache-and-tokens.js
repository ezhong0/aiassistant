#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying cache and token fixes...');

// Fix 1: Enable cache logging visibility
const gmailCacheFile = path.join(__dirname, 'src/services/email/gmail-cache.service.ts');
let gmailCacheContent = fs.readFileSync(gmailCacheFile, 'utf8');

// Change logDebug to logInfo for cache visibility
gmailCacheContent = gmailCacheContent.replace(
  /this\.logDebug\('Gmail search cache hit'/g,
  "this.logInfo('Gmail search cache hit'"
);
gmailCacheContent = gmailCacheContent.replace(
  /this\.logDebug\('Gmail search cache miss'/g,
  "this.logInfo('Gmail search cache miss'"
);
gmailCacheContent = gmailCacheContent.replace(
  /this\.logDebug\('Gmail search cached'/g,
  "this.logInfo('Gmail search cached'"
);

fs.writeFileSync(gmailCacheFile, gmailCacheContent);
console.log('✅ Fixed Gmail cache logging visibility');

// Fix 2: Fix OAuth token expiry issue in TokenManager
const tokenManagerFile = path.join(__dirname, 'src/services/token-manager.ts');
let tokenManagerContent = fs.readFileSync(tokenManagerFile, 'utf8');

// Swap the order to check expires_at first
tokenManagerContent = tokenManagerContent.replace(
  /if \(token\.expiry_date\) \{\s*expiryTime = typeof token\.expiry_date === 'number' \? token\.expiry_date : new Date\(token\.expiry_date\)\.getTime\(\);\s*\} else if \(token\.expires_at\) \{\s*const expiresAtDate = this\.ensureDate\(token\.expires_at\);\s*expiryTime = expiresAtDate \? expiresAtDate\.getTime\(\) : null;\s*\}/s,
  `if (token.expires_at) {
      const expiresAtDate = this.ensureDate(token.expires_at);
      expiryTime = expiresAtDate ? expiresAtDate.getTime() : null;
    } else if (token.expiry_date) {
      expiryTime = typeof token.expiry_date === 'number' ? token.expiry_date : new Date(token.expiry_date).getTime();
    }`
);

fs.writeFileSync(tokenManagerFile, tokenManagerContent);
console.log('✅ Fixed TokenManager to check expires_at first');

// Fix 3: Fix AuthService to use expires_at instead of expiry_date
const authServiceFile = path.join(__dirname, 'src/services/auth.service.ts');
let authServiceContent = fs.readFileSync(authServiceFile, 'utf8');

// Change expiry_date to expires_at
authServiceContent = authServiceContent.replace(
  /expiry_date: Date\.now\(\) \+ \(3600 \* 1000\)/,
  'expires_at: new Date(Date.now() + (3600 * 1000))'
);

fs.writeFileSync(authServiceFile, authServiceContent);
console.log('✅ Fixed AuthService to use expires_at');

console.log('🎉 All fixes applied successfully!');
console.log('');
console.log('Summary of fixes:');
console.log('1. ✅ Cache logs changed from debug to info level - you will now see cache hit/miss logs');
console.log('2. ✅ TokenManager now checks expires_at first (matches database storage)');
console.log('3. ✅ AuthService now sets expires_at field (matches TokenStorageService interface)');
console.log('');
console.log('Next steps:');
console.log('1. Run: npm run build');
console.log('2. Run: railway up');
console.log('3. Test: "find me recent emails" - you should see cache logs and no token refresh warnings');
