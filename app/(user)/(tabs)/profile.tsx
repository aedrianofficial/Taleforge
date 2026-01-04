import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type UserStats = {
  totalPosts: number;
  totalReactions: number;
  totalRatings: number;
  averageRating: number;
};

export default function ProfileScreen() {
  const { profile, signOut, updateProfile, refreshProfile } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalPosts: 0,
    totalReactions: 0,
    totalRatings: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [postsVisible, setPostsVisible] = useState(true);
  
  // Modal states
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  
  // Edit name state
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  
  // Contact form state
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const toastOpacity = useState(new Animated.Value(0))[0];

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast({ message: '', visible: false }));
  }, [toastOpacity]);

  useEffect(() => {
    if (profile) {
      setNotificationsEnabled(profile.notifications_enabled ?? true);
      setPostsVisible(profile.privacy_posts_visible ?? true);
      setNewName(profile.name || '');
      fetchUserStats();
    }
  }, [profile]);

  const fetchUserStats = async () => {
    if (!profile?.id) return;

    try {
      // Get user's posts count
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);

      // Get reactions received on user's posts
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', profile.id);

      let totalReactions = 0;
      let totalRatings = 0;
      let avgRating = 0;

      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map(p => p.id);

        // Get reactions count
        const { count: reactionsCount } = await supabase
          .from('post_reactions')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds);

        totalReactions = reactionsCount || 0;

        // Get ratings
        const { data: ratingsData } = await supabase
          .from('post_ratings')
          .select('rating')
          .in('post_id', postIds);

        if (ratingsData && ratingsData.length > 0) {
          totalRatings = ratingsData.length;
          const sum = ratingsData.reduce((acc, r) => acc + r.rating, 0);
          avgRating = sum / ratingsData.length;
        }
      }

      setStats({
        totalPosts: postsCount || 0,
        totalReactions,
        totalRatings,
        averageRating: avgRating,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!profile?.id) return;

    setUploading(true);
    try {
      const fileName = `avatar-${profile.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Read file as base64 using expo-file-system (works reliably in React Native)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Convert base64 to binary data
      const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      
      // Upload the binary data
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, binary, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await updateProfile({ avatar_url: publicUrl });
      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }
      
      // Refresh profile to get updated avatar
      await refreshProfile();
      showToast('Profile picture updated!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      const errorMessage = error?.message || error?.error || 'Unknown error occurred';
      
      // Check if it's a bucket not found error
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('bucket')) {
        Alert.alert(
          'Storage Not Configured',
          'The avatars storage bucket does not exist. Please create an "avatars" bucket in your Supabase project Storage settings with public access enabled.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage.includes('permission') || errorMessage.includes('policies')) {
        Alert.alert(
          'Permission Error',
          'Storage access denied. Please enable public access for the avatars bucket in Supabase Storage settings.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage.includes('Network') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
        Alert.alert(
          'Network Error',
          'Unable to connect to storage. Please check:\n\n1. Your internet connection\n2. Supabase project is active\n3. Storage URL is correct',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => uploadAvatar(uri) }
          ]
        );
      } else {
        Alert.alert(
          'Upload Failed',
          `Failed to upload profile picture: ${errorMessage}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => uploadAvatar(uri) }
          ]
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    if (newName.trim() === profile?.name) {
      setEditNameModalVisible(false);
      return;
    }

    setSavingName(true);
    const { error } = await updateProfile({ name: newName.trim() });
    setSavingName(false);

    if (error) {
      Alert.alert('Error', 'Failed to update name');
    } else {
      showToast('Name updated successfully!');
      setEditNameModalVisible(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    const { error } = await updateProfile({ notifications_enabled: value });
    if (error) {
      setNotificationsEnabled(!value);
      Alert.alert('Error', 'Failed to update notification settings');
    } else {
      showToast(value ? 'Notifications enabled' : 'Notifications disabled');
    }
  };

  const handlePostsVisibilityToggle = async (value: boolean) => {
    setPostsVisible(value);
    const { error } = await updateProfile({ privacy_posts_visible: value });
    if (error) {
      setPostsVisible(!value);
      Alert.alert('Error', 'Failed to update privacy settings');
    } else {
      showToast('Privacy settings updated');
    }
  };

  const handleSendMessage = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setSendingMessage(true);
    
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert([{
          user_id: profile.id,
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
          status: 'pending',
        }]);

      if (error) throw error;

      setContactSubject('');
      setContactMessage('');
      setContactModalVisible(false);
      showToast('Message sent successfully!');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  // Edit Name Modal
  const renderEditNameModal = () => (
    <Modal visible={editNameModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setEditNameModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>✏️ Edit Name</Text>
          <Text style={styles.modalDescription}>
            Update your display name
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#6E6E73"
            value={newName}
            onChangeText={setNewName}
            maxLength={50}
            autoFocus
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setNewName(profile?.name || '');
                setEditNameModalVisible(false);
              }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, (!newName.trim() || savingName) && styles.sendButtonDisabled]}
              onPress={handleSaveName}
              disabled={!newName.trim() || savingName}>
              {savingName ? (
                <ActivityIndicator size="small" color="#0D0D0D" />
              ) : (
                <Text style={styles.sendButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Notifications Modal
  const renderNotificationsModal = () => (
    <Modal visible={notificationsModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setNotificationsModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>🔔 Notifications</Text>
          <Text style={styles.modalDescription}>
            Control how you receive updates about new posts and reactions.
          </Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingHint}>Get notified about new activity</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#3A3A3C', true: 'rgba(196, 165, 116, 0.5)' }}
              thumbColor={notificationsEnabled ? '#C4A574' : '#8E8E93'}
            />
          </View>
          
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setNotificationsModalVisible(false)}>
            <Text style={styles.modalCloseText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Privacy Modal
  const renderPrivacyModal = () => (
    <Modal visible={privacyModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setPrivacyModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>🔒 Privacy</Text>
          <Text style={styles.modalDescription}>
            Control the visibility of your content.
          </Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Posts Visible</Text>
              <Text style={styles.settingHint}>Show your posts to others on the Board</Text>
            </View>
            <Switch
              value={postsVisible}
              onValueChange={handlePostsVisibilityToggle}
              trackColor={{ false: '#3A3A3C', true: 'rgba(196, 165, 116, 0.5)' }}
              thumbColor={postsVisible ? '#C4A574' : '#8E8E93'}
            />
          </View>
          
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setPrivacyModalVisible(false)}>
            <Text style={styles.modalCloseText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Help & Support Modal
  const renderHelpModal = () => (
    <Modal visible={helpModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setHelpModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>💬 Help & Support</Text>
          
          <View style={styles.faqSection}>
            <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do I create a post?</Text>
              <Text style={styles.faqAnswer}>Go to the Board tab and use the composer at the top to write and share your post.</Text>
            </View>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do reactions work?</Text>
              <Text style={styles.faqAnswer}>Tap on Like, Heart, or Laugh to react to a post. You can only have one reaction per post.</Text>
            </View>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>Can I edit my posts?</Text>
              <Text style={styles.faqAnswer}>Yes! Tap the three-dot menu on your post to edit or delete it.</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => {
              setHelpModalVisible(false);
              setContactModalVisible(true);
            }}>
            <Text style={styles.contactButtonText}>📧 Contact Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setHelpModalVisible(false)}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Contact Modal
  const renderContactModal = () => (
    <Modal visible={contactModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setContactModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>📧 Contact Support</Text>
          <Text style={styles.modalDescription}>
            Send us a message and we'll get back to you soon.
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor="#6E6E73"
            value={contactSubject}
            onChangeText={setContactSubject}
          />
          
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Your message..."
            placeholderTextColor="#6E6E73"
            value={contactMessage}
            onChangeText={setContactMessage}
            multiline
            textAlignVertical="top"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setContactModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, sendingMessage && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={sendingMessage}>
              {sendingMessage ? (
                <ActivityIndicator size="small" color="#0D0D0D" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // About Modal
  const renderAboutModal = () => (
    <Modal visible={aboutModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setAboutModalVisible(false)}>
        <Pressable style={styles.aboutModalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.aboutHeader}>
            <Text style={styles.aboutIcon}>📖</Text>
            <Text style={styles.aboutTitle}>TaleForge</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          </View>
          
          <View style={styles.aboutInfo}>
            <Text style={styles.aboutDescription}>
              A creative space for sharing stories, ideas, and connecting with fellow creators.
            </Text>
            
            <View style={styles.aboutDivider} />
            
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Developer</Text>
              <Text style={styles.aboutValue}>TaleForge Team</Text>
            </View>
            
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Built with</Text>
              <Text style={styles.aboutValue}>React Native & Supabase</Text>
            </View>
            
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Platform</Text>
              <Text style={styles.aboutValue}>{Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setAboutModalVisible(false)}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Toast Component
  const renderToast = () => (
    toast.visible && (
      <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
        <Text style={styles.toastText}>{toast.message}</Text>
      </Animated.View>
    )
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={uploading}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.name || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.avatarEditIcon}>📷</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{profile?.name}</Text>
        <Text style={styles.userEmail}>{profile?.email || 'Anonymous user'}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalPosts}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalReactions}</Text>
          <Text style={styles.statLabel}>Reactions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0'}</Text>
          <Text style={styles.statLabel}>Avg Rating</Text>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.infoRow} onPress={() => setEditNameModalVisible(true)}>
            <View style={styles.infoIcon}>
              <Text>👤</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{profile?.name}</Text>
            </View>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text>✉️</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile?.email || 'Not set'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text>📅</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {profile?.created_at ? formatDate(profile.created_at) : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingRow} onPress={() => setNotificationsModalVisible(true)}>
            <View style={styles.settingIcon}>
              <Text>🔔</Text>
            </View>
            <Text style={styles.settingText}>Notifications</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => setPrivacyModalVisible(true)}>
            <View style={styles.settingIcon}>
              <Text>🔒</Text>
            </View>
            <Text style={styles.settingText}>Privacy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => setHelpModalVisible(true)}>
            <View style={styles.settingIcon}>
              <Text>💬</Text>
            </View>
            <Text style={styles.settingText}>Help & Support</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => setAboutModalVisible(true)}>
            <View style={styles.settingIcon}>
              <Text>ℹ️</Text>
            </View>
            <Text style={styles.settingText}>About</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.footer} />

      {/* Modals */}
      {renderEditNameModal()}
      {renderNotificationsModal()}
      {renderPrivacyModal()}
      {renderHelpModal()}
      {renderContactModal()}
      {renderAboutModal()}
      {renderToast()}
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
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C4A574',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0D0D0D',
  },
  avatarEditIcon: {
    fontSize: 14,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#C4A574',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  editIcon: {
    fontSize: 16,
    color: '#8E8E93',
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginLeft: 64,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  chevron: {
    fontSize: 20,
    color: '#8E8E93',
  },
  signOutButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    alignItems: 'center',
  },
  signOutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    height: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  aboutModalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingHint: {
    fontSize: 13,
    color: '#8E8E93',
  },
  dividerModal: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 12,
  },
  modalCloseButton: {
    backgroundColor: '#C4A574',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#0D0D0D',
    fontWeight: '600',
  },
  faqSection: {
    marginBottom: 20,
  },
  faqTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  contactButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  contactButtonText: {
    fontSize: 16,
    color: '#C4A574',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
    maxHeight: 150,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#3A3A3C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#C4A574',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#3A3A3C',
  },
  sendButtonText: {
    fontSize: 16,
    color: '#0D0D0D',
    fontWeight: '600',
  },
  aboutHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  aboutIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aboutVersion: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  aboutInfo: {
    width: '100%',
  },
  aboutDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  aboutLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  aboutValue: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#30D158',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
