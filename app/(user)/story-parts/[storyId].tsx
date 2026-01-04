import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StoryPart {
  id: string;
  content: string;
  is_start: boolean;
  is_ending: boolean;
  created_at: string;
}

interface Story {
  id: string;
  title: string;
  description: string;
  author_id: string;
  is_published: boolean;
  submitted_at?: string;
  story_parts?: StoryPart[];
}

export default function StoryPartsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { storyId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [addPartModalVisible, setAddPartModalVisible] = useState(false);
  const [partContent, setPartContent] = useState('');
  const [isStartingScene, setIsStartingScene] = useState(false);
  const [isFirstPart, setIsFirstPart] = useState(false);

  const loadStory = useCallback(async () => {
    if (!storyId || !user?.id) return;

    try {
      setLoading(true);

      // Load story with parts
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select(`
          *,
          story_parts(*)
        `)
        .eq('id', storyId)
        .eq('author_id', user.id)
        .single();

      if (storyError) throw storyError;

      setStory(storyData);
    } catch (error) {
      console.error('Error loading story:', error);
      Alert.alert('Error', 'Failed to load story');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [storyId, user?.id]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  const handleAddPart = () => {
    setPartContent('');
    // Automatically set as starting scene if this is the first part
    const hasNoParts = !story?.story_parts || story.story_parts.length === 0;
    setIsFirstPart(hasNoParts);
    setIsStartingScene(hasNoParts);
    setAddPartModalVisible(true);
  };

  const handleSavePart = async () => {
    if (!story || !partContent.trim()) {
      Alert.alert('Error', 'Please enter content for the story part');
      return;
    }

    // If marking as starting scene, check if another part is already starting
    if (isStartingScene && story.story_parts?.some(part => part.is_start)) {
      Alert.alert('Error', 'Only one part can be marked as the starting scene');
      return;
    }

    try {
      const { error } = await supabase
        .from('story_parts')
        .insert({
          story_id: story.id,
          content: partContent.trim(),
          is_start: isStartingScene,
          is_ending: false,
          created_by: user?.id,
        });

      if (error) throw error;

      setAddPartModalVisible(false);
      loadStory(); // Reload to show the new part
    } catch (error) {
      console.error('Error saving part:', error);
      Alert.alert('Error', 'Failed to save story part');
    }
  };

  const canSubmitForReview = () => {
    if (!story?.story_parts || story.story_parts.length === 0) return false;
    return story.story_parts.some(part => part.is_start);
  };

  const handleSubmitForReview = async () => {
    if (!story) return;

    if (!canSubmitForReview()) {
      Alert.alert('Cannot Submit', 'You must have at least one story part marked as the starting scene before submitting for review.');
      return;
    }

    try {
      const { error } = await supabase
        .from('stories')
        .update({
          submitted_at: new Date().toISOString()
        })
        .eq('id', story.id);

      if (error) throw error;

      Alert.alert(
        'Submitted for Review',
        'Your story has been submitted for admin review. You will be notified once it\'s published.',
        [
          {
            text: 'Back to Stories',
            onPress: () => router.replace('../(tabs)/stories' as any)
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting for review:', error);
      Alert.alert('Error', 'Failed to submit for review');
    }
  };

  const renderStoryPart = ({ item }: { item: StoryPart }) => (
    <View style={styles.partCard}>
      <View style={styles.partHeader}>
        <Text style={styles.partContent} numberOfLines={2}>
          {item.content}
        </Text>
        {item.is_start && (
          <View style={styles.startBadge}>
            <Text style={styles.startBadgeText}>Starting Scene</Text>
          </View>
        )}
      </View>
      <Text style={styles.partDate}>
        Created {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
        <Text style={styles.loadingText}>Loading story...</Text>
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Story not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#C4A574" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{story.title}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Story Parts</Text>

        {(!story.story_parts || story.story_parts.length === 0) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No story parts yet</Text>
            <Text style={styles.emptyText}>
              Add your first story part to begin building your interactive story.
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={handleAddPart}>
              <IconSymbol name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add First Part</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={story.story_parts}
              renderItem={renderStoryPart}
              keyExtractor={(item) => item.id}
              style={styles.partsList}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.addButton} onPress={handleAddPart}>
                <IconSymbol name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Part</Text>
              </TouchableOpacity>

              {canSubmitForReview() && (
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmitForReview}>
                  <IconSymbol name="paperplane" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Submit for Review</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      {/* Add Part Modal */}
      <Modal
        visible={addPartModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAddPartModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Story Part</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={styles.contentInput}
                value={partContent}
                onChangeText={setPartContent}
                placeholder="Enter the scene content..."
                placeholderTextColor="#8E8E93"
                multiline={true}
                numberOfLines={8}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, isFirstPart && styles.checkboxDisabled]}
                onPress={() => !isFirstPart && setIsStartingScene(!isStartingScene)}
                disabled={isFirstPart}
              >
                {isStartingScene && <IconSymbol name="checkmark" size={16} color="#C4A574" />}
              </TouchableOpacity>
              <Text style={[styles.checkboxLabel, isFirstPart && styles.checkboxLabelDisabled]}>
                Mark as Starting Scene {isFirstPart && '(Auto-set for first part)'}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAddPartModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSavePart}
              >
                <Text style={styles.saveButtonText}>Save Part</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  loadingText: {
    color: '#C4A574',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#C4A574',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C4A574',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C4A574',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  partsList: {
    flex: 1,
  },
  partCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  partHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  partContent: {
    flex: 1,
    fontSize: 16,
    color: '#E8D5B7',
    lineHeight: 22,
  },
  startBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  startBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  partDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actionButtons: {
    marginTop: 20,
    marginBottom: 40, // Extra margin for mobile navigation
    gap: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 8,
  },
  contentInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#C4A574',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxDisabled: {
    backgroundColor: '#2C2C2E',
    opacity: 0.7,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#E8D5B7',
  },
  checkboxLabelDisabled: {
    color: '#8E8E93',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#2C2C2E',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#C4A574',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
