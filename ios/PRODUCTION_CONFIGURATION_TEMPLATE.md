# Production Configuration Template

This document provides templates and instructions for configuring your iOS app for production deployment.

## Step 1: Configure Production Backend URL

**File:** `/AssistantApp/Configuration/Production.plist`

```xml
<key>BackendBaseURL</key>
<string>https://your-production-api.com</string>
```

### Required Changes:
1. Replace `REPLACE_WITH_PRODUCTION_URL` with your actual production API URL
2. **Must use HTTPS** (required for production)
3. **Cannot use localhost** (will fail validation)

### Examples:
```xml
<!-- ✅ Good production URLs -->
<string>https://api.myassistantapp.com</string>
<string>https://assistant-api.herokuapp.com</string>
<string>https://my-app-backend.vercel.app</string>

<!-- ❌ Bad production URLs -->
<string>http://api.myassistantapp.com</string>    <!-- HTTP not allowed -->
<string>https://localhost:3000</string>          <!-- Localhost not allowed -->
<string>REPLACE_WITH_PRODUCTION_URL</string>     <!-- Must be replaced -->
```

## Step 2: Configure Production Google Client ID

**File:** `/AssistantApp/Configuration/GoogleClient-Production.plist`

### Required Changes:

1. **Replace CLIENT_ID:**
```xml
<key>CLIENT_ID</key>
<string>YOUR_PRODUCTION_CLIENT_ID.apps.googleusercontent.com</string>
```

2. **Replace REVERSED_CLIENT_ID:**
```xml
<key>REVERSED_CLIENT_ID</key>
<string>com.googleusercontent.apps.YOUR_PRODUCTION_CLIENT_ID</string>
```

3. **Replace GCM_SENDER_ID:**
```xml
<key>GCM_SENDER_ID</key>
<string>YOUR_PRODUCTION_SENDER_ID</string>
```

4. **Update BUNDLE_ID (if different):**
```xml
<key>BUNDLE_ID</key>
<string>com.assistantapp</string>
```

5. **Update PROJECT_ID:**
```xml
<key>PROJECT_ID</key>
<string>your-firebase-project-prod</string>
```

### Example Complete Configuration:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CLIENT_ID</key>
    <string>123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com</string>
    
    <key>REVERSED_CLIENT_ID</key>
    <string>com.googleusercontent.apps.123456789-abcdefghijklmnopqrstuvwxyz</string>
    
    <key>GCM_SENDER_ID</key>
    <string>123456789</string>
    
    <key>BUNDLE_ID</key>
    <string>com.assistantapp</string>
    
    <key>PROJECT_ID</key>
    <string>assistant-app-prod</string>
    
    <key>GOOGLE_APP_ID</key>
    <string>1:123456789:ios:abcdef123456</string>
</dict>
</plist>
```

## Step 3: Update Production xcconfig

**File:** `/Configuration/Production.xcconfig`

```bash
# Replace this line:
GOOGLE_REVERSED_CLIENT_ID = REPLACE_WITH_PRODUCTION_REVERSED_CLIENT_ID

# With your actual reversed client ID:
GOOGLE_REVERSED_CLIENT_ID = com.googleusercontent.apps.YOUR_PRODUCTION_CLIENT_ID
```

## Step 4: Validate Configuration

### Build Validation
Your production build will **automatically fail** if not properly configured:

```bash
❌ ERROR: Production build requires a real BackendBaseURL
❌ ERROR: Production build requires a real Google CLIENT_ID
❌ ERROR: Production builds must use HTTPS
❌ ERROR: Production builds cannot use localhost
```

### Manual Validation
You can manually validate your configuration:

```bash
# Test build
xcodebuild -configuration Release

# Should see:
✅ Configuration validation passed for Production environment
✅ Google configuration validation passed for Production environment
✅ ATS configuration is secure for production
```

## Staging Configuration (Optional)

If you want to set up staging environment:

### Backend URL
**File:** `/AssistantApp/Configuration/Staging.plist`
```xml
<key>BackendBaseURL</key>
<string>https://staging-api.myassistantapp.com</string>
```

### Google Client (Optional - can reuse development)
**File:** `/AssistantApp/Configuration/GoogleClient-Staging.plist`
```xml
<key>CLIENT_ID</key>
<string>YOUR_STAGING_CLIENT_ID.apps.googleusercontent.com</string>
```

## Security Checklist

### ✅ Before Production Release

- [ ] **Backend URL configured** in `Production.plist`
- [ ] **HTTPS URL** (not HTTP)
- [ ] **No localhost** in production URL
- [ ] **Google Client ID configured** in `GoogleClient-Production.plist`
- [ ] **No "REPLACE_WITH" placeholders** in production files
- [ ] **Production build passes** validation
- [ ] **SSL certificate** valid for production URL
- [ ] **ATS configuration** secure for production

### 🔒 Security Features Enabled

- ✅ **App Transport Security** enforces HTTPS
- ✅ **Build-time validation** prevents misconfiguration
- ✅ **Environment isolation** (dev/staging/prod)
- ✅ **Runtime security monitoring**
- ✅ **Dynamic URL schemes** based on environment

## Common Issues

### Issue: "BackendBaseURL is not configured"
**Solution:** Replace `REPLACE_WITH_PRODUCTION_URL` in `Production.plist`

### Issue: "Google CLIENT_ID is not configured"
**Solution:** Replace `REPLACE_WITH_PRODUCTION_CLIENT_ID` in `GoogleClient-Production.plist`

### Issue: "Production builds must use HTTPS"
**Solution:** Ensure production URL starts with `https://`

### Issue: "The resource could not be loaded because the App Transport Security policy requires the use of a secure connection"
**Solution:** Check that your production backend has a valid SSL certificate

### Issue: URL scheme not working
**Solution:** Verify `GOOGLE_REVERSED_CLIENT_ID` matches your Google Client ID

## Getting Google Credentials

### From Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one for production)
3. **APIs & Services** → **Credentials**
4. **Create Credentials** → **OAuth client ID**
5. Select **iOS**
6. Enter your production bundle ID: `com.assistantapp`
7. Download the configuration

### From Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. **Project Settings** → **General**
4. **Your apps** → **iOS**
5. Download `GoogleService-Info.plist`
6. Extract Client ID from the file

## Testing Production Configuration

### 1. Build Test
```bash
# This should succeed without errors
xcodebuild -project AssistantApp.xcodeproj -configuration Release
```

### 2. Security Test
```bash
# Check security status in app
// In your app code:
let config = AppConfiguration.shared
print("Is secure: \(config.isSecure)")
print("Security warnings: \(config.securityWarnings)")
```

### 3. Network Test
```bash
# Test actual API connection
curl -I https://your-production-api.com/health
# Should return 200 OK with valid SSL
```

## Deployment Checklist

### Before App Store Submission:
- [ ] Production configuration validated
- [ ] SSL certificate valid
- [ ] API endpoints working
- [ ] Google Sign-In working
- [ ] No debug logs in production
- [ ] App Transport Security configured
- [ ] Bundle ID matches App Store Connect
- [ ] Provisioning profiles configured

Your app is now ready for secure production deployment! 🚀🔒