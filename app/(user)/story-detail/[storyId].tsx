import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { StoryWithProgress } from '@/src/types/stories';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoryDetailScreen() {
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [story, setStory] = useState<StoryWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (storyId && user) {
      loadStoryDetails();
    }
  }, [storyId, user]);

  const loadStoryDetails = useCallback(async () => {
    if (!storyId || !user?.id) return;
    try {
      setLoading(true);

      // Fetch story with author info and parts
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select(`
          *,
          users!author_id(name),
          story_parts(*)
        `)
        .eq('id', storyId)
        .or(`is_published.eq.true,author_id.eq.${user.id}`)
        .single();

      if (storyError) throw storyError;

      // Get user progress
      const { data: progressData } = await supabase
        .from('story_progress')
        .select('*')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      // Get user's rating if exists
      const { data: ratingData } = await supabase
        .from('story_ratings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      // Get average rating
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('story_ratings')
        .select('rating')
        .eq('story_id', storyId);

      if (ratingsError) throw ratingsError;

      const averageRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
        : undefined;

      const storyWithDetails: StoryWithProgress = {
        ...storyData,
        author_name: storyData.users?.name || 'Anonymous',
        average_rating: averageRating,
        total_ratings: ratingsData?.length || 0,
        progress: progressData || undefined,
        user_rating: ratingData || undefined,
      };

      setStory(storyWithDetails);
    } catch (error) {
      console.error('Error loading story details:', error);
      Alert.alert('Error', 'Failed to load story details');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [storyId, user?.id]);

  useEffect(() => {
    if (storyId && user) {
      loadStoryDetails();
    }
  }, [storyId, user, loadStoryDetails]);

  const handleStartStory = () => {
    router.push(`../story-reading/${storyId}` as any);
  };

  const handleResumeStory = () => {
    router.push(`../story-reading/${storyId}` as any);
  };

  const handleReadAgain = async () => {
    // Reset progress to start from beginning
    try {
      await supabase
        .from('story_progress')
        .update({
          current_part_id: null,
          completed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user?.id)
        .eq('story_id', storyId);

      // Navigate to start reading
      router.push(`../story-reading/${storyId}` as any);
    } catch (error) {
      console.error('Error resetting story progress:', error);
      Alert.alert('Error', 'Failed to restart story');
    }
  };

  const handleSubmitForReview = async () => {
    try {
      const { error } = await supabase
        .from('stories')
        .update({
          submitted_at: new Date().toISOString()
        })
        .eq('id', storyId);

      if (error) throw error;

      Alert.alert('Submitted!', 'Your story has been submitted for admin review.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error submitting story:', error);
      Alert.alert('Error', 'Failed to submit story for review');
    }
  };

  const handleSaveEdit = async () => {
    if (!story || savingEdit) return;

    if (!editTitle.trim()) {
      Alert.alert('Error', 'Please enter a story title');
      return;
    }

    try {
      setSavingEdit(true);

      const updates: { [key: string]: any } = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        genre: editGenre.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', story.id)
        .eq('author_id', user?.id);

      if (error) throw error;

      // Reload story data
      loadStoryDetails();
      setEditModalVisible(false);
      Alert.alert('Success', 'Story updated successfully');
    } catch (error) {
      console.error('Error updating story:', error);
      Alert.alert('Error', 'Failed to update story');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePreviewStory = () => {
    // Check if story has any parts before allowing preview
    if (!story.story_parts || story.story_parts.length === 0) {
      Alert.alert(
        'No Content Yet',
        'This story doesn\'t have any content yet. Would you like to add some content now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Content',
            onPress: () => {
              // Redirect directly to the Add Part page for this story
              router.push(`../story-parts/${storyId}` as any);
            }
          }
        ]
      );
    } else {
      router.push(`../story-reading/${storyId}?preview=true` as any);
    }
  };

  const handleDeleteStory = () => {
    Alert.alert(
      'Delete Story',
      `Are you sure you want to delete "${story.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('stories')
                .delete()
                .eq('id', story.id)
                .eq('author_id', user?.id);

              if (error) throw error;

              Alert.alert('Success', 'Story deleted successfully', [
                { text: 'OK', onPress: () => router.replace('../(tabs)/stories' as any) }
              ]);
            } catch (error) {
              console.error('Error deleting story:', error);
              Alert.alert('Error', 'Failed to delete story');
            }
          }
        }
      ]
    );
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <IconSymbol
            key={star}
            name={star <= rating ? "star.fill" : "star"}
            size={size}
            color={star <= rating ? "#FFD700" : "#8E8E93"}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
        <Text style={styles.loadingText}>Loading story details...</Text>
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Story not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{story.title}</Text>

          <View style={styles.metaContainer}>
            <Text style={styles.author}>by {story.author_name}</Text>

            {story.average_rating && (
              <View style={styles.ratingContainer}>
                {renderStars(Math.round(story.average_rating))}
                <Text style={styles.ratingText}>
                  {story.average_rating.toFixed(1)} ({story.total_ratings} reviews)
                </Text>
              </View>
            )}

            {story.estimated_duration && (
              <View style={styles.durationContainer}>
                <IconSymbol name="clock" size={14} color="#8E8E93" />
                <Text style={styles.durationText}>
                  ~{story.estimated_duration} min read
                </Text>
              </View>
            )}
          </View>
        </View>

        {story.description && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summaryText}>{story.description}</Text>
          </View>
        )}

        {story.genre && (
          <View style={styles.genreSection}>
            <Text style={styles.genreLabel}>Genre:</Text>
            <Text style={styles.genreText}>{story.genre}</Text>
          </View>
        )}

        {/* Progress Section */}
        {story.progress && (
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Your Progress</Text>
            <View style={styles.progressInfo}>
              <IconSymbol name="bookmark.fill" size={20} color="#C4A574" />
              <Text style={styles.progressText}>
                {story.progress.completed ? 'Completed' : 'In Progress'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {story.author_id === user?.id ? (
            // Creator view - show edit and publish options
            <View style={styles.creatorActions}>
              <TouchableOpacity
                style={[styles.creatorButton, styles.editButton]}
                onPress={() => {
                  setEditTitle(story.title);
                  setEditDescription(story.description || '');
                  setEditGenre(story.genre || '');
                  setEditModalVisible(true);
                }}
              >
                <IconSymbol name="pencil" size={20} color="#FFFFFF" />
                <Text style={styles.creatorButtonText} numberOfLines={1}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.creatorButton, styles.addPartButton]}
                onPress={() => router.push(`../story-parts/${storyId}` as any)}
              >
                <IconSymbol name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.creatorButtonText} numberOfLines={1}>Add Part</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.creatorButton, styles.previewButton]}
                onPress={() => handlePreviewStory()}
              >
                <IconSymbol name="eye" size={20} color="#FFFFFF" />
                <Text style={styles.creatorButtonText} numberOfLines={1}>Preview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.creatorButton, styles.deleteButton]}
                onPress={() => handleDeleteStory()}
              >
                <IconSymbol name="trash" size={20} color="#FFFFFF" />
                <Text style={styles.creatorButtonText} numberOfLines={1}>Delete</Text>
              </TouchableOpacity>

              {!story.is_published && !story.submitted_at && (
                <TouchableOpacity
                  style={[styles.creatorButton, styles.publishButton]}
                  onPress={handleSubmitForReview}
                >
                  <IconSymbol name="paperplane" size={20} color="#FFFFFF" />
                  <Text style={styles.creatorButtonText} numberOfLines={1}>Submit for Review</Text>
                </TouchableOpacity>
              )}

              {!story.is_published && story.submitted_at && (
                <View style={[styles.creatorButton, styles.pendingButton]}>
                  <IconSymbol name="clock" size={20} color="#FFFFFF" />
                  <Text style={styles.creatorButtonText} numberOfLines={1}>Under Review</Text>
                </View>
              )}

              {story.is_published && (
                <View style={[styles.creatorButton, styles.publishedButton]}>
                  <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.creatorButtonText} numberOfLines={1}>Published</Text>
                </View>
              )}
            </View>
          ) : (
            // Reader view - show start/resume/read again
            <TouchableOpacity
              style={[
                styles.actionButton,
                story.progress?.completed ? styles.restartButton :
                story.progress ? styles.resumeButton : styles.startButton
              ]}
              onPress={
                story.progress?.completed ? handleReadAgain :
                story.progress ? handleResumeStory : handleStartStory
              }
            >
              <IconSymbol
                name={
                  story.progress?.completed ? "arrow.clockwise" :
                  story.progress ? "play.fill" : "play.fill"
                }
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.actionButtonText}>
                {story.progress?.completed ? 'Read Again' :
                 story.progress ? 'Resume Story' : 'Start Story'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>

    {/* Edit Story Modal */}
    <Modal
      visible={editModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Story</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Enter story title..."
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.modalTextInput, { height: 80, textAlignVertical: 'top' }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Enter story description..."
              placeholderTextColor="#8E8E93"
              multiline={true}
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Genre</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editGenre}
              onChangeText={setEditGenre}
              placeholder="Fantasy, Mystery, Adventure..."
              placeholderTextColor="#8E8E93"
            />
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, savingEdit && styles.disabledButton]}
              onPress={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  loadingText: {
    color: '#E8D5B7',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#E8D5B7',
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#C4A574',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  scrollContent: {
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E8D5B7',
    marginBottom: 12,
    lineHeight: 34,
  },
  metaContainer: {
    gap: 8,
  },
  author: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  ratingText: {
    fontSize: 14,
    color: '#FFD700',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  summarySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    color: '#E8D5B7',
    lineHeight: 24,
  },
  genreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  genreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
  },
  genreText: {
    fontSize: 16,
    color: '#C4A574',
    backgroundColor: '#2C2C2E',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 16,
    color: '#C4A574',
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },
  startButton: {
    backgroundColor: '#C4A574',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  restartButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  creatorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  creatorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    minWidth: 80,
    flexShrink: 0,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  previewButton: {
    backgroundColor: '#9C27B0',
  },
  addPartButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  publishButton: {
    backgroundColor: '#4CAF50',
  },
  pendingButton: {
    backgroundColor: '#2196F3',
  },
  publishedButton: {
    backgroundColor: '#4CAF50',
  },
  creatorButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
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
  modalTextInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 40,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  disabledButton: {
    opacity: 0.6,
  },
});
