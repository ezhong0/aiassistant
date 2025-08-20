# Development Guide

Quick reference for developing the Assistant App.

## 🚀 Getting Started

### 1. Start Backend
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:3000`

### 2. Start iOS App
```bash
open ios/AssistantApp.xcodeproj
# Press ⌘+R to build and run
```

## 🔧 Common Commands

### Backend
```bash
npm run dev        # Development server
npm run build      # Build TypeScript
npm run lint       # Check code style
npm run format     # Format code
```

### iOS
- **Build**: ⌘+B
- **Run**: ⌘+R
- **Clean**: ⌘+Shift+K

## 📁 Key Files

### Backend
- `src/index.ts` - Main server entry point
- `src/routes/auth.routes.ts` - Authentication endpoints
- `src/services/auth.service.ts` - Google OAuth logic
- `.env` - Environment variables (configured)

### iOS
- `AssistantAppApp.swift` - App entry point
- `AuthenticationManager.swift` - Google Sign-In logic
- `ContentView.swift` - Main UI
- `GoogleService-Info.plist` - Firebase config (configured)

## 🔍 Testing

### Test Google Sign-In Flow
1. Start backend: `npm run dev`
2. Run iOS app in simulator
3. Tap "Sign in with Google"
4. Complete OAuth flow
5. Check backend logs for token exchange

### Backend Endpoints
- `GET /health` - Health check
- `POST /auth/exchange-mobile-tokens` - Token exchange
- `POST /auth/logout` - Sign out

## 🐛 Troubleshooting

### Port 3000 Already in Use
```bash
lsof -ti:3000 | xargs kill -9
```

### iOS Build Issues
1. Clean build folder: ⌘+Shift+K
2. Restart Xcode
3. Check Xcode console for specific errors

### Backend Issues
- Check `.env` file exists
- Verify Google credentials in `credentials/`
- Check server logs for specific errors

## 📚 Next Steps

1. **Build Gmail Service**: `src/services/gmail.service.ts`
2. **Build Calendar Service**: `src/services/calendar.service.ts`
3. **Build Contact Service**: `src/services/contacts.service.ts`
4. **Add AI Agents**: Expand `src/agents/`

## 🔒 Security Notes

- Never commit `.env` files
- Keep `credentials/` directory secure
- **Never commit `GoogleService-Info.plist`** - use template instead
- Rotate Google Cloud credentials periodically
- Use HTTPS in production

### Setting up GoogleService-Info.plist
1. Copy `GoogleService-Info.plist.template` to `GoogleService-Info.plist`
2. Fill in your actual Google Cloud values
3. **Never commit the real file** - it's in `.gitignore`
