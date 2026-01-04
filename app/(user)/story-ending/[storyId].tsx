import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { Story, StoryRating } from '@/src/types/stories';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function StoryEndingScreen() {
  const { storyId, preview } = useLocalSearchParams<{ storyId: string; preview?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const isPreview = preview === 'true';

  const [story, setStory] = useState<Story | null>(null);
  const [existingRating, setExistingRating] = useState<StoryRating | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (storyId && user) {
      loadStoryAndRating();
    }
  }, [storyId, user]);

  const loadStoryAndRating = useCallback(async () => {
    if (!storyId || !user?.id) return;
    try {
      setLoading(true);

      // Load story
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (storyError) throw storyError;

      // Load existing rating if any
      const { data: ratingData, error: ratingError } = await supabase
        .from('story_ratings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      if (ratingError && ratingError.code !== 'PGRST116') {
        throw ratingError;
      }

      setStory(storyData);
      if (ratingData) {
        setExistingRating(ratingData);
        setSelectedRating(ratingData.rating);
      }
    } catch (error) {
      console.error('Error loading story and rating:', error);
      Alert.alert('Error', 'Failed to load story details');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [storyId, user?.id]);

  useEffect(() => {
    if (storyId && user) {
      loadStoryAndRating();
    }
  }, [storyId, user, loadStoryAndRating]);

  const handleRatingPress = (rating: number) => {
    setSelectedRating(rating);
  };

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      const ratingData = {
        user_id: user?.id,
        story_id: storyId,
        rating: selectedRating,
      };

      // Skip saving ratings and progress in preview mode
      if (!isPreview) {
        if (existingRating) {
          // Update existing rating
          const { error } = await supabase
            .from('story_ratings')
            .update(ratingData)
            .eq('id', existingRating.id);

          if (error) throw error;
        } else {
          // Create new rating
          const { error } = await supabase
            .from('story_ratings')
            .insert([ratingData]);

          if (error) throw error;
        }

        // Mark story as completed in progress
        const { error: progressError } = await supabase
          .from('story_progress')
          .update({
            completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user?.id)
          .eq('story_id', storyId);

        if (progressError) throw progressError;
      }

      Alert.alert(
        isPreview ? 'Preview Complete' : 'Thank You!',
        isPreview
          ? 'You have completed the story preview.'
          : 'Your rating has been saved. Thank you for reading!',
        [
          {
            text: isPreview ? 'Back to Editor' : 'Back to Stories',
            onPress: () => router.replace(
              isPreview
                ? `../../story-create/${storyId}/edit` as any
                : '(tabs)/stories' as any
            )
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipRating = () => {
    const skipMessage = isPreview
      ? 'Are you sure you want to exit the preview?'
      : 'Are you sure you want to skip rating this story?';

    Alert.alert(
      isPreview ? 'Exit Preview?' : 'Skip Rating?',
      skipMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isPreview ? 'Exit' : 'Skip',
          onPress: async () => {
            if (!isPreview) {
              try {
                // Just mark as completed
                const { error } = await supabase
                  .from('story_progress')
                  .update({
                    completed: true,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', user?.id)
                  .eq('story_id', storyId);

                if (error) throw error;
              } catch (error) {
                console.error('Error marking story complete:', error);
                Alert.alert('Error', 'Failed to complete story. Please try again.');
                return;
              }
            }

            router.replace(
              isPreview
                ? `../../story-create/${storyId}/edit` as any
                : '(tabs)/stories' as any
            );
          }
        }
      ]
    );
  };

  const renderStars = (interactive: boolean = false) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={interactive ? () => handleRatingPress(star) : undefined}
            disabled={!interactive}
            style={styles.starButton}
          >
            <IconSymbol
              name={star <= selectedRating ? "star.fill" : "star"}
              size={interactive ? 40 : 32}
              color={star <= selectedRating ? "#FFD700" : "#8E8E93"}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!story) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Story not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Completion Message */}
        <View style={styles.completionContainer}>
          <IconSymbol name="checkmark.circle.fill" size={80} color="#4CAF50" />
          <Text style={styles.completionTitle}>Congratulations!</Text>
          <Text style={styles.completionText}>
            You have completed &ldquo;{story.title}&rdquo;
          </Text>
          <Text style={styles.completionSubtext}>
            Your choices shaped this unique story experience.
          </Text>
        </View>

        {/* Rating Section */}
        {!isPreview && (
          <View style={styles.ratingSection}>
            <Text style={styles.ratingTitle}>Rate This Story</Text>
            <Text style={styles.ratingSubtitle}>
              Help other readers discover great stories
            </Text>

          {renderStars(true)}

            <Text style={styles.ratingLabels}>
              {selectedRating === 1 && "Poor"}
              {selectedRating === 2 && "Fair"}
              {selectedRating === 3 && "Good"}
              {selectedRating === 4 && "Very Good"}
              {selectedRating === 5 && "Excellent"}
            </Text>
          </View>
        )}


        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {!isPreview ? (
            <>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  selectedRating === 0 && styles.submitButtonDisabled
                ]}
                onPress={handleSubmitRating}
                disabled={submitting || selectedRating === 0}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <IconSymbol name="star.fill" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>
                      {existingRating ? 'Update Rating' : 'Submit Rating'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipRating}
                disabled={submitting}
              >
                <Text style={styles.skipButtonText}>Skip Rating</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => router.replace(`/story-create/${storyId}/edit` as any)}
            >
              <IconSymbol name="pencil" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Back to Editor</Text>
            </TouchableOpacity>
          )}
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
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  completionContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  completionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  completionText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#E8D5B7',
    textAlign: 'center',
    marginBottom: 8,
  },
  completionSubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
  ratingSection: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8D5B7',
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingLabels: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFD700',
    textAlign: 'center',
  },
  feedbackSection: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 16,
  },
  feedbackInput: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 16,
    color: '#E8D5B7',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 8,
  },
  actionsContainer: {
    gap: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C4A574',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#8E8E93',
    fontSize: 16,
  },
});
