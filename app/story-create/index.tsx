import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function StoryCreateScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a story title');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to create a story');
      return;
    }

    try {
      setSaving(true);

      const storyData = {
        title: title.trim(),
        description: description.trim() || null,
        cover_image: coverImage.trim() || null,
        author_id: user.id,
        is_published: false,
        genre: tags.trim() || null,
      };

      const { data, error } = await supabase
        .from('stories')
        .insert([storyData])
        .select()
        .single();

      if (error) throw error;

      // Navigate to story builder
      router.replace(`${data.id}/edit` as any);
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert('Error', 'Failed to create story. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to cancel? Your changes will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', onPress: () => router.back() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <IconSymbol name="chevron.left" size={24} color="#C4A574" />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Story Title *</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter your story title"
            placeholderTextColor="#8E8E93"
            maxLength={100}
          />
          <Text style={styles.characterCount}>{title.length}/100</Text>
        </View>

        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your story (optional)"
            placeholderTextColor="#8E8E93"
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.characterCount}>{description.length}/500</Text>
        </View>

        {/* Cover Image Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cover Image URL (Optional)</Text>
          <TextInput
            style={styles.input}
            value={coverImage}
            onChangeText={setCoverImage}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor="#8E8E93"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helpText}>
            Provide a URL to an image for your story cover
          </Text>
        </View>

        {/* Tags/Genre Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Genre/Tags (Optional)</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="Fantasy, Mystery, Adventure..."
            placeholderTextColor="#8E8E93"
            maxLength={100}
          />
          <Text style={styles.helpText}>
            Separate multiple genres with commas
          </Text>
        </View>

        {/* Preview */}
        {title && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewCover}>
                {coverImage ? (
                  <Text style={styles.previewCoverText}>📖</Text>
                ) : (
                  <IconSymbol name="book.fill" size={40} color="#8E8E93" />
                )}
              </View>
              <View style={styles.previewContent}>
                <Text style={styles.previewStoryTitle} numberOfLines={1}>
                  {title}
                </Text>
                {description && (
                  <Text style={styles.previewDescription} numberOfLines={2}>
                    {description}
                  </Text>
                )}
                <View style={styles.previewFooter}>
                  <Text style={styles.previewAuthor}>by {user?.user_metadata?.name || 'You'}</Text>
                  {tags && (
                    <Text style={styles.previewGenre}>{tags}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Save Button */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveButton, (!title.trim() || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Create Story</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backText: {
    color: '#C4A574',
    fontSize: 16,
    marginLeft: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
  },
  headerRight: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 16,
    color: '#E8D5B7',
    fontSize: 18,
    fontWeight: '600',
  },
  descriptionInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 16,
    color: '#E8D5B7',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 16,
    color: '#E8D5B7',
    fontSize: 16,
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    lineHeight: 20,
  },
  previewSection: {
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  previewCover: {
    width: 80,
    height: 80,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCoverText: {
    fontSize: 24,
  },
  previewContent: {
    flex: 1,
    padding: 12,
  },
  previewStoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 8,
  },
  previewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewAuthor: {
    fontSize: 12,
    color: '#8E8E93',
  },
  previewGenre: {
    fontSize: 12,
    color: '#C4A574',
    backgroundColor: '#3A3A3C',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  actions: {
    marginBottom: 40,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C4A574',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
