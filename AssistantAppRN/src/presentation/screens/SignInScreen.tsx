import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCaseFactory } from '../../domain';
import { BaseComponent } from '../components/BaseComponent';

export const SignInScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Get use case instance
  const userUseCase = useCaseFactory.createUserUseCase();

  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Implement actual Google Sign-In
      // For now, use mock token
      const result = await userUseCase.signIn({
        idToken: 'mock_google_token',
        provider: 'google',
      });
      
      if (result.success) {
        Alert.alert(
          'Welcome!', 
          `Successfully signed in as ${result.user?.name}`,
          [
            {
              text: 'Continue',
              onPress: () => {
                // TODO: Navigate to main app
                console.log('Navigate to main app');
              },
            },
          ]
        );
      } else {
        Alert.alert('Sign In Failed', result.error || 'Authentication failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  }, [userUseCase]);

  const handleAppleSignIn = useCallback(async () => {
    Alert.alert('Coming Soon', 'Apple Sign-In will be available soon');
  }, []);

  const handleEmailSignIn = useCallback(async () => {
    Alert.alert('Coming Soon', 'Email Sign-In will be available soon');
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BaseComponent style={styles.container}>
        <View style={styles.content}>
          {/* Logo and Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>🤖</Text>
            </View>
            <Text style={styles.title}>AI Assistant</Text>
            <Text style={styles.subtitle}>
              Your intelligent companion for productivity
            </Text>
          </View>

          {/* Sign In Options */}
          <View style={styles.signInSection}>
            <Text style={styles.sectionTitle}>Sign In to Continue</Text>
            
            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.signInButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Sign In */}
            <TouchableOpacity
              style={[styles.signInButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Text style={styles.appleIcon}>🍎</Text>
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </TouchableOpacity>

            {/* Email Sign In */}
            <TouchableOpacity
              style={[styles.signInButton, styles.emailButton]}
              onPress={handleEmailSignIn}
              disabled={isLoading}
            >
              <Text style={styles.emailIcon}>✉️</Text>
              <Text style={styles.emailButtonText}>Continue with Email</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </BaseComponent>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    fontSize: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  signInSection: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 24,
    textAlign: 'center',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  appleIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  emailButton: {
    backgroundColor: '#6c757d',
  },
  emailIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SignInScreen;
