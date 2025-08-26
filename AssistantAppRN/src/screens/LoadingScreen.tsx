import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type LoadingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Loading'>;

const LoadingScreen: React.FC = () => {
  const navigation = useNavigation<LoadingScreenNavigationProp>();

  useEffect(() => {
    // Simulate loading time and check authentication status
    const timer = setTimeout(() => {
      // TODO: Check if user is authenticated
      const isAuthenticated = false; // Replace with actual auth check
      
      if (isAuthenticated) {
        navigation.replace('Chat');
      } else {
        navigation.replace('SignIn');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assistant App</Text>
      <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} />
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 20,
  },
  spinner: {
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default LoadingScreen;
