# Google Cloud Console Setup for Contact Agent

This guide walks you through setting up Google Cloud Console to enable the Google Contacts and People APIs for your contact resolution system.

## Prerequisites

- Google Cloud account with billing enabled
- Existing project (you likely already have this from your Gmail API setup)
- Project admin access

## Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Select your existing project (the one you used for Gmail API)

## Step 2: Enable Required APIs

### Enable Google People API
1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for **"People API"**
3. Click on **"Google People API"** from the results
4. Click the **"Enable"** button
5. Wait for the API to be enabled (may take a few moments)

### Enable Google Contacts API (if not already enabled)
1. Still in the API Library, search for **"Contacts API"**
2. Click on **"Google Contacts API"** 
3. Click **"Enable"** if not already enabled

### Verify APIs are Enabled
1. Go to **"APIs & Services"** → **"Enabled APIs & services"**
2. You should see both:
   - Google People API
   - Contacts API
   - Gmail API (already enabled)

## Step 3: Update OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Click **"Edit App"**
3. Scroll down to **"Scopes"** section
4. Click **"Add or Remove Scopes"**
5. Find and select these additional scopes:
   - `https://www.googleapis.com/auth/contacts.readonly`
   - `https://www.googleapis.com/auth/contacts.other.readonly`
6. Click **"Update"** to save the scopes
7. Click **"Save and Continue"** at the bottom

## Step 4: Update OAuth Client Credentials

### For Web Application (Backend)
1. Go to **"APIs & Services"** → **"Credentials"**
2. Find your existing **OAuth 2.0 Client ID** for web application
3. Click the pencil icon to edit
4. Under **"Authorized redirect URIs"**, verify you have:
   - `http://localhost:3000/auth/google/callback` (for development)
   - Your production callback URL (if deploying)
5. Click **"Save"**

### For iOS Application
1. In the same **"Credentials"** section
2. Find your **OAuth 2.0 Client ID** for iOS application
3. Verify the **Bundle ID** matches your iOS app
4. If you need to create a new one:
   - Click **"Create Credentials"** → **"OAuth client ID"**
   - Select **"iOS"**
   - Enter your iOS bundle identifier
   - Click **"Create"**

## Step 5: Test API Access

### Using Google APIs Explorer
1. Go to [Google APIs Explorer](https://developers.google.com/apis-explorer)
2. Find **"People API v1"**
3. Try the `people.connections.list` method
4. Authorize with your account
5. Verify you can see your contacts

## Step 6: Download Updated Credentials

1. Back in **"APIs & Services"** → **"Credentials"**
2. Click the download icon next to your **Web application** OAuth client
3. Save the JSON file as `credentials.json` in your backend project
4. Update your `.env` file with any new client IDs if needed

## Step 7: API Quotas and Limits

1. Go to **"APIs & Services"** → **"Quotas"**
2. Search for **"People API"**
3. Review the default quotas:
   - **Requests per day**: 1,000,000
   - **Requests per 100 seconds per user**: 100
4. For production, you may need to request quota increases

## Step 8: Set Up Monitoring (Optional)

1. Go to **"APIs & Services"** → **"Dashboard"**
2. You'll see usage charts for all your APIs
3. Set up alerts if needed:
   - Click **"Quotas"**
   - Select an API
   - Click **"Edit Quotas"** to set up alerts

## Required Scopes Summary

Make sure your application requests these OAuth scopes:

```javascript
const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/contacts.readonly',           // NEW
  'https://www.googleapis.com/auth/contacts.other.readonly',     // NEW
  'openid',
  'email',
  'profile'
];
```

## Environment Variables

Add these to your `.env` file if not already present:

```bash
# Google Cloud Project
GOOGLE_PROJECT_ID=your-project-id

# OAuth Credentials (likely already have these)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional: API Keys (if using server-to-server)
GOOGLE_API_KEY=your-api-key
```

## Troubleshooting

### Common Issues:

1. **"Access blocked" error**
   - Make sure OAuth consent screen is configured
   - Verify all required scopes are added
   - Check that APIs are enabled

2. **"Insufficient Permission" error**
   - User needs to re-authorize with new scopes
   - Clear stored tokens and re-authenticate

3. **Rate limiting**
   - Implement exponential backoff
   - Check quota usage in Google Cloud Console

4. **"API not enabled" error**
   - Double-check that People API is enabled
   - Wait a few minutes after enabling APIs

## Next Steps

Once this setup is complete, you can:

1. Test the APIs with your existing OAuth tokens
2. Implement the Contact Service in your backend
3. Build the Contact Agent to search contacts
4. Integrate with your Email Agent for name resolution

## Security Notes

- Keep your `credentials.json` file secure and never commit it to version control
- Use environment variables for sensitive data
- Regularly rotate OAuth client secrets
- Monitor API usage for suspicious activity
- Consider implementing rate limiting in your application

## Useful Links

- [Google People API Documentation](https://developers.google.com/people)
- [Google Contacts API Documentation](https://developers.google.com/contacts/v3)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Google Cloud Console](https://console.cloud.google.com/)