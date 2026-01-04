import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoryCreateScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Navigate to stories list after creation - simplified flow
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a story title');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a story description');
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

      // Note: Part creation moved to user interface
      // Users can add parts through the "Add Part" button after story creation
      console.log('Story created successfully:', data.id, 'user can add parts via UI');

      // Navigate to story parts management page
      router.replace(`../story-parts/${data.id}` as any);
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
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <IconSymbol name="chevron.left" size={24} color="#C4A574" />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Story</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Create Your Story</Text>
          <Text style={styles.instructionsText}>
            Fill out the basic information for your story. Once submitted, your story will be automatically initialized with a starting part, and you can add more content later. An admin will review your story and add interactive choices to make it playable.
          </Text>
        </View>

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
                <Text style={styles.saveButtonText}>Save & Continue</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  instructions: {
    backgroundColor: '#2C2C2E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#C4A574',
    lineHeight: 20,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100, // Extra padding for keyboard
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
