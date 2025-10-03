# Chat Message Components

A complete set of React Native message components for email intelligence chat interface, built using the design system.

## 📱 Components

### 1. UserMessage
Right-aligned message bubble for user input with timestamp toggle.

### 2. AssistantMessage  
Left-aligned message bubble with avatar, markdown support, and action buttons.

### 3. SystemMessage
Centered system notifications with type indicators and auto-hide functionality.

## 🎨 Design System Usage

All components use our design system values:

**Spacing**: `spacing.chatMessageMargin`, `spacing['4']`  
**Colors**: `colors.messageSent`, `colors.messageReceived`  
**Typography**: `typography.sizes.chatMessage`, `typography.sizes.chatTime`  
**Border Radius**: `borderRadius.message` (16px for chat bubbles)  
**Animations**: `animations.duration.fast` (250ms fade-in)

## 🚀 Features

### ✨ Animations
- **FadeInUp**: Enter animation with configurable delay
- **Press Feedback**: Native opacity change on touch
- **Loading States**: Smooth opacity transitions
- **Hide Animations**: Fade + scale for dismissible messages

### 📊 Markdown Support
Assistant messages support:
- **Bold text**: `**important**`
- *Italic text*: `*emphasis*`
- `Code blocks`: `\`code\``

### ⏰ Timestamp Handling
- **Relative time**: "2m ago", "Yesterday"
- **Absolute time**: "2:45 PM" (on press)
- **Auto-updates**: Refresh every 30 seconds
- **Formatted display**: Clean, readable timestamps

### 🎯 Gestures
- **Tap**: Show/hide timestamp or custom action
- **Long Press**: Custom long-press handlers
- **Dismiss**: System messages can be dismissed

## 💡 Usage Examples

### User Message
```tsx
<UserMessage
  message="Find emails from Sarah this week"
  timestamp={Date.now() - 300000} // 5 minutes ago
  onPress={() => console.log('Quick action')}
  onLongPress={() => console.log('Show options')}
  isLoading={false}
/>
```

### Assistant Message with Markdown
```tsx
<AssistantMessage
  message="Found **3 emails** from Sarah Chen:\n\n• *Budget review* needed\n• Meeting notes attached\n• Use \`detailed_view\` for more"
  timestamp={Date.now()}
  onPress={() => showEmailDetails()}
  customContent={<EmailListView emails={emails} />}
/>
```

### System Messages
```tsx
// Info notification
<SystemMessage message="Connected to Work Gmail" />

// Success with auto-hide
<SystemMessage 
  message="Email sent successfully" 
  type="success" 
  autoHideAfter={3000}
/>

// Warning with dismiss
<SystemMessage 
  message="Unable to sync calendar events" 
  type="warning"
  dismissible 
/>

// Loading state
<SystemMessage 
  message="Analyzing emails..." 
  type="loading"
/>
```

## 🎨 Styling Details

### User Messages
- **Alignment**: Right (`alignSelf: 'flex-end'`)
- **Max Width**: 80% to prevent overly wide messages
- **Background**: `messageSent` color (light indigo)
- **Animation**: FadeInUp with configurable delay

### Assistant Messages  
- **Alignment**: Left (`alignSelf: 'flex-start'`)
- **Max Width**: 85% (wider for readability)
- **Avatar**: 28px AI icon with brand colors
- **Background**: `messageReceived` color (light gray)
- **Markdown**: Inline parsing with style preservation

### System Messages
- **Alignment**: Center (`alignSelf: 'center'`)
- **Max Width**: 90% to prevent overly wide messages
- **Types**: Info (gray), Success (green), Warning (amber), Loading (blue)
- **Icons**: ✓ ⚠ ⟳ ℹ for visual context
- **Auto-hide**: Configurable timer with smooth fade-out

## 🔧 Customization

### Custom Avatar
```tsx
const customAvatar = (
  <View style={{ width: 32, height: 32, backgroundColor: 'purple', borderRadius: 16 }}>
    <Text>AA</Text>
  </View>
);

<AssistantMessage
  message="Custom avatar message"
  timestamp={Date.now()}
  avatar={customAvatar}
/>
```

### Custom Content
```tsx
const emailList = (
  <View>
    <Text style={{ fontWeight: 'bold' }}>Emails Found:</Text>
    {emails.map(email => (
      <Text key={email.id}>• {email.subject}</Text>
    ))}
  </View>
);

<AssistantMessage
  message="Here are your emails"
  timestamp={Date.now()}
  customContent={emailList}
/>
```

### Animation Staggering
```tsx
const messages = [
  <UserMessage message="Hello" timestamp={Date.now()} animationDelay={0} />,
  <AssistantMessage message="Hi there!" timestamp={Date.now()} animationDelay={100} />,
  <UserMessage message="Find emails" timestamp={Date.now()} animationDelay={200} />,
];
```

## 📱 Mobile Optimizations

- **Touch Targets**: Minimum 44px touch areas
- **Typography**: Mobile-optimized font sizes and line heights  
- **Performance**: Minimal re-renders with React.memo consideration
- **Accessibility**: Proper contrast ratios and semantic structure
- **Gestures**: Native press feedback and long-press support

## 🚀 Next Steps

1. **Connect Backend**: Integrate with `/api/chat/process` endpoint
2. **Add Actions**: Email view, calendar scheduling, contact lookup
3. **Rich Content**: Image previews, file attachments, event cards
4. **Voice Input**: Speech-to-text for hands-free messaging
5. **Push Notifications**: Real-time message updates

## 🎯 Performance Notes

- **Animations**: Uses React Native Reanimated for 60fps animations
- **Markdown**: Simple parser (consider react-native-markdown-display for complex formatting)
- **Timestamps**: Smart update intervals based on message age
- **Memory**: Components designed for minimal memory footprint
- **Re-renders**: Stable prop interfaces to prevent unnecessary updates

The message components are production-ready and optimized for email intelligence workflows! 🚀
