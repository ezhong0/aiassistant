/**
 * Message utility functions for chat interface
 */

export interface FormattedTime {
  relative: string;
  absolute: string;
}

/**
 * Format timestamp into relative and absolute time strings
 * Relative: "2h ago", "Yesterday", "Just now"
 * Absolute: "2:45 PM", "12/25/24"
 */
export const formatTimestamp = (timestamp: number | Date): FormattedTime => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffMs = now.getTime() - messageTime.getTime();
  
  // Relative time formatting
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  let relative: string;
  
  if (minutes < 1) {
    relative = 'Just now';
  } else if (minutes < 60) {
    relative = `${minutes}m ago`;
  } else if (hours < 24) {
    relative = `${hours}h ago`;
  } else if (days === 1) {
    relative = 'Yesterday';
  } else if (days < 7) {
    relative = `${days}d ago`;
  } else {
    relative = messageTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  // Absolute time formatting
  const absolute = messageTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  return { relative, absolute };
};

/**
 * Simple markdown parser for assistant messages
 * Supports: **bold**, *italic*, > quotes, - lists, `code`
 */
export const parseMarkdown = (text: string): Array<{ type: 'text' | 'bold' | 'italic' | 'code'; content: string }> => {
  const tokens: Array<{ type: 'text' | 'bold' | 'italic' | 'code'; content: string }> = [];
  
  // Simple tokenization (for more complex markdown, use a library like react-native-markdown-display)
  let remaining = text;
  
  while (remaining.length > 0) {
    // Look for **bold** text
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    if (boldMatch && boldMatch.index === 0) {
      tokens.push({ type: 'bold', content: boldMatch[1] });
      remaining = remaining.substring(boldMatch[0].length);
      continue;
    }
    
    // Look for *italic* text
    const italicMatch = remaining.match(/\*(.*?)\*/);
    if (italicMatch && italicMatch.index === 0) {
      tokens.push({ type: 'italic', content: italicMatch[1] });
      remaining = remaining.substring(italicMatch[0].length);
      continue;
    }
    
    // Look for `code` text
    const codeMatch = remaining.match(/`(.*?)`/);
    if (codeMatch && codeMatch.index === 0) {
      tokens.push({ type: 'code', content: codeMatch[1] });
      remaining = remaining.substring(codeMatch[0].length);
      continue;
    }
    
    // Regular text
    const nextSpecialChar = remaining.search(/[\*\`]/);
    if (nextSpecialChar === -1) {
      tokens.push({ type: 'text', content: remaining });
      break;
    }
    
    tokens.push({ type: 'text', content: remaining.substring(0, nextSpecialChar) });
    remaining = remaining.substring(nextSpecialChar);
  }
  
  return tokens;
};

/**
 * Get relative time update interval for timestamps
 * Returns milliseconds to wait before updating timestamp display
 */
export const getTimestampUpdateInterval = (timestamp: number | Date): number => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffMs = now.getTime() - messageTime.getTime();
  
  // Update intervals based on age
  if (diffMs < 60000) return 10000; // < 1 minute: update every 10 seconds
  if (diffMs < 3600000) return 60000; // < 1 hour: update every minute
  if (diffMs < 86400000) return 300000; // < 1 day: update every 5 minutes
  return 0; // > 1 day: no updates needed
};
