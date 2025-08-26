# Assistant App - React Native

A React Native iOS application that provides an AI-powered assistant interface, replacing the previous Swift implementation.

## Features

- **Authentication**: Google Sign-In integration
- **Chat Interface**: Real-time messaging with AI assistant
- **Action Cards**: Interactive cards for email, calendar, and contact actions
- **Modern UI**: Clean, iOS-native design with React Native

## Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Xcode (for iOS development)
- iOS Simulator or physical iOS device
- CocoaPods

## Installation

1. **Clone and navigate to the project:**
   ```bash
   cd AssistantAppRN
   ```

2. **Install JavaScript dependencies:**
   ```bash
   npm install
   ```

3. **Install iOS dependencies:**
   ```bash
   cd ios
   bundle install
   bundle exec pod install
   cd ..
   ```

## Development

### Starting the Metro bundler:
```bash
npx react-native start
```

### Running on iOS:
```bash
npx react-native run-ios
```

Or open `ios/AssistantAppRN.xcworkspace` in Xcode and run from there.

### Building for production:
```bash
cd ios
xcodebuild -workspace AssistantAppRN.xcworkspace -scheme AssistantAppRN -configuration Release -destination generic/platform=iOS -archivePath AssistantAppRN.xcarchive archive
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
│   ├── LoadingScreen.tsx
│   ├── SignInScreen.tsx
│   └── ChatScreen.tsx
├── services/           # API and external services
│   └── APIService.ts
├── types/              # TypeScript type definitions
│   └── index.ts
└── utils/              # Utility functions
```

## Configuration

### Backend URL
Update the `baseURL` in `src/services/APIService.ts` to point to your backend server.

### Google Sign-In
To implement Google Sign-In, you'll need to:
1. Configure Google OAuth in your Google Cloud Console
2. Install and configure `@react-native-google-signin/google-signin`
3. Update the SignInScreen to use the actual Google Sign-In flow

## Key Components

### LoadingScreen
- Initial app loading and authentication check
- Routes to appropriate screen based on auth status

### SignInScreen
- Google Sign-In button
- Clean, modern design
- Terms and privacy policy links

### ChatScreen
- Real-time chat interface
- Message input with send button
- Message history with timestamps
- Sign out functionality

## API Integration

The app is designed to work with your existing backend API:
- `/auth/google` - Google authentication
- `/assistant/chat` - Send messages to AI
- `/assistant/actions` - Get available actions
- `/health` - Health check endpoint

## Troubleshooting

### Common Issues

1. **Pod install fails:**
   ```bash
   cd ios
   pod deintegrate
   pod install
   ```

2. **Metro bundler issues:**
   ```bash
   npx react-native start --reset-cache
   ```

3. **Build errors:**
   - Clean build folder in Xcode
   - Delete derived data
   - Reinstall pods

### Xcode Configuration

Make sure to:
1. Set your development team in the project settings
2. Configure bundle identifier
3. Set up proper signing certificates

## Next Steps

1. **Implement Google Sign-In** using `@react-native-google-signin/google-signin`
2. **Add Action Cards** for email, calendar, and contact management
3. **Integrate with your backend** by updating API endpoints
4. **Add push notifications** for real-time updates
5. **Implement offline support** with local storage
6. **Add analytics and crash reporting**

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Test on both simulator and device
4. Update documentation for new features

## License

This project is part of your Assistant App ecosystem.
