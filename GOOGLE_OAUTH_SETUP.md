# Google OAuth Setup Guide for AssistantApp

This guide will walk you through setting up Google OAuth in the Google Cloud Console for your voice-controlled workplace automation app.

## Required Scopes (Based on MVP)

Based on your MVP requirements, you'll need these specific Google API scopes:

```
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

### Scope Breakdown:
- **`gmail.modify`** - Required for reading, composing, and sending emails
- **`calendar.events`** - Required for creating and managing calendar events  
- **`userinfo.email`** - Required for user email identification
- **`userinfo.profile`** - Required for user profile information (name, picture)

## Important: Mobile vs Web OAuth Clients

**Key Difference:** Your architecture requires TWO different OAuth clients:

1. **Mobile Client (iOS/Android)** - For your React Native app
   - ✅ Has Client ID only (no client secret)
   - ✅ Uses PKCE (Proof Key for Code Exchange) for security
   - ✅ Handles user authentication and authorization

2. **Web Client** - For your Node.js backend service
   - ✅ Has both Client ID and Client Secret
   - ✅ Used by your backend to make API calls to Gmail/Calendar
   - ✅ Handles server-to-server authentication

**Why Mobile Apps Don't Have Client Secrets:**
- Mobile apps are "public clients" - anyone can decompile them and extract secrets
- Google uses PKCE (Proof Key for Code Exchange) instead for security
- The client secret would provide no additional security in a mobile environment

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project details:
   - **Project name:** `AssistantApp` (or your preferred name)
   - **Organization:** Leave as default or select your organization
4. Click **"Create"**

### 2. Enable Required APIs

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for and enable these APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google+ API** (for user profile information)

For each API:
1. Click on the API name
2. Click **"Enable"**
3. Wait for the API to be enabled

### 3. Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"**

#### Fill out the OAuth consent screen:

**App Information:**
- **App name:** `AssistantApp`
- **User support email:** Your email address
- **App logo:** Upload your app logo (optional)

**App domain (optional but recommended):**
- **Application home page:** Your app's website URL
- **Application privacy policy link:** Your privacy policy URL
- **Application terms of service link:** Your terms of service URL

**Developer contact information:**
- **Email addresses:** Your email address

4. Click **"Save and Continue"**

#### Configure Scopes:
1. Click **"Add or Remove Scopes"**
2. Add these scopes by searching and selecting them:
   ```
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   ```
3. Click **"Update"**
4. Click **"Save and Continue"**

#### Test Users (for development):
1. Add your email address and any other test users
2. Click **"Save and Continue"**
3. Review and click **"Back to Dashboard"**

### 4. Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. Choose application type based on your platform:

#### For Mobile App (React Native):

**For iOS:**
- **Application type:** Select **"iOS"**
- **Name:** `AssistantApp iOS Client`
- **Bundle ID:** Your iOS app bundle identifier (e.g., `com.yourcompany.assistantapp`)

**For Android:**
- **Application type:** Select **"Android"**
- **Name:** `AssistantApp Android Client`
- **Package name:** Your Android package name (e.g., `com.yourcompany.assistantapp`)
- **SHA-1 certificate fingerprint:** Your app's SHA-1 fingerprint

#### For Backend/Server-side OAuth (Required for your Node.js backend):
- **Application type:** **"Web application"**
- **Name:** `AssistantApp Backend Client`
- **Authorized redirect URIs:**
  ```
  http://localhost:3000/auth/google/callback
  https://yourdomain.com/auth/google/callback
  ```

4. Click **"Create"** for each client type you need

### 5. Download and Configure Credentials

**Important:** Mobile clients (iOS/Android) and Web clients have different credential formats!

#### For iOS Client:
1. Click the **download icon** next to your iOS OAuth client
2. Download the `.plist` file (like `GoogleService-Info.plist`)
3. The file contains:
   ```xml
   <key>CLIENT_ID</key>
   <string>your_ios_client_id_here</string>
   <key>REVERSED_CLIENT_ID</key>
   <string>com.googleusercontent.apps.your_reversed_id</string>
   ```
   **Note:** iOS clients do NOT have a client secret - this is normal and secure!

#### For Android Client:
1. Click the **download icon** next to your Android OAuth client
2. Download the `google-services.json` file
3. The file contains the client ID but no client secret (same as iOS)

#### For Web/Backend Client:
1. Click the **download icon** next to your Web OAuth client
2. Download the JSON file
3. Extract the required information:
   ```json
   {
     "client_id": "your_web_client_id_here",
     "client_secret": "your_client_secret_here"
   }
   ```

#### Configure Your Backend Environment:
Update your `.env` file with the **Web client** credentials (not mobile):
```env
# Use WEB client credentials for your Node.js backend
GOOGLE_CLIENT_ID=your_web_client_id_here
GOOGLE_CLIENT_SECRET=your_web_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# iOS client ID (for mobile app configuration)
GOOGLE_IOS_CLIENT_ID=your_ios_client_id_here
```

### 6. Configure for Different Environments

#### Development Environment
```env
GOOGLE_CLIENT_ID=your_dev_client_id
GOOGLE_CLIENT_SECRET=your_dev_client_secret  
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

#### Production Environment
```env
GOOGLE_CLIENT_ID=your_prod_client_id
GOOGLE_CLIENT_SECRET=your_prod_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
```

## Testing Your OAuth Setup

### 1. Test Authorization URL Generation
```javascript
import { authService } from './src/services/auth.service';

// Generate auth URL with required scopes
const authUrl = authService.generateAuthUrl([
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]);

console.log('Visit this URL:', authUrl);
```

### 2. Test Token Exchange
```javascript
// After user authorizes and you receive the code
const tokens = await authService.exchangeCodeForTokens(authorizationCode);
console.log('Access token received:', tokens.access_token);
```

### 3. Test API Access
```javascript
// Test Gmail access
const userInfo = await authService.getUserInfo(tokens.access_token);
console.log('User info:', userInfo);
```

## Security Best Practices

### 1. Environment Variables
- **Never commit** `.env` files to version control
- Use different OAuth clients for development and production
- Rotate client secrets regularly

### 2. Redirect URI Security
- Use HTTPS in production
- Validate redirect URIs server-side
- Implement state parameter validation

### 3. Token Management
- Store tokens securely (encrypted storage)
- Implement automatic token refresh
- Handle token revocation gracefully

### 4. Scope Minimization
- Only request the minimum required scopes
- Explain to users why each permission is needed
- Allow users to revoke permissions

## Troubleshooting Common Issues

### 1. "redirect_uri_mismatch" Error
- Ensure the redirect URI in your request exactly matches the one configured in Google Cloud Console
- Check for trailing slashes and protocol differences (http vs https)

### 2. "invalid_client" Error
- Verify your client ID and client secret are correct
- Ensure the OAuth client is enabled
- Check that you're using the right credentials for your environment

### 3. "access_denied" Error
- User declined authorization
- Check if your app is in "Testing" mode and the user isn't added as a test user
- Verify your OAuth consent screen is properly configured

### 4. "insufficient_permissions" Error
- The requested scopes weren't granted
- Check your OAuth consent screen scope configuration
- Ensure the APIs are enabled in your Google Cloud project

### 5. Token Refresh Issues
- Ensure you're storing the refresh token
- Check that `access_type: 'offline'` is set in your auth URL generation
- Verify the refresh token hasn't expired (they can expire if unused for 6 months)

## Publishing Your App (Production)

### 1. OAuth Consent Screen Verification
- Complete the OAuth consent screen with all required information
- Submit for Google verification (required for production apps)
- This process can take several days to weeks

### 2. Security Assessment
- Google may require a security assessment for sensitive scopes
- Prepare documentation about your data handling practices
- Implement proper security measures

### 3. Domain Verification
- Verify ownership of your domain
- Configure proper redirect URIs for production

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## Support

If you encounter issues:
1. Check the [Google Cloud Console error logs](https://console.cloud.google.com/logs)
2. Review the [Google API Console](https://console.developers.google.com/)
3. Consult the [Google OAuth 2.0 Troubleshooting Guide](https://developers.google.com/identity/protocols/oauth2/troubleshooting)

---

**Next Steps:** After completing this setup, test your OAuth flow with the provided `AuthService` class to ensure everything is working correctly before integrating with your React Native app.
