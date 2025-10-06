# Email Intelligence Assistant

A React Native chat app with a modern design system for email intelligence assistance.

## Quick Start

```bash
# Start Metro bundler
npm start

# Run on iOS simulator (in another terminal)
npm run ios

# Run on Android emulator
npm run android
```

## Project Structure

```
src/
├── components/          # React components
│   ├── messages/       # Message components
│   └── onboarding/     # Onboarding flow
├── design-system/      # Design system
│   └── components/     # DS components
├── services/           # Business logic
├── types/              # TypeScript types
└── utils/              # Utilities
```

## Design System

The app uses a modern, minimal design system inspired by Linear, Raycast, and Arc Browser:

- **Modern color palette** with light/dark mode support
- **Accessible typography** with WCAG AA compliance
- **8-point spacing scale** for consistent layouts
- **Component library** with Button, Card, Text, ChatMessage

See `src/design-system/README.md` for complete documentation.

## Development

- **TypeScript**: Full type safety
- **iOS Focus**: Optimized for iOS development
- **Design System**: Production-ready components

## Next Steps

1. Connect to your backend API at `/api/chat/process`
2. Add authentication flow
3. Implement real-time messaging
4. Add push notifications