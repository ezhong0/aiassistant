# Email Intelligence Assistant

A React Native chat app with a modern design system for email intelligence assistance.

## Quick Start

```bash
# Start Metro bundler
npm start

# Run on iOS simulator (in another terminal)
npm run ios
```

## Project Structure

```
src/
├── design-system/           # Complete design system
│   ├── index.ts            # Color palette, typography, spacing
│   ├── tailwind.config.js # NativeWind configuration
│   └── README.md          # Design system documentation
└── components/
    └── design-system/      # Ready-to-use components
        ├── Button.tsx
        ├── Card.tsx
        ├── Text.tsx
        ├── ChatMessage.tsx
        └── ChatInterface.tsx
```

## Design System

The app uses a modern, minimal design system inspired by Linear, Raycast, and Arc Browser:

- **Modern color palette** with light/dark mode support
- **Accessible typography** with WCAG AA compliance
- **8-point spacing scale** for consistent layouts
- **Component library** with Button, Card, Text, ChatMessage

See `src/design-system/README.md` for complete documentation.

## Next Steps

1. Connect to your FaaS backend at `/api/chat/process`
2. Add authentication flow
3. Implement real-time messaging
4. Add push notifications

## Development

- **TypeScript**: Full type safety
- **iOS Only**: Focused on iOS development
- **Design System**: Production-ready components