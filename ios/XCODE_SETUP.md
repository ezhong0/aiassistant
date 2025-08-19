# Xcode Project Setup for Google Sign-In

Follow these steps to complete the iOS Google Sign-In integration in Xcode.

## Step 1: Add Google Sign-In SDK

### Option A: Swift Package Manager (Recommended)
1. Open your project in Xcode
2. Go to **File → Add Package Dependencies**
3. Enter this URL: `https://github.com/google/GoogleSignIn-iOS`
4. Click **Add Package**
5. Select **GoogleSignIn** and click **Add Package**

### Option B: CocoaPods
Add to your `Podfile`:
```ruby
pod 'GoogleSignIn'
```
Then run: `pod install`

## Step 2: Configure Project Settings

### Bundle Identifier
1. Select your project in the navigator
2. Select your target
3. Set **Bundle Identifier** to: `com.assistantapp.ios`

### URL Schemes
1. Go to **Info** tab
2. Expand **URL Types**
3. Add a new URL Type with:
   - **Identifier**: `GoogleSignIn`
   - **URL Schemes**: `com.googleusercontent.apps.526055709746-golq3n9mgv1oh55sgim0s5qrqcped8j6`

## Step 3: Add Required Files

### Add GoogleService-Info.plist
1. Drag `GoogleService-Info.plist` into your Xcode project
2. Make sure **"Add to target"** is checked
3. Ensure it appears in your app bundle

### Add Info.plist Configuration
1. Right-click `Info.plist` and select **Open As → Source Code**
2. Add the URL scheme configuration (already in the provided Info.plist)

## Step 4: Configure App Transport Security

Add to Info.plist for development (localhost access):
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>localhost</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

## Step 5: Update Source Files

### Replace Default Files
1. **Replace** `ContentView.swift` with `MainAppView.swift`
2. **Update** `AssistantAppApp.swift` with the Google Sign-In configuration
3. **Add** all the new Swift files:
   - `AuthenticationManager.swift`
   - `SignInView.swift`
   - `MainAppView.swift`

### Import Statements
Make sure these imports are in your App file:
```swift
import SwiftUI
import GoogleSignIn
```

## Step 6: Build Settings

### iOS Deployment Target
Set minimum iOS version to **14.0** or higher

### Signing & Capabilities
1. Ensure you have a valid development team selected
2. Enable **Keychain Sharing** if using Keychain for token storage

## Step 7: Backend URL Configuration

### For Development
In `AuthenticationManager.swift`, use:
```swift
private let backendBaseURL = "http://localhost:3000"
```

### For Production
Update to your production URL:
```swift
private let backendBaseURL = "https://your-domain.com"
```

## Step 8: Test the Integration

### Running the App
1. Select a simulator or device
2. Build and run (⌘+R)
3. Tap "Continue with Google"
4. Complete the OAuth flow

### Debugging
Check the console for these logs:
- `✅ Sign-in successful for: user@example.com`
- `Auth service initialized successfully`
- Backend API responses

## Troubleshooting

### Common Issues

**Build Errors**
- Clean build folder: **Product → Clean Build Folder**
- Reset package caches: **File → Packages → Reset Package Caches**

**GoogleService-Info.plist Not Found**
- Ensure file is added to target
- Check file is in bundle resources
- Verify file name is exactly `GoogleService-Info.plist`

**URL Scheme Not Working**
- Verify URL scheme matches the one in GoogleService-Info.plist
- Check `REVERSED_CLIENT_ID` in plist file
- Ensure URL scheme is added to target

**Network Errors**
- Check backend is running on `localhost:3000`
- Verify ATS settings in Info.plist
- Test backend endpoints manually

### Debug Checklist

1. ✅ GoogleSignIn package installed
2. ✅ GoogleService-Info.plist in bundle
3. ✅ URL scheme configured correctly
4. ✅ Backend running and accessible
5. ✅ All Swift files added to project
6. ✅ Import statements correct
7. ✅ Bundle identifier matches Google Console

## Project Structure

Your Xcode project should have this structure:
```
AssistantApp/
├── AssistantAppApp.swift          # Main app entry point
├── MainAppView.swift              # Root view with auth state
├── SignInView.swift               # Sign-in interface
├── AuthenticationManager.swift    # Auth logic and API calls
├── GoogleService-Info.plist       # Google configuration
├── Info.plist                     # App configuration
└── Assets.xcassets/               # App icons and images
```

## Next Steps

After successful setup:
1. Test sign-in flow with real Google account
2. Verify JWT tokens are stored securely
3. Test API calls to protected endpoints
4. Implement additional app features
5. Prepare for App Store submission

## Production Checklist

Before releasing:
- [ ] Update backend URL to production
- [ ] Configure production Google OAuth credentials
- [ ] Remove debug logging
- [ ] Test on physical devices
- [ ] Configure proper signing certificates
- [ ] Update app metadata and screenshots

The iOS app is now ready for Google Sign-In integration! 🎉