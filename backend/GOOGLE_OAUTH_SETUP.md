# Google OAuth Setup Guide

This guide will help you set up Google OAuth for Gmail integration with your AI Assistant app.

## Prerequisites

1. A Google Cloud Project
2. Google OAuth 2.0 credentials
3. Proper redirect URI configuration

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
   - People API (for contacts)

## Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "AI Assistant"
   - User support email: Your email
   - Developer contact information: Your email
4. Add the following scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/contacts.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users (your email addresses)
6. Save and continue

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Set the following redirect URIs:
   - **Development**: `http://localhost:3000/auth/callback`
   - **Production**: `https://your-domain.com/auth/callback`
5. Save the client ID and client secret

## Step 4: Environment Configuration

Add these environment variables to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# For production, use:
# GOOGLE_REDIRECT_URI=https://your-domain.com/auth/callback
```

## Step 5: Verify Configuration

1. Start your backend server
2. Try the OAuth flow from Slack
3. Check the logs for any OAuth-related errors

## Common Issues and Solutions

### Issue: "redirect_uri_mismatch" Error

**Cause**: The redirect URI in your OAuth request doesn't match what's configured in Google Cloud Console.

**Solution**: 
1. Check that `GOOGLE_REDIRECT_URI` in your `.env` matches exactly what's in Google Cloud Console
2. Ensure there are no trailing slashes or extra characters
3. For local development, use `http://localhost:3000/auth/callback`
4. For production, use `https://your-domain.com/auth/callback`

### Issue: "invalid_client" Error

**Cause**: Incorrect client ID or client secret.

**Solution**:
1. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your `.env`
2. Ensure the credentials are for a "Web application" OAuth client
3. Check that the OAuth consent screen is properly configured

### Issue: "access_denied" Error

**Cause**: User denied the OAuth consent or scopes are not properly configured.

**Solution**:
1. Verify all required scopes are added to the OAuth consent screen
2. Ensure test users are added to the consent screen
3. Check that the app is not in "Testing" mode if you need production access

## Testing the OAuth Flow

1. **From Slack**: Mention the bot with an email request
2. **Click "Connect Gmail Account"**: Should redirect to Google OAuth
3. **Authorize**: Grant permissions to the app
4. **Return to Slack**: Should see success message
5. **Retry email request**: Should now work with OAuth tokens

## Security Considerations

1. **Never commit** `.env` files to version control
2. **Use HTTPS** in production for all OAuth redirects
3. **Validate state parameter** to prevent CSRF attacks
4. **Store tokens securely** using the session service
5. **Implement token refresh** for long-lived access

## Production Deployment

When deploying to production:

1. Update `GOOGLE_REDIRECT_URI` to your production domain
2. Add your production domain to Google Cloud Console OAuth credentials
3. Ensure your domain uses HTTPS
4. Test the OAuth flow in production environment

## Troubleshooting

### Check Logs

Look for these log messages:
- `Generated Google OAuth URL for Slack user`
- `User authenticated successfully`
- `Successfully stored OAuth tokens for Slack user`

### Common Error Messages

- `Google OAuth client ID not configured` → Check `GOOGLE_CLIENT_ID` in `.env`
- `redirect_uri_mismatch` → Verify redirect URI configuration
- `invalid_client` → Check client ID and secret
- `access_denied` → Verify OAuth consent screen configuration

### Debug OAuth Flow

1. Check the generated OAuth URL in logs
2. Verify the redirect URI matches Google Cloud Console
3. Test the OAuth flow manually in a browser
4. Check that the callback route is working properly

## Support

If you continue to have issues:

1. Check the backend logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure Google Cloud Console configuration matches your setup
4. Test with a simple OAuth flow first before integrating with Slack
