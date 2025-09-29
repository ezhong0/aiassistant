/**
 * HTML Templates
 * Centralized HTML templates for OAuth flows and error pages
 */

export interface TemplateData {
  title?: string;
  message?: string;
  details?: string;
  redirectUrl?: string;
  buttonText?: string;
}

/**
 * Base HTML template wrapper
 */
const baseTemplate = (title: string, content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      padding: 2rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
    }
    h1 {
      margin-bottom: 1rem;
      color: #333;
      font-weight: 600;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
      transition: background-color 0.2s;
      margin-top: 1rem;
    }
    .button:hover {
      background: #5a67d8;
    }
    .error { color: #e53e3e; }
    .success { color: #38a169; }
    .warning { color: #d69e2e; }
    .code {
      background: #f7fafc;
      padding: 0.5rem;
      border-radius: 4px;
      font-family: monospace;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>
`;

export class HTMLTemplates {
  /**
   * Authentication Error Template
   */
  static authError(data: TemplateData = {}): string {
    const content = `
      <h1>❌ Authentication Error</h1>
      <p class="error">${data.message || 'Sorry, there was an error starting the authentication process.'}</p>
      ${data.details ? `<p class="code">${data.details}</p>` : ''}
      <p>Please try again from Slack.</p>
      ${data.redirectUrl ? `<a href="${data.redirectUrl}" class="button">${data.buttonText || 'Try Again'}</a>` : ''}
    `;
    return baseTemplate(data.title || 'Authentication Error', content);
  }

  /**
   * Authentication Success Template
   */
  static authSuccess(data: TemplateData = {}): string {
    const content = `
      <h1>✅ Authentication Successful</h1>
      <p class="success">${data.message || 'You have successfully connected your account!'}</p>
      <p>You can now close this window and return to Slack.</p>
      ${data.redirectUrl ? `<a href="${data.redirectUrl}" class="button">${data.buttonText || 'Return to Slack'}</a>` : ''}
      <script>
        // Auto-close window after 3 seconds
        setTimeout(() => {
          if (window.opener) {
            window.close();
          }
        }, 3000);
      </script>
    `;
    return baseTemplate(data.title || 'Authentication Successful', content);
  }

  /**
   * OAuth Callback Processing Template
   */
  static oauthProcessing(data: TemplateData = {}): string {
    const content = `
      <div style="text-align: center;">
        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <h1>🔄 Processing Authentication</h1>
        <p>${data.message || 'Please wait while we complete the authentication process...'}</p>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    return baseTemplate(data.title || 'Processing...', content);
  }

  /**
   * OAuth Revoked Template
   */
  static oauthRevoked(data: TemplateData = {}): string {
    const content = `
      <h1>🔓 Access Revoked</h1>
      <p class="warning">${data.message || 'Your account access has been successfully revoked.'}</p>
      <p>You can close this window or reconnect your account anytime.</p>
      ${data.redirectUrl ? `<a href="${data.redirectUrl}" class="button">${data.buttonText || 'Reconnect Account'}</a>` : ''}
    `;
    return baseTemplate(data.title || 'Access Revoked', content);
  }

  /**
   * Generic Error Template
   */
  static error(data: TemplateData = {}): string {
    const content = `
      <h1>⚠️ ${data.title || 'Error'}</h1>
      <p class="error">${data.message || 'An unexpected error occurred.'}</p>
      ${data.details ? `<div class="code">${data.details}</div>` : ''}
      <p>Please try again or contact support if the problem persists.</p>
      ${data.redirectUrl ? `<a href="${data.redirectUrl}" class="button">${data.buttonText || 'Go Back'}</a>` : ''}
    `;
    return baseTemplate(data.title || 'Error', content);
  }

  /**
   * Debug Template for development
   */
  static debug(data: any): string {
    const content = `
      <h1>🔧 Debug Information</h1>
      <div class="code">
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </div>
      <p><em>This debug information is only shown in development mode.</em></p>
    `;
    return baseTemplate('Debug Info', content);
  }
}