# ChatInput Component Documentation

## Overview

The `ChatInput` component is a beautiful, functional text input designed specifically for chat interfaces in React Native. It features smooth animations, accessibility support, and integrates seamlessly with our design system.

## Features

### ✨ Functionality
- **Multi-line text input** (auto-expands up to 5 lines, then scrolls)
- **Smart send button** (only enabled when text is present)
- **Smooth animations** for send button state changes
- **Keyboard support** (return/enter key submission)
- **Character counting** (shows at 200+ chars)
- **Height transitions** as text expands

### 🎨 Design
- **Generous height** (minimum 52px)
- **Rounded corners** using our border radius scale
- **Subtle shadows** and borders
- **Send button** with paper plane icon (✈)
- **Clear disabled states**
- **Focus state styling**

### ♿ Accessibility
- **Screen reader support** with proper labels and hints
- **Keyboard navigation** support
- **Focus management** for external keyboards
- **Clear visual feedback** for all states

## Basic Usage

```tsx
import { ChatInput } from './src/components/ChatInput';

function MyChatScreen() {
  const handleSendMessage = (message: string) => {
    console.log('Sent:', message);
    // Send to your backend API here
  };

  return (
    <ChatInput 
      onSendMessage={handleSendMessage}
      placeholder="Ask about your emails and calendar..."
    />
  );
}
```

## Props Interface

```typescript
interface ChatInputProps {
  // Core functionality
  onSendMessage: (message: string) => void;
  
  // Appearance
  placeholder?: string;
  disabled?: boolean;
  
  // Behavior
  showCharacterCount?: boolean;
  characterLimit?: number;
  minHeight?: number;
  maxLines?: number;
  multiline?: boolean;
  autoFocus?: boolean;
  focusOnAppear?: boolean;
  
  // Event handlers
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onTextChange?: (text: string) => void;
}
```

## Advanced Usage Examples

### With Character Limits

```tsx
<ChatInput
  onSendMessage={handleSend}
  characterLimit={500}
  showCharacterCount={true}
  placeholder="Tell me about your day..."
/>
```

### In Chat Interface

```tsx
import { ChatInterfaceEnhanced } from './src/components/ChatInterfaceEnhanced';

function ChatScreen() {
  return (
    <ChatInterfaceEnhanced
      onSendMessage={async (message) => {
        // Call your FaaS backend
        const response = await fetch('/api/assistant/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userMessage: message,
            conversationHistory: chatHistory,
            userId: currentUser.id 
          })
        });
        
        const result = await response.json();
        // Handle response...
      }}
      placeholder="Ask about your emails and calendar..."
      autoFocus={true}
      showWelcomeMessage={true}
    />
  );
}
```

### Custom Styling Integration

The component automatically uses our design system values:

- **Colors**: `designSystem.colors.light`
- **Spacing**: `designSystem.spacing['4']`, `designSystem.spacing['8']`, etc.
- **Typography**: `designSystem.typography.sizes.body`
- **Border Radius**: `designSystem.borderRadius.input`
- **Shadows**: Subtle elevation using design system shadow values

## Implementation Details

### Height Animation
- Smoothly expands from 52px minimum height
- Grows incrementally as lines are added
- Maximum of 5 lines before internal scrolling
- 200ms duration with ease-in-out timing

### Send Button States
- **Disabled**: 0.4 opacity, 0.9 scale
- **Enabled**: 1.0 opacity, 1.0 scale
- **Paper plane icon**: ✈ rotated 15 degrees for dynamic feel
- **Spring animation**: Natural bounce effect on state changes

### Character Counting
- Shows count when message exceeds 200 characters
- Appears above input, aligned to the right
- Color changes to warning when approaching limit
- Hidden when not needed to reduce UI clutter

### Keyboard Handling
- **iOS**: Uses `KeyboardAvoidingView` with padding behavior
- **Android**: Uses height behavior for keyboard avoidance
- **Return key**: Sends message (on external keyboards)
- **Focus management**: Proper blur on send

## Design System Integration

### Colors Used
- `colors.surface` - Input background
- `colors.primary` - Send button and focus border
- `colors.borderSecondary` - Default border
- `colors.borderFocus` - Focused border
- `colors.textPrimary` - Text color
- `colors.textTertiary` - Placeholder color
- `colors.warning` - Character limit warning

### Spacing Scale
- Horizontal padding: `spacing['4']` (16px)
- Vertical padding: `spacing['3']` (12px)
- Send button margin: `spacing['3']`
- Internal button padding: Automatic

### Typography
- Input text: `typography.sizes.body` (16px, 24px line-height)
- Character count: `typography.sizes.labelSmall` (12px)
- Placeholder: Same as input with tertiary color

## Accessibility Considerations

### Screen Reader Support
- `accessibilityLabel`: "Message input" / "Send button disabled"
_ `accessibilityHint`: Clear usage instructions
- `accessibilityRole`: "textbox" / "button"

### Keyboard Navigation
- Tab order respects natural flow
- Enter key submits (external keyboards)
- Escape key could blur input (future enhancement)
- Focus indicators meet WCAG AA contrast

### Visual Feedback
- Clear disabled states (reduced opacity and scale)
- Focus indicators (border color change)
- Loading states (if integrated with backend calls)

## Integration with Backend

### API Pattern
```typescript
const handleSendMessage = async (message: string) => {
  try {
    // Show loading state
    setLoading(true);
    
    // Call FaaS backend
    const response = await fetch(process.env.BACKEND_URL + '/api/assistant/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        userMessage: message,
        conversationHistory: messages,
        userId: currentUser.id,
        timestamp: new Date().toISOString(),
      }),
    });
    
    const result = await response.json();
    
    // Handle success
    if (result.success) {
      addAssistantMessage(result.aiResponse);
    } else {
      showError(result.error);
    }
  } catch (error) {
    showNetworkError();
  } finally {
    setLoading(false);
  }
};
```

### Error Handling
- Network errors should disable send button temporarily
- Show user-friendly error messages
- Provide retry mechanisms
- Maintain conversation state on errors

## Performance Considerations

### Optimizations
- `useMemo` for expensive calculations (character count, height)
- `useCallback` for event handlers to prevent re-renders
- Native animations using `useNativeDriver: true`
- Debounced text change handlers for very long messages

### Memory Management
- Auto-trim conversation history (configurable limit)
- Clean up animations on unmount
- Proper ref management for text input focus

## Future Enhancements

### Planned Features
- Voice input integration
- Message drafts (unsent messages)
- Rich text formatting (markdown)
- File attachments
- Emoji picker
- Message search
- Export conversation

### Customizable Options
- Custom send icon
- Different animation timing preferences
- Theme switching (dark mode)
- Custom placeholder animations
- Haptic feedback on send

## Testing Recommendations

### Unit Tests
- Text input behavior
- Send button state changes
- Character counting logic
- Height calculations

### Integration Tests
- Keyboard behavior
- Animation smoothness
- Accessibility compliance
- Focus management

### User Testing
- Ease of typing (touch targets)
- Animation feel (not jarring)
- Accessibility with screen readers
- Performance with long conversations

---

This component provides a solid foundation for chat input in your React Native app while maintaining consistency with your design system and ensuring accessibility compliance.
