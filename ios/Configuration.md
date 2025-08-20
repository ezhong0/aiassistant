# iOS App Configuration Guide

This guide explains how to configure the AssistantApp for different environments (Development, Staging, Production).

## Overview

The app uses a multi-environment configuration system that:
- ✅ **Removes hardcoded URLs and credentials**
- ✅ **Supports Development, Staging, and Production environments**
- ✅ **Validates configuration at build time**
- ✅ **Fails production builds if configuration is incomplete**
- ✅ **Uses localhost for development, requires real URLs for production**

## Configuration Files

### Environment Plist Files

Located in `/AssistantApp/Configuration/`:

- **Development.plist** - Development environment (localhost)
- **Staging.plist** - Staging environment (requires configuration)
- **Production.plist** - Production environment (requires configuration)

### Configuration Schema

Each plist file contains:

```xml
<dict>
    <key>BackendBaseURL</key>
    <string>https://your-backend-url.com</string>
    
    <key>GoogleClientID</key>
    <string>your-google-client-id.apps.googleusercontent.com</string>
    
    <key>Environment</key>
    <string>Production</string>
    
    <key>ApiTimeout</key>
    <integer>60</integer>
    
    <key>LogLevel</key>
    <string>error</string>
    
    <key>EnableDebugLogs</key>
    <false/>
</dict>
```

## Setting Up Environments

### 1. Development Environment ✅ (Ready to Use)

**File:** `Development.plist`

```xml
<key>BackendBaseURL</key>
<string>http://localhost:3000</string>
```

- **Works out of the box** with local backend server
- **Debug logs enabled** for development
- **Uses localhost** - perfect for development

### 2. Staging Environment ⚠️ (Needs Configuration)

**File:** `Staging.plist`

**Before deploying to staging:**

1. Replace `REPLACE_WITH_STAGING_URL` with your actual staging URL:
   ```xml
   <key>BackendBaseURL</key>
   <string>https://your-staging-backend.herokuapp.com</string>
   ```

2. Verify Google Client ID is correct for staging

### 3. Production Environment ❌ (Requires Configuration)

**File:** `Production.plist`

**Before releasing to production:**

1. Replace `REPLACE_WITH_PRODUCTION_URL` with your production URL:
   ```xml
   <key>BackendBaseURL</key>
   <string>https://your-production-backend.com</string>
   ```

2. **MUST use HTTPS** - HTTP will fail validation
3. **Cannot use localhost** - will fail validation
4. Debug logs are disabled for security

## Xcode Build Configuration

### Setting Up Build Configurations

1. **Open your Xcode project**
2. **Select the project** (top level in navigator)
3. **Go to Info tab** → **Configurations**
4. **Add new configurations:**
   - Duplicate "Debug" → Rename to "Staging"
   - Duplicate "Release" → Keep as "Production"

### Assigning Configuration Files

1. **Select your target**
2. **Build Settings tab**
3. **Search for "configuration"**
4. **Set Config Files:**
   - Debug: `Development.xcconfig`
   - Staging: `Staging.xcconfig`
   - Release: `Production.xcconfig`

### Adding Build Script

1. **Select your target**
2. **Build Phases tab**
3. **Add "New Run Script Phase"**
4. **Add this script:**
   ```bash
   "${SRCROOT}/Scripts/validate-configuration.sh"
   ```
5. **Move it before "Compile Sources"**

## Build Validation

The validation script (`validate-configuration.sh`) checks:

### ✅ **Development Builds**
- ✅ Allow localhost URLs
- ✅ Allow HTTP protocols  
- ⚠️ Show warnings for placeholder values

### ⚠️ **Staging Builds**
- ✅ Allow HTTP/HTTPS
- ❌ Fail if placeholder URLs are used
- ✅ Require valid Google Client ID

### ❌ **Production Builds**
- ❌ Fail if BackendBaseURL contains "REPLACE_WITH"
- ❌ Fail if using localhost
- ❌ Fail if not using HTTPS
- ❌ Fail if GoogleClientID is missing/invalid

## Common Configuration Tasks

### 1. Setting Up Production URL

Edit `Production.plist`:
```xml
<key>BackendBaseURL</key>
<string>https://api.yourdomain.com</string>
```

### 2. Updating Google Client ID

Edit any environment plist:
```xml
<key>GoogleClientID</key>
<string>123456789-abc123.apps.googleusercontent.com</string>
```

### 3. Changing API Timeouts

Edit environment plist:
```xml
<key>ApiTimeout</key>
<integer>45</integer>
```

### 4. Enabling Debug Logs

Edit environment plist:
```xml
<key>EnableDebugLogs</key>
<true/>
```

## Usage in Code

### Accessing Configuration

```swift
import Foundation

// Get shared configuration
let config = AppConfiguration.shared

// Access values
let backendURL = config.backendBaseURL
let clientID = config.googleClientID
let timeout = config.apiTimeout

// Environment checks
if config.isProduction {
    // Production-specific code
}

if config.shouldShowDebugUI {
    // Show debug information
}
```

### Making API Calls

```swift
// AuthenticationManager automatically uses configuration
let authManager = AuthenticationManager()

// URLs are built automatically from configuration
let url = config.apiURL(for: "assistant/text-command")
let authURL = config.authURL(for: "exchange-mobile-tokens")
```

### Debug Information

```swift
// Show configuration summary (development only)
if authManager.shouldShowDebugInfo {
    print(authManager.configurationInfo)
}
```

## Building for Different Environments

### Development Build (Default)
```bash
# Builds with Development configuration
xcodebuild -configuration Debug
```

### Staging Build
```bash
# Builds with Staging configuration
xcodebuild -configuration Staging
```

### Production Build
```bash
# Builds with Production configuration (Release)
xcodebuild -configuration Release
```

## Troubleshooting

### Build Fails with "BackendBaseURL is not configured"

**Problem:** Production/Staging URL not set

**Solution:** Edit the appropriate plist file and replace `REPLACE_WITH_*` with real URL

### Build Fails with "Production builds must use HTTPS"

**Problem:** Using HTTP in production

**Solution:** Change URL to use `https://`

### Build Fails with "Production builds cannot use localhost"

**Problem:** Using localhost in production

**Solution:** Set real production URL in `Production.plist`

### App Shows "Configuration validation failed"

**Problem:** Runtime configuration validation failed

**Solution:** Check that the correct plist file is included in build target

### Google Sign-In Not Working

**Problem:** Wrong Google Client ID

**Solution:** Verify Client ID in plist matches Google Cloud Console

## Security Notes

### ✅ **What's Secure:**
- Client IDs are stored in configuration files (not secrets)
- No hardcoded credentials in source code
- Different credentials per environment
- Production builds require HTTPS

### ⚠️ **What to Keep Secret:**
- Google Client Secret (never put in iOS app)
- Backend API keys (server-side only)
- JWT tokens (stored in Keychain)

## Files Created

This configuration system creates these files:

```
ios/
├── AssistantApp/
│   ├── Configuration/
│   │   ├── AppConfiguration.swift      # Configuration manager
│   │   ├── Development.plist           # Dev environment settings
│   │   ├── Staging.plist              # Staging environment settings
│   │   └── Production.plist           # Production environment settings
├── Configuration/
│   ├── Development.xcconfig           # Xcode dev build settings
│   ├── Staging.xcconfig              # Xcode staging build settings  
│   └── Production.xcconfig           # Xcode production build settings
└── Scripts/
    └── validate-configuration.sh     # Build-time validation script
```

## Next Steps

1. **✅ Development:** Already configured - ready to use
2. **⚠️ Staging:** Configure staging backend URL when ready
3. **❌ Production:** Configure production backend URL before release
4. **📱 App Store:** Set up proper provisioning profiles per environment

The configuration system is now ready! Your app will:
- ✅ Use `localhost:3000` for development
- ✅ Require real URLs for staging/production
- ✅ Fail builds if production isn't properly configured
- ✅ Provide clear error messages for configuration issues