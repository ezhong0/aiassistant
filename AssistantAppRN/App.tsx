/**
 * Assistant App - React Native
 * Main application entry point with clean architecture
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

// Store
import { store, persistor } from './src/store';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppNavigator />
      </PersistGate>
    </Provider>
  );
}

export default App;
