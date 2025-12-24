import { useAuth } from '@/src/context/AuthContext';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AdminProfileScreen() {
  const { profile, signOut } = useAuth();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.name || 'A')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{profile?.name}</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>Administrator</Text>
        </View>
        <Text style={styles.userEmail}>{profile?.email || 'No email'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{profile?.name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={[styles.infoValue, styles.adminText]}>Admin</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member since</Text>
            <Text style={styles.infoValue}>
              {profile?.created_at ? formatDate(profile.created_at) : 'Unknown'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.infoCard}>
          <TouchableOpacity style={styles.settingRow}>
            <Text style={styles.settingText}>Notifications</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <Text style={styles.settingText}>Security</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <Text style={styles.settingText}>Privacy</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <Text style={styles.settingText}>Help & Support</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C4A574',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adminBadge: {
    backgroundColor: '#C4A574',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  adminBadgeText: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  infoLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  infoValue: {
    fontSize: 16,
    color: '#8E8E93',
  },
  adminText: {
    color: '#C4A574',
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginHorizontal: 16,
  },
  settingRow: {
    padding: 16,
  },
  settingText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  signOutButton: {
    marginHorizontal: 24,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    alignItems: 'center',
  },
  signOutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
});

