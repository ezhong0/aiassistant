# Assistant App Monorepo

A full-stack application with Node.js/Express backend and iOS mobile app.

## Project Structure

```
assistantapp/
├── backend/           # Node.js/Express API server
│   ├── src/
│   │   ├── agents/    # AI agents and automation logic
│   │   ├── services/  # Business logic and external integrations
│   │   ├── middleware/# Express middleware functions
│   │   ├── routes/    # API route handlers
│   │   └── index.ts   # Main application entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
├── ios/               # iOS SwiftUI application
│   ├── AssistantApp.xcodeproj/
│   ├── AssistantApp/
│   │   ├── Views/     # SwiftUI views
│   │   ├── Models/    # Data models
│   │   ├── ViewModels/# View models (MVVM)
│   │   ├── Services/  # API and business logic
│   │   ├── Utils/     # Utility functions
│   │   └── Resources/ # Assets and resources
│   ├── AssistantAppTests/
│   └── AssistantAppUITests/
└── README.md
```

## Getting Started

### Backend Development

```bash
cd backend
npm install
npm run dev    # Start development server
npm run build  # Build TypeScript
npm run lint   # Run ESLint
npm run format # Format with Prettier
```

### iOS Development

Open `ios/AssistantApp.xcodeproj` in Xcode to build and run the iOS app.

## Technologies

**Backend:**
- Node.js & Express
- TypeScript
- ESLint & Prettier
- Husky (pre-commit hooks)

**iOS:**
- SwiftUI
- iOS 17.2+
- Xcode 15.2+