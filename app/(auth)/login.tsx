import { useAuth } from '@/src/context/AuthContext';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [anonymousName, setAnonymousName] = useState('');
  const [isAnonymousMode, setIsAnonymousMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, signInAnonymous } = useAuth();
  const router = useRouter();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);
    
    if (signInError) {
      setError(signInError.message);
    }
    
    setLoading(false);
  };

  const handleAnonymousLogin = async () => {
    if (!anonymousName.trim()) {
      setError('Please enter a name');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signInError } = await signInAnonymous(anonymousName.trim());
    
    if (signInError) {
      setError(signInError.message);
    }
    
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Taleforge</Text>
        <Text style={styles.subtitle}>
          {isAnonymousMode ? 'Quick Access' : 'Sign in to your account'}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isAnonymousMode ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#8E8E93"
              value={anonymousName}
              onChangeText={setAnonymousName}
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAnonymousLogin}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue as Guest</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setIsAnonymousMode(false);
                setError('');
              }}>
              <Text style={styles.secondaryButtonText}>Sign in with Email</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8E8E93"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#8E8E93"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <View style={styles.forgotPasswordContainer}>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleEmailLogin}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Create Account</Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => {
                setIsAnonymousMode(true);
                setError('');
              }}>
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
          </>
        )}
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
  guestButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  guestButtonText: {
    color: '#8E8E93',
    fontSize: 15,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#C4A574',
    fontSize: 14,
    fontWeight: '500',
  },
});

