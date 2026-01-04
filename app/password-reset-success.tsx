import { Link } from 'expo-router';
import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function PasswordResetSuccessScreen() {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.successIcon}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.title}>Password Updated!</Text>
        <Text style={styles.subtitle}>
          Your password has been successfully updated.{'\n'}
          You can now log in with your new password.
        </Text>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Continue to Login</Text>
          </TouchableOpacity>
        </Link>
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
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C4A574',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 40,
    color: '#0D0D0D',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8D5B7',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: '#C4A574',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0D0D0D',
    fontSize: 17,
    fontWeight: '600',
  },
});
