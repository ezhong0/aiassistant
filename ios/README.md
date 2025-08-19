# Assistant App iOS

This iOS app provides secure authentication through Google Sign-In and integrates with your backend OAuth service.

## Features

- ✅ **Google Sign-In Integration** - Secure OAuth authentication
- ✅ **JWT Token Management** - Secure token storage in Keychain
- ✅ **Automatic Token Refresh** - Seamless authentication experience
- ✅ **Backend Integration** - Communicates with your Node.js backend
- ✅ **SwiftUI Interface** - Modern, responsive UI
- ✅ **Authentication State Management** - Reactive authentication flow

## Setup Instructions

### 1. Add Google Sign-In SDK

In Xcode:
1. Go to **File → Add Package Dependencies**
2. Enter URL: `https://github.com/google/GoogleSignIn-iOS`
3. Select **Up to Next Major Version** and click **Add Package**
4. Add `GoogleSignIn` to your target

### 2. Configure URL Schemes

The `Info.plist` has been configured with the correct URL scheme:
```xml
<key>CFBundleURLSchemes</key>
<array>
    <string>com.googleusercontent.apps.526055709746-golq3n9mgv1oh55sgim0s5qrqcped8j6</string>
</array>
```

### 3. Add GoogleService-Info.plist

1. Drag the `GoogleService-Info.plist` file to your Xcode project
2. Make sure it's added to your target
3. Ensure it's in the bundle resources

### 4. Configure Backend URL

Update the `backendBaseURL` in `AuthenticationManager.swift`:
```swift
private let backendBaseURL = "https://your-backend-domain.com"
```

For local development, use:
```swift
private let backendBaseURL = "http://localhost:3000"
```

## Architecture

### Core Components

1. **`AuthenticationManager`** - Handles all authentication logic
   - Google Sign-In integration
   - Token management and storage
   - Backend communication
   - Authentication state management

2. **`MainAppView`** - Root view that handles authentication state
   - Shows `SignInView` when not authenticated
   - Shows `AuthenticatedMainView` when signed in

3. **`SignInView`** - Authentication interface
   - Google Sign-In button
   - Loading states
   - Error handling

4. **`AuthenticatedMainView`** - Main app interface
   - Tab-based navigation
   - Dashboard, Chat, Calendar, Profile tabs

### Authentication Flow

```
1. User taps "Sign in with Google"
2. Google Sign-In SDK presents OAuth flow
3. User grants permissions
4. App receives Google tokens (access, refresh, ID)
5. App sends tokens to backend `/auth/exchange-mobile-tokens`
6. Backend validates tokens and returns JWT
7. App stores JWT securely in Keychain
8. App navigates to main interface
```

### Token Management

- **Access Tokens**: Used to call Google APIs
- **Refresh Tokens**: Used to refresh expired access tokens
- **ID Tokens**: Contains user profile information
- **JWT Tokens**: Issued by your backend for API authentication

### Secure Storage

All tokens are stored securely using iOS Keychain:
- JWT tokens are encrypted and stored locally
- Automatic cleanup on sign-out
- Secure retrieval for API calls

## API Integration

### Backend Endpoints Used

1. **POST `/auth/exchange-mobile-tokens`**
   - Exchanges Google tokens for JWT
   - Validates user with Google
   - Returns signed JWT token

2. **POST `/auth/logout`**
   - Notifies backend of sign-out
   - Invalidates sessions

3. **GET `/protected/dashboard`**
   - Fetches user dashboard data
   - Requires JWT authentication

### Making Authenticated Requests

Use the `AuthenticationManager.makeAuthenticatedRequest` method:

```swift
let data = try await authManager.makeAuthenticatedRequest(
    to: "/protected/profile",
    method: "GET"
)
```

This automatically:
- Adds JWT token to Authorization header
- Handles token refresh if needed
- Signs out user if tokens are invalid

## Error Handling

The app handles various error scenarios:

### Authentication Errors
- **No Access Token**: Google Sign-In failed
- **Backend Error**: Server issues during token exchange
- **Invalid Response**: Malformed server responses
- **Token Expired**: Automatic refresh or re-authentication

### Network Errors
- **No Internet**: Graceful error messaging
- **Server Unreachable**: Retry mechanisms
- **Timeout**: Configurable timeout handling

### Security Errors
- **Keychain Access**: Secure storage failures
- **Token Validation**: Invalid or tampered tokens

## UI Components

### SignInView
- Modern sign-in interface
- Google branding compliance
- Loading states and error handling
- Feature highlights

### Dashboard
- Personalized welcome message
- Quick action buttons
- Recent activity feed
- Statistics overview

### Profile
- User information display
- Profile picture from Google
- Sign-out functionality

## Development

### Running the App

1. Open `AssistantApp.xcodeproj` in Xcode
2. Select your target device/simulator
3. Ensure backend is running on `localhost:3000`
4. Build and run (⌘+R)

### Testing Authentication

1. Use a real Google account for testing
2. Check console logs for authentication flow
3. Verify JWT tokens in backend logs
4. Test sign-out and re-authentication

### Backend Development

The iOS app expects these backend endpoints:

```javascript
// Exchange mobile tokens for JWT
POST /auth/exchange-mobile-tokens
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//04...",
  "id_token": "eyJhbGciOiJS...",
  "platform": "ios"
}

// Response
{
  "success": true,
  "user": { ... },
  "jwt": "eyJhbGciOiJIUzI1NiIs...",
  "platform": "ios"
}
```

### Debugging

Enable debug logging in `AuthenticationManager`:

```swift
private let debugMode = true

if debugMode {
    print("🔐 JWT Token: \(jwtToken)")
    print("👤 User: \(user.email)")
}
```

## Security Considerations

### Token Security
- JWT tokens stored in iOS Keychain
- Automatic token cleanup on sign-out
- No sensitive data in UserDefaults

### Network Security
- HTTPS enforcement in production
- Certificate pinning recommended
- Request timeout configuration

### App Security
- Biometric authentication (future)
- App backgrounding security
- Jailbreak detection (future)

## Deployment

### App Store Preparation
1. Update bundle identifier in project settings
2. Configure proper provisioning profiles
3. Set production backend URL
4. Remove debug logging
5. Test on physical devices

### Backend Configuration
1. Update CORS settings for production
2. Configure proper SSL certificates
3. Set production Google OAuth credentials
4. Enable API rate limiting

## Troubleshooting

### Common Issues

**Google Sign-In Not Working**
- Check GoogleService-Info.plist is in bundle
- Verify URL schemes in Info.plist
- Ensure Google OAuth credentials are correct

**Backend Connection Failed**
- Check backend URL in AuthenticationManager
- Verify backend is running and accessible
- Check network permissions in Info.plist

**Token Storage Issues**
- Clear app data and reinstall
- Check iOS Keychain permissions
- Verify device has sufficient storage

**Authentication Loop**
- Clear stored tokens
- Sign out completely from Google
- Restart app and try again

### Debug Steps

1. Enable debug logging in AuthenticationManager
2. Check Xcode console for error messages
3. Verify backend logs for API calls
4. Test with different Google accounts
5. Try on different devices/simulators

## Future Enhancements

- [ ] Biometric authentication
- [ ] Offline mode support
- [ ] Apple Sign-In integration
- [ ] Advanced error recovery
- [ ] User preferences sync
- [ ] Push notifications
- [ ] Deep linking support

## Dependencies

- **GoogleSignIn**: `~> 7.0`
- **SwiftUI**: iOS 14.0+
- **Foundation**: Standard library
- **Security**: Keychain services

## Support

For issues and questions:
1. Check this README
2. Review backend authentication logs
3. Test with fresh Google account
4. Verify all configuration steps

The iOS app is designed to work seamlessly with your Node.js backend OAuth implementation!