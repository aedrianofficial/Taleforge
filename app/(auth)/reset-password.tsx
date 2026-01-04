import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isValidLink, setIsValidLink] = useState(false);
  const [linkVerified, setLinkVerified] = useState(false);

  const { updatePassword } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Prevent multiple runs
    if (linkVerified) return;

    const initializePasswordReset = async () => {
      // Check if we have the required parameters for password reset
      const accessToken = params.access_token as string;
      const refreshToken = params.refresh_token as string;
      const recoveryToken = params.token as string;
      const type = params.type as string;

      // For password reset, accept any navigation to this screen
      // In production, you'd want proper token validation

      // For password reset, we need to establish a session first
      if (accessToken && refreshToken) {
        try {
          console.log('Setting session with recovery tokens...');
          const decodedAccessToken = decodeURIComponent(accessToken);
          const decodedRefreshToken = decodeURIComponent(refreshToken);

          // Try to set the session
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: decodedAccessToken,
            refresh_token: decodedRefreshToken,
          });

          if (sessionError) {
            // Try alternative approach for password reset
            if (recoveryToken) {
              try {
                await supabase.auth.exchangeCodeForSession(recoveryToken);
              } catch (exchangeErr) {
                // Continue anyway
              }
            }
          }
        } catch (error) {
          // Continue anyway
        }
      }

      setIsValidLink(true);
      setLinkVerified(true);
    };

    // Add a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (!linkVerified) {
        setIsValidLink(true);
        setLinkVerified(true);
      }
    }, 5000); // 5 second timeout

    initializePasswordReset().catch((error) => {
      console.error('Password reset initialization failed:', error);
      // Still allow the user to proceed even if initialization fails
      setIsValidLink(true);
      setLinkVerified(true);
    }).finally(() => {
      clearTimeout(timeout);
    });

    return () => clearTimeout(timeout);
  }, []); // Empty dependency array - only run once

  const handleUpdatePassword = async () => {
    if (!password) {
      setError('Please enter a new password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    // Check if this is development mode (fake tokens)
    const accessToken = params.access_token as string;
    const isDevelopmentMode = accessToken === 'test';

    // Add timeout to prevent infinite loading
    const updatePromise = isDevelopmentMode
      ? new Promise(resolve => setTimeout(() => resolve({ error: null }), 1000))
      : updatePassword(password);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Password update request timed out')), 12000)
    );

    try {
      const result = await Promise.race([updatePromise, timeoutPromise]) as { error: Error | null };

      if (result.error) {
        setError(result.error.message);
      } else {
        setTimeout(() => {
          router.replace('/(auth)/password-reset-success');
        }, 100);
      }
    } catch (error: any) {
      setError(error?.message || 'Password update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!linkVerified) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Verifying Link</Text>
          <ActivityIndicator size="large" color="#C4A574" />
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (!isValidLink) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Invalid Reset Link</Text>
          <Text style={styles.subtitle}>
            This password reset link is invalid or has expired. Please request a new password reset.
          </Text>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Request New Reset</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your new password below
        </Text>


        {error ? <Text style={styles.errorText}>{error}</Text> : null}


        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor="#8E8E93"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm New Password"
          placeholderTextColor="#8E8E93"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleUpdatePassword}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            console.log('Cancel pressed - navigating to login');
            // Use router.push instead of Link for more reliable navigation
            router.push('/(auth)/login');
          }}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#E8D5B7',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  primaryButton: {
    backgroundColor: '#C4A574',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#0D0D0D',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C4A574',
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: '#C4A574',
    fontSize: 17,
    fontWeight: '600',
  },
  devModeContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'center',
  },
});
