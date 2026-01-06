import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function UserHome() {
  const { profile } = useAuth();
  const router = useRouter();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.userName}>{profile?.name || 'User'}</Text>
      </View>

      {/* Welcome Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroIconContainer}>
          <Text style={styles.heroIcon}>📖</Text>
        </View>
        <Text style={styles.heroTitle}>Welcome to TaleForge</Text>
        <Text style={styles.heroSubtitle}>
          Your creative space for sharing stories, ideas, and connecting with fellow creators.
        </Text>
      </View>

      {/* Feature Cards */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>What You Can Do</Text>
        
        <View style={styles.featureCard}>
          <View style={styles.featureIconWrapper}>
            <Text style={styles.featureIcon}>🎭</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Interactive Stories</Text>
            <Text style={styles.featureDescription}>
              Immerse yourself in choose-your-own-adventure stories with branching paths, multiple endings, and interactive choices that shape your narrative journey.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconWrapper}>
            <Text style={styles.featureIcon}>✍️</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Share Your Thoughts</Text>
            <Text style={styles.featureDescription}>
              Post updates, share your creative work, and express yourself through text-based posts on the Board.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconWrapper}>
            <Text style={styles.featureIcon}>💬</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Join Discussions</Text>
            <Text style={styles.featureDescription}>
              Engage with posts from other users and admins. React to content you love and be part of the community.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconWrapper}>
            <Text style={styles.featureIcon}>🌟</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Real-Time Updates</Text>
            <Text style={styles.featureDescription}>
              See new posts appear instantly without refreshing. Stay connected with the latest content as it happens.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconWrapper}>
            <Text style={styles.featureIcon}>👤</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Your Profile</Text>
            <Text style={styles.featureDescription}>
              Manage your account settings and view your posting history all in one place.
            </Text>
          </View>
        </View>
      </View>

      {/* Call to Action */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Ready to start?</Text>
        <Text style={styles.ctaDescription}>
          Choose your adventure: explore interactive stories or join the community on the Board!
        </Text>
        <View style={styles.ctaButtonsContainer}>
          <TouchableOpacity
            style={[styles.ctaButton, styles.ctaButtonSecondary]}
            onPress={() => router.push('/(user)/(tabs)/stories')}>
            <Text style={styles.featureIcon}>🎭</Text>
            <Text style={styles.ctaButtonTextSecondary}>Explore Stories</Text>
            <Text style={styles.ctaButtonIconSecondary}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(user)/(tabs)/board')}>
            <Text style={styles.featureIcon}>📝</Text>
            <Text style={styles.ctaButtonText}>Visit Board</Text>
            <Text style={styles.ctaButtonIcon}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Info */}
      <View style={styles.footerSection}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>
          Posts are visible to all users. Be kind and respectful in your interactions.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  greeting: {
    fontSize: 16,
    color: '#8E8E93',
  },
  userName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8D5B7',
    marginTop: 4,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    marginHorizontal: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(196, 165, 116, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    fontSize: 40,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  featuresSection: {
    padding: 24,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  featureIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(196, 165, 116, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  ctaSection: {
    marginHorizontal: 16,
    padding: 24,
    backgroundColor: 'rgba(196, 165, 116, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(196, 165, 116, 0.2)',
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E8D5B7',
    marginBottom: 8,
  },
  ctaDescription: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  ctaButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  ctaButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#C4A574',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonSecondary: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#C4A574',
  },
  ctaButtonText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  ctaButtonTextSecondary: {
    color: '#C4A574',
    fontSize: 15,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  ctaButtonIconSecondary: {
    color: '#C4A574',
    fontSize: 16,
    fontWeight: '600',
  },
  ctaButtonIcon: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '600',
  },
  footerSection: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerDivider: {
    width: 60,
    height: 3,
    backgroundColor: '#2C2C2E',
    borderRadius: 2,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 13,
    color: '#6E6E73',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
