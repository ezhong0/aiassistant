# Web Chat Demo

Minimal web chat interface for the Assistant App backend.

## Quick Start (2 steps!)

1. **Start the backend:**
   ```bash
   cd backend && npm start
   ```

2. **Start the web chat:**
   ```bash
   cd webchat && python3 -m http.server 8080
   ```

3. **Open browser:** `http://localhost:8080`

4. **Click "Generate Test Token"** (green button) → Start chatting!

No copy-paste needed! The token is generated in your browser.

## Features

- Minimal single-page HTML app (no build step)
- Maintains conversation context/history
- Shows processing time and token usage
- Clean, modern UI
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)

## Alternative: Manual Token

If you need a specific token, you can:
1. Generate one with: `node generate-token.js`
2. Pass via URL: `http://localhost:8080?token=YOUR_JWT_TOKEN_HERE`
3. Or paste it manually in the input field

## API Endpoint

Connects to: `POST http://localhost:3000/api/chat/message`

Requires:
- `Authorization: Bearer <JWT_TOKEN>` header
- Request body: `{ message: string, context?: object }`

Returns:
- `message`: Assistant's response
- `context`: Updated conversation context
- `metadata`: Processing stats (time, tokens, layers)
