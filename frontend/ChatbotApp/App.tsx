/**
 * Email Intelligence Assistant App
 * Message Components Showcase
 */

import React from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { ChatExample } from './src/components/examples/ChatExample';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <StatusBar 
          barStyle="dark-content" 
          backgroundColor="#FFFFFF" 
        />
        
        <ChatExample />
      </View>
    </SafeAreaProvider>
  );
}

export default App;