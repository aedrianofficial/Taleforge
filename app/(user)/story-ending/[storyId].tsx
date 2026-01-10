import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { Story, StoryPathEntry, StoryRating } from '@/src/types/stories';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function StoryEndingScreen() {
  const { storyId, preview, path } = useLocalSearchParams<{ storyId: string; preview?: string; path?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const isPreview = preview === 'true';

  // Parse story path from URL parameter
  useEffect(() => {
    if (path) {
      try {
        const parsedPath = JSON.parse(decodeURIComponent(path));
        setStoryPath(parsedPath);
      } catch (error) {
        console.error('Error parsing story path:', error);
      }
    }
  }, [path]);

  const [story, setStory] = useState<Story | null>(null);
  const [existingRating, setExistingRating] = useState<StoryRating | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [storyPath, setStoryPath] = useState<StoryPathEntry[]>([]);
  const [comprehensionResponse, setComprehensionResponse] = useState<string>('');
  const [existingComprehensionResponse, setExistingComprehensionResponse] = useState<string | null>(null);
  const [fullStoryContent, setFullStoryContent] = useState<{[key: string]: string}>({});
  const [showFullStory, setShowFullStory] = useState<boolean>(false);
  const [loadingFullContent, setLoadingFullContent] = useState<boolean>(false);

  // Always use current story path for the journey display - this shows the user's current reading experience
  // The original story and choices remain in the database for records, but we show current session choices
  const displayStoryPath = React.useMemo(() => {
    return storyPath;
  }, [storyPath]);

  // Filter out duplicate parts to prevent duplication in display
  const uniqueStoryPath = React.useMemo(() => {
    const seen = new Set<string>();
    return displayStoryPath.filter(entry => {
      if (!entry.part_id || seen.has(entry.part_id)) {
        return false;
      }
      seen.add(entry.part_id);
      return true;
    });
  }, [displayStoryPath]);

  // Load full story content when story path is available
  useEffect(() => {
    if (displayStoryPath.length > 0 && !isPreview) {
      loadFullStoryContent();
    }
  }, [displayStoryPath, isPreview]);

  const loadFullStoryContent = async () => {
    if (displayStoryPath.length === 0) return;

    try {
      setLoadingFullContent(true);
      const partIds = displayStoryPath.map(entry => entry.part_id);

      const { data: parts, error } = await supabase
        .from('story_parts')
        .select('id, content')
        .in('id', partIds);

      if (error) throw error;

      const contentMap: {[key: string]: string} = {};
      parts?.forEach(part => {
        contentMap[part.id] = part.content;
      });

      setFullStoryContent(contentMap);
    } catch (error) {
      console.error('Error loading full story content:', error);
    } finally {
      setLoadingFullContent(false);
    }
  };

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

      // Load existing comprehension response and story path if any
      const { data: pathData, error: pathError } = await supabase
        .from('user_story_paths')
        .select('comprehension_response, story_path')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      if (pathError && pathError.code !== 'PGRST116') {
        throw pathError;
      }

      setStory(storyData);
      if (ratingData) {
        setExistingRating(ratingData);
        setSelectedRating(ratingData.rating);
      }
      if (pathData?.comprehension_response) {
        setExistingComprehensionResponse(pathData.comprehension_response);
        setComprehensionResponse(pathData.comprehension_response);
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
    // Validate rating selection
    if (selectedRating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    // Validate reflection field - required for non-preview mode
    if (!isPreview && !comprehensionResponse.trim()) {
      Alert.alert('Reflection Required', 'Please share your thoughts about the story before submitting.');
      return;
    }

    // Show confirmation dialog for non-preview mode
    if (!isPreview) {
      Alert.alert(
        'Confirm Your Reflection',
        `Are you sure about your reflection?\n\n"${comprehensionResponse.trim()}"\n\nThis cannot be changed after submission.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm & Submit',
            style: 'default',
            onPress: performSubmission
          }
        ]
      );
      return;
    }

    // For preview mode, proceed directly
    performSubmission();
  };

  const performSubmission = async () => {
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

        // Save story path and comprehension response
        const storyPathData = {
          user_id: user?.id,
          story_id: storyId,
          story_path: storyPath,
          comprehension_response: comprehensionResponse.trim() || null,
        };

        const { error: pathError } = await supabase
          .from('user_story_paths')
          .upsert(storyPathData, {
            onConflict: 'user_id,story_id'
          });

        if (pathError) throw pathError;
      }

      // For non-preview mode, redirect to story-detail page to show completed story
      if (!isPreview) {
        router.replace(`../story-detail/${storyId}?completed=true&path=${encodeURIComponent(JSON.stringify(storyPath))}` as any);
        return;
      }

      // For preview mode, show alert and redirect back to editor
      Alert.alert(
        'Preview Complete',
        'You have completed the story preview.',
        [
          {
            text: 'Back to Editor',
            onPress: () => router.replace(`../../story-create/${storyId}/edit` as any)
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
                // Mark as completed
                const { error: progressError } = await supabase
                  .from('story_progress')
                  .update({
                    completed: true,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', user?.id)
                  .eq('story_id', storyId);

                if (progressError) throw progressError;

                // Save story path and comprehension response even when skipping rating
                const storyPathData = {
                  user_id: user?.id,
                  story_id: storyId,
                  story_path: storyPath,
                  comprehension_response: comprehensionResponse.trim() || null,
                };

                const { error: pathError } = await supabase
                  .from('user_story_paths')
                  .upsert(storyPathData, {
                    onConflict: 'user_id,story_id'
                  });

                if (pathError) throw pathError;
              } catch (error) {
                console.error('Error marking story complete:', error);
                Alert.alert('Error', 'Failed to complete story. Please try again.');
                return;
              }
            }

            if (isPreview) {
              router.replace(`../../story-create/${storyId}/edit` as any);
            } else {
              // Redirect to story-detail page to show completed story
              router.replace(`../story-detail/${storyId}?completed=true&path=${encodeURIComponent(JSON.stringify(storyPath))}` as any);
            }
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

        {/* Story Summary Section */}
        {!isPreview && storyPath.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Your Story Journey</Text>
            <Text style={styles.summarySubtitle}>
              Here&apos;s a summary of the choices you made throughout &ldquo;{story.title}&rdquo;
            </Text>

            {/* Toggle Button */}
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowFullStory(!showFullStory);
              }}
              disabled={loadingFullContent}
            >
              {loadingFullContent ? (
                <ActivityIndicator size="small" color="#C4A574" />
              ) : (
                <>
                  <Text style={styles.toggleButtonText}>
                    {showFullStory ? 'Hide' : 'View More'}
                  </Text>
                  <IconSymbol
                    name={showFullStory ? "chevron.up" : "chevron.down"}
                    size={16}
                    color="#C4A574"
                  />
                </>
              )}
            </TouchableOpacity>

            {/* Story Content Display */}
            <View style={showFullStory ? styles.expandedContentWrapper : styles.collapsedContentWrapper}>
              {showFullStory ? (
                /* Full Story Display */
                <ScrollView
                  style={styles.storyScrollView}
                  contentContainerStyle={styles.scrollContentContainer}
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                  scrollEventThrottle={16}
                  indicatorStyle="white"
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                >
                  {uniqueStoryPath.map((entry, index) => {
                    const fullContent = fullStoryContent[entry.part_id];
                    return (
                      <View key={`${entry.part_id}-${index}`} style={styles.fullStoryPart}>
                        <View style={styles.fullStoryHeader}>
                          <Text style={styles.partNumberFull}>Part {index + 1}</Text>
                          {entry.choice_text && (
                            <View style={styles.choiceIndicator}>
                              <IconSymbol name="arrow.right" size={14} color="#C4A574" />
                              <Text style={styles.choiceTextFull}>{entry.choice_text}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.fullStoryText}>
                          {fullContent || entry.part_content || 'Content not available'}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                /* Summary Display */
                uniqueStoryPath.map((entry, index) => (
                  <View key={`${entry.part_id}-${index}`} style={styles.choiceEntry}>
                    <View style={styles.choiceHeader}>
                      <Text style={styles.partNumber}>Part {index + 1}</Text>
                      {entry.choice_text && (
                        <Text style={styles.choiceText}>&ldquo;{entry.choice_text}&rdquo;</Text>
                      )}
                    </View>
                    {entry.part_content && (
                      <Text style={styles.partPreview} numberOfLines={2}>
                        {entry.part_content.substring(0, 100)}...
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Comprehension Question */}
        {!isPreview && (
          <View style={styles.comprehensionSection}>
            <Text style={styles.comprehensionTitle}>Reflection *</Text>
            <Text style={styles.comprehensionSubtitle}>
              What did you understand from this story? What themes or messages stood out to you?
            </Text>
            {existingComprehensionResponse ? (
              <View style={styles.existingReflectionContainer}>
                <Text style={styles.existingReflectionText}>{comprehensionResponse}</Text>
                <Text style={styles.submittedText}>✓ Submitted</Text>
              </View>
            ) : (
              <TextInput
                style={styles.comprehensionInput}
                placeholder="Share your thoughts about the story (required)..."
                placeholderTextColor="#8E8E93"
                value={comprehensionResponse}
                onChangeText={setComprehensionResponse}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={1000}
              />
            )}
            {!existingComprehensionResponse && (
              <Text style={styles.characterCount}>
                {comprehensionResponse.length}/1000
              </Text>
            )}
          </View>
        )}

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
  summarySection: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8D5B7',
    marginBottom: 8,
    textAlign: 'center',
  },
  summarySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#3A3A3C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
    minHeight: 44, // Ensure touchable area
  },
  toggleButtonText: {
    color: '#C4A574',
    fontSize: 16,
    fontWeight: '600',
  },
  collapsedContentWrapper: {
    // Content flows naturally in main ScrollView
  },
  expandedContentWrapper: {
    height: 400, // Fixed height container for expanded content
    borderRadius: 8,
    overflow: 'hidden',
  },
  storyScrollView: {
    height: '100%', // Fill the expanded container
  },
  scrollContentContainer: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    paddingBottom: 20, // Extra padding at bottom for better UX
  },
  fullStoryPart: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  fullStoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  partNumberFull: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C4A574',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 4,
  },
  choiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
    gap: 6,
    flex: 1,
  },
  choiceTextFull: {
    fontSize: 14,
    color: '#E8D5B7',
    fontStyle: 'italic',
    flex: 1,
  },
  fullStoryText: {
    fontSize: 16,
    color: '#E8D5B7',
    lineHeight: 24,
    textAlign: 'left',
  },
  choiceEntry: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  partNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C4A574',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  choiceText: {
    fontSize: 16,
    color: '#E8D5B7',
    fontStyle: 'italic',
    flex: 1,
  },
  partPreview: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  comprehensionSection: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  comprehensionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8D5B7',
    marginBottom: 8,
    textAlign: 'center',
  },
  comprehensionSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  comprehensionInput: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 16,
    color: '#E8D5B7',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  existingReflectionContainer: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  existingReflectionText: {
    color: '#E8D5B7',
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  submittedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 8,
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
