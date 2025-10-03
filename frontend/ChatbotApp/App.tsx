import React, { useState, useEffect } from 'react';
import {
  View, 
  Text, 
  StatusBar, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  SafeAreaView,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { designSystem } from './src/design-system';

// 🎨 OBSESSIVE POLISH Email Intelligence Assistant - STUNNING VERSION
// Superhuman-level quality with attention to every pixel

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ExampleQuery {
  id: string;
  text: string;
  icon: string;
}

interface ConnectedAccount {
  email: string;
  type: 'work' | 'personal';
  connected: boolean;
  dotColor: 'work' | 'personal' | 'disconnected';
}

const SCREEN_WIDTH = Dimensions.get('window').width;

function App(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [iconPulseAnim] = useState(new Animated.Value(1));

  // 🎯 Connected accounts with realistic emails
  const connectedAccounts: ConnectedAccount[] = [
    { email: 'work@acme.com', type: 'work', connected: true, dotColor: 'work' },
    { email: 'personal@gmail.com', type: 'personal', connected: true, dotColor: 'personal' },
  ];

  // 💎 Example queries with crisp, actionable language
  const exampleQueries: ExampleQuery[] = [
    { id: '1', text: 'Show me urgent emails', icon: '⚡' },
    { id: '2', text: 'What emails need replies?', icon: '✉️' },
    { id: '3', text: 'Today\'s meetings and events', icon: '📅' },
    { id: '4', text: 'Upcoming deadlines this week', icon: '📋' },
  ];

  // Subtle icon animation on app start
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(iconPulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    
    // Start animation once on app open
    const timeoutId = setTimeout(() => pulseAnimation.start(), 1000);

    return () => {
      clearTimeout(timeoutId);
      pulseAnimation.stop();
    };
  }, [iconPulseAnim]);

  const handleSendMessage = (text: string) => {
    if (text.trim()) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        text: text.trim(),
        sender: 'user',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
    }
  };

  const handleExampleQuery = (query: ExampleQuery) => {
    handleSendMessage(query.text);
  };

  const colors = designSystem.colors[theme];
  const typography = designSystem.typography.sizes;
  const spacing = designSystem.spacing;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background} 
        translucent={false}
      />
      
      {/* 🔝 FLOATING Account Pills - No Background Bar */}
      <FloatingAccountPills 
        accounts={connectedAccounts} 
        colors={colors} 
        spacing={designSystem.spacing}
        typography={typography} 
        heights={designSystem.sizing.heights}
        onSettingsPress={() => console.log('Settings pressed')}
      />
      
      {/* 📱 Main Content Area */}
      <View style={styles.chatContainer}>
        {messages.length === 0 ? (
          <ObsessivePolishEmptyState 
            queries={exampleQueries}
            colors={colors}
            spacing={designSystem.spacing}
            typography={typography}
            elevation={designSystem.sizing.elevation}
            iconPulseAnim={iconPulseAnim}
            heights={designSystem.sizing.heights}
            onExamplePress={handleExampleQuery}
          />
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PolishedMessageBubble 
                message={item} 
                colors={colors} 
                spacing={designSystem.spacing} 
                typography={typography} 
              />
            )}
            style={styles.messagesList}
            contentContainerStyle={[styles.messagesContent, { paddingBottom: spacing.layout.contentToInput }]}
            inverted={false}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      
      {/* ⌨️ PROMINENT Input Field - Unmistakably Primary Action */}
      <ProminentInputField 
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSendMessage}
        colors={colors}
        spacing={designSystem.spacing}
        typography={typography}
        elevation={designSystem.sizing.elevation}
        sizing={designSystem.sizing}
      />
    </SafeAreaView>
  );
}

// 🔝 FLOATING Account Pills - No Background Container
const FloatingAccountPills = ({ 
  accounts, 
  colors, 
  spacing, 
  typography, 
  heights, 
  onSettingsPress 
}: {
  accounts: ConnectedAccount[];
  colors: any;
  spacing: any;
  typography: any;
  heights: any;
  onSettingsPress: () => void;
}) => (
  <View style={[styles.floatingAccountContainer, { 
    paddingTop: spacing.layout.accountBarToContent,
    paddingHorizontal: spacing.lg,
  }]}>
    <View style={styles.accountRow}>
      {/* Floating account pills - no background bar */}
      <View style={styles.accountPillsFloating}>
        {accounts.map((account, index) => {
          const dotColor = account.connected 
            ? colors[account.dotColor === 'work' ? 'accountWork' : 'accountPersonal']
            : colors.accountDisconnected;
            
          return (
            <TouchableOpacity
              key={index}
              style={[styles.floatingAccountPill, {
                backgroundColor: colors.surfaceElevated,
                paddingHorizontal: spacing.enhancedInputPadding,
                paddingVertical: spacing.sm,
              }]}
              activeOpacity={designSystem.animations.opacity.pressed}
            >
              <View style={[styles.accountDot, { backgroundColor: dotColor }]} />
              <Text 
                style={[styles.accountTextFloating, typography.label, { 
                  color: colors.textSecondary,
                  marginLeft: spacing.xs,
                }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {account.connected ? account.email : 'Disconnected'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Enhanced settings icon */}
      <TouchableOpacity 
        onPress={onSettingsPress} 
        style={[styles.enhancedSettingsIcon]}
        activeOpacity={designSystem.animations.opacity.pressed}
      >
        <Text style={[styles.enhancedSettingsIconText, { 
          color: colors.textMuted,
          fontSize: heights.settingsIcon,
        }]}>
          ⚙️
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

// 💎 OBSESSIVE POLISH Empty State - Hero Typography + Whisper Buttons
const ObsessivePolishEmptyState = ({ 
  queries, 
  colors, 
  spacing, 
  typography, 
  elevation, 
  iconPulseAnim,
  heights,
  onExamplePress 
}: {
  queries: ExampleQuery[];
  colors: any;
  spacing: any;
  typography: any;
  elevation: any;
  iconPulseAnim: Animated.Value;
  heights: any;
  onExamplePress: (query: ExampleQuery) => void;
}) => (
  <View style={[styles.polishedEmptyState, { 
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.layout.accountBarToContent,
  }]}>
    {/* 🎯 Hero Icon with Subtle Animation */}
    <Animated.View 
      style={[
        styles.heroIconPolished, 
        { 
          marginBottom: spacing.layout.iconToHeadline,
          transform: [{ scale: iconPulseAnim }],
        }
      ]}
    >
      <Text style={[styles.heroIconTextPolished, { fontSize: heights.iconSize }]}>
        🌟
      </Text>
    </Animated.View>
    
    {/* 📝 DRAMATIC Typography Hierarchy */}
    <Text style={[styles.dramaticHeadline, typography.headline, { 
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.layout.headlineToSubtext,
    }]}>
      Your email intelligence assistant
    </Text>
    
    {/* Subtle supporting message */}
    <Text style={[styles.subtleSubtext, typography.subheadline, {
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.layout.subtextToButtons,
    }]}>
      Ask me about your emails and calendar
    </Text>
    
    {/* 👻 WHISPER Button Examples - Almost Invisible */}
    <View style={styles.whisperButtonsContainer}>
      {queries.map((query) => (
        <TouchableOpacity
          key={query.id}
          onPress={() => onExamplePress(query)}
          style={[styles.whisperButton, {
            backgroundColor: colors.ghostButtonBg,
            borderColor: colors.borderSubtle,
            marginBottom: spacing.layout.betweenButtons,
            height: designSystem.sizing.heights.ghostButton,
            ...elevation.subtle,
          }]}
          activeOpacity={designSystem.animations.opacity.pressed}
        >
          <Text style={[styles.whisperButtonIcon, { 
            fontSize: 18,
            marginRight: spacing.md,
            opacity: 0.7, // Slightly more visible
          }]}>
            {query.icon}
          </Text>
          <Text 
            style={[styles.whisperButtonText, typography.button, {
              color: colors.textPrimary,
              flex: 1,
              flexWrap: 'wrap',
            }]}
            numberOfLines={0} // Allow unlimited lines for full button text
          >
            {query.text}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// 💬 Polished Message Bubble
const PolishedMessageBubble = ({ message, colors, spacing, typography }: {
  message: ChatMessage;
  colors: any;
  spacing: any;
  typography: any;
}) => (
  <View style={[styles.messageWrapper, {
    alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
  }]}>
    <View style={[styles.messageBubble, {
      backgroundColor: message.sender === 'user' ? colors.messageSent : colors.messageReceived,
      marginBottom: spacing.xs,
      maxWidth: SCREEN_WIDTH * 0.8, // Increased from 0.75 for better text visibility
      minWidth: SCREEN_WIDTH * 0.3, // Add minimum width for readability
    }]}>
      <Text 
        style={[styles.messageText, typography.chatMessage, {
          color: colors.textPrimary,
        }]}
        numberOfLines={0} // Allow unlimited lines for full message display
      >
        {message.text}
      </Text>
    </View>
  </View>
);

// ⌨️ PROMINENT Input Field - Undeniably Primary Action
const ProminentInputField = ({ 
  value, 
  onChangeText, 
  onSend, 
  colors, 
  spacing, 
  typography, 
  elevation, 
  sizing 
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  colors: any;
  spacing: any;
  typography: any;
  elevation: any;
  sizing: any;
}) => {
  const handleSend = () => {
    onSend(value);
  };

  return (
    <View style={[styles.prominentInputContainer, {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    }]}>
      <View style={[styles.dominantInputField, {
        backgroundColor: colors.inputBackground,
        borderColor: colors.inputBorder,
        borderRadius: sizing.borderRadius.lg,
        height: sizing.heights.inputField,
        borderWidth: 1.5, // Thicker border
        ...elevation.medium, // More prominent shadow
      }]}>
        <TextInput
          style={[styles.dominantTextInput, typography.input, {
            flex: 1,
            color: colors.textPrimary,
            paddingHorizontal: spacing.lg,
          }]}
          placeholder="Ask me about your emails and calendar..."
          placeholderTextColor={colors.inputPlaceholder}
          value={value}
          onChangeText={onChangeText}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          selectionColor={colors.primary}
        />
        
        {value.trim() && (
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.prominentSendButton, {
              backgroundColor: colors.primary,
              marginRight: spacing.md,
              width: sizing.widths.inputFieldSendButton,
              height: sizing.heights.sendButton,
              borderRadius: sizing.widths.inputFieldSendButton / 2,
            }]}
            activeOpacity={designSystem.animations.opacity.pressed}
          >
            <Text style={[styles.sendButtonIconProminent, { color: colors.textPrimary }]}>
              →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// 🎨 OBSESSIVE POLISH Styles - Every Pixel Refined
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // FLOATING Account pills - no background bar
  floatingAccountContainer: {
    // No background color - pills float directly on main background
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: designSystem.sizing.heights.accountStatusBar,
  },
  accountPillsFloating: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Allow pills to take available space
    flexWrap: 'wrap', // Allow wrapping if needed
  },
  floatingAccountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginRight: designSystem.spacing.md,
    flexShrink: 0, // Prevent shrinking
    // Very subtle background - not a bar
  },
  accountDot: {
    width: designSystem.sizing.heights.accountDot,
    height: designSystem.sizing.heights.accountDot,
    borderRadius: designSystem.sizing.heights.accountDot / 2,
  },
  accountTextFloating: {
    fontSize: 13,
    fontWeight: '500',
  },
  enhancedSettingsIcon: {
    padding: designSystem.spacing.sm,
  },
  enhancedSettingsIconText: {
    fontSize: designSystem.sizing.heights.settingsIcon,
    opacity: 0.8,
  },
  
  // Chat container
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: designSystem.spacing.lg,
    paddingTop: designSystem.spacing.xl,
  },
  
  // POLISHED Empty state
  polishedEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconPolished: {
    // No background - clean icon treatment
  },
  heroIconTextPolished: {
    opacity: 0.9,
  },
  dramaticHeadline: {
    fontWeight: '700', // Bold, not semibold
    letterSpacing: -0.8, // Tight, refined
  },
  subtleSubtext: {
    opacity: 0.6, // Very subtle
  },
  
  // WHISPER buttons
  whisperButtonsContainer: {
    width: '100%',
    maxWidth: SCREEN_WIDTH * 0.95, // Responsive max width instead of fixed
  },
  whisperButton: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Changed from 'center' to allow text wrapping
    paddingHorizontal: designSystem.spacing.buttonPaddingHorizontal,
    paddingVertical: designSystem.spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.md,
    borderWidth: 1,
    justifyContent: 'flex-start',
    opacity: 0.85, // Subtle throughout
    minHeight: designSystem.sizing.heights.ghostButton, // Ensure minimum height
  },
  whisperButtonIcon: {
    marginRight: designSystem.spacing.md,
  },
  whisperButtonText: {
    fontWeight: '500',
  },
  
  // Message bubbles
  messageWrapper: {
    width: '100%',
  },
  messageBubble: {
    paddingHorizontal: designSystem.spacing.lg,
    paddingVertical: designSystem.spacing.lg,
    borderRadius: designSystem.sizing.borderRadius.hero,
  },
  messageText: {
    fontWeight: '400',
  },
  
  // PROMINENT input field
  prominentInputContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.02)', // Almost invisible
  },
  dominantInputField: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dominantTextInput: {
    fontWeight: '400',
  },
  prominentSendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? designSystem.sizing.elevation.subtle : {}),
  },
  sendButtonIconProminent: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default App;