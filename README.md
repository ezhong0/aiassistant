# Assistant App

A personal AI assistant with Node.js backend and iOS app, featuring Google integration for Gmail, Calendar, and Contacts.

## 🚀 Quick Start

### Backend
```bash
cd backend
npm install
npm run dev    # Starts on http://localhost:3000
```

### iOS
```bash
open ios/AssistantApp.xcodeproj
# Build and run in Xcode (⌘+R)
```

## 🏗️ Project Structure

```
assistantapp/
├── backend/           # Node.js/Express API server
│   ├── src/
│   │   ├── agents/    # AI agents and automation logic
│   │   ├── services/  # Business logic and external integrations
│   │   ├── middleware/# Express middleware functions
│   │   ├── routes/    # API route handlers
│   │   └── index.ts   # Main application entry point
│   └── .env           # Environment variables (created)
├── ios/               # iOS SwiftUI application
│   └── AssistantApp/  # Main iOS app
├── credentials/       # Google Cloud credentials (secured)
└── n8n/              # Workflow automation configs
```

## ✅ Setup Status

- ✅ **Google Cloud Integration**: OAuth & APIs configured
- ✅ **iOS Google Sign-In**: Working with GoogleSignIn SDK 7.1.0
- ✅ **Backend Authentication**: JWT token exchange working
- ✅ **Environment Configuration**: All credentials secured
- ✅ **Build System**: Both iOS and backend building successfully

## 🔧 Development

### Backend Commands
```bash
npm run dev        # Development server with hot reload
npm run build      # Build TypeScript
npm run lint       # Run ESLint
npm run format     # Format with Prettier
```

### Available APIs
- **Gmail API**: Email management and automation
- **Calendar API**: Calendar integration and scheduling
- **Contacts API**: Contact management
- **Authentication**: Google OAuth 2.0 flow

## 🛠️ Technologies

**Backend:**
- Node.js & Express
- TypeScript
- Google APIs (Gmail, Calendar, Contacts)
- JWT Authentication
- Winston Logging

**iOS:**
- SwiftUI
- GoogleSignIn SDK
- iOS 18.5+
- Xcode 16.4+

## 📱 Features

- **Google Authentication**: Secure OAuth 2.0 flow
- **Email Management**: Gmail integration
- **Calendar Integration**: Google Calendar access
- **Contact Management**: Google Contacts integration
- **AI Agents**: Automated task processing
- **Cross-Platform**: iOS app with Node.js backend

## 🔒 Security

- All credentials stored securely in `credentials/` (gitignored)
- JWT tokens for authentication
- Environment variables for configuration
- OAuth 2.0 for Google integration