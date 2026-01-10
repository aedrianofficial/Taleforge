import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import {
    ReadingState,
    Story,
    StoryChoice,
    StoryPartWithChoices,
    StoryPathEntry,
    StoryProgress
} from '@/src/types/stories';
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
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoryReadingScreen() {
  const { storyId, preview, path } = useLocalSearchParams<{ storyId: string; preview?: string; path?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPreview = preview === 'true';
  const isReplayMode = !!path;

  const [readingState, setReadingState] = useState<ReadingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storyPath, setStoryPath] = useState<StoryPathEntry[]>([]);

  useEffect(() => {
    if (storyId && user) {
      initializeReading();
    }
  }, [storyId, user]);

  // Parse replay path when available
  useEffect(() => {
    if (path && isReplayMode) {
      try {
        const parsedPath = JSON.parse(decodeURIComponent(path));
        setStoryPath(parsedPath);
      } catch (error) {
        console.error('Error parsing replay path:', error);
      }
    }
  }, [path, isReplayMode]);

  const initializeReading = useCallback(async () => {
    if (!storyId || !user?.id) return;
    try {
      setLoading(true);

      // Get or create progress using upsert
      const { data: progress, error: progressError } = await supabase
        .from('story_progress')
        .upsert({
          user_id: user?.id,
          story_id: storyId,
          completed: false,
        }, {
          onConflict: 'user_id,story_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (progressError) throw progressError;

      // Get story info - only allow access to published stories or user's own stories
      const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .or(`is_published.eq.true,author_id.eq.${user.id}`)
        .single();

      if (storyError) throw storyError;

      // Load current part (or start part if none)
      const currentPartId = progress.current_part_id || await getStartPartId(storyId);

      if (currentPartId) {
        await loadStoryPart(currentPartId, story, progress);
      } else {
        // Check if user owns this story
        const isOwner = story.author_id === user?.id;

        if (isOwner) {
          Alert.alert(
            'Story Not Ready',
            'This story doesn\'t have any content yet. Would you like to add some content now?',
            [
              {
                text: 'Add Content',
                onPress: () => {
                  // Redirect directly to the Add Part page for this story
                  router.replace(`../../story-parts/${storyId}` as any);
                }
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => router.back()
              }
            ]
          );
        } else {
          Alert.alert(
            'Story Unavailable',
            'This story is not available for reading at this time.',
            [
              {
                text: 'OK',
                onPress: () => router.back()
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error initializing reading:', error);
      Alert.alert('Error', 'Failed to load story');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [storyId, user?.id]);

  useEffect(() => {
    if (storyId && user) {
      initializeReading();
    }
  }, [storyId, user, initializeReading]);

  const getStartPartId = async (storyId: string): Promise<string | null> => {
    // First try to find the marked start part
    const { data: startPart, error: startError } = await supabase
      .from('story_parts')
      .select('id')
      .eq('story_id', storyId)
      .eq('is_start', true)
      .single();

    if (!startError && startPart?.id) {
      return startPart.id;
    }

    // Check if the error is just "no rows found" (which is expected if no start part exists)
    if (startError && startError.code !== 'PGRST116') {
      console.error('Error getting start part:', startError);
    }

    // If no start part is marked, get the first part created
    console.log('No start part found, trying to get first part');
    const { data: firstPart, error: firstError } = await supabase
      .from('story_parts')
      .select('id')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (firstError) {
      // Check if the error is just "no rows found" (which is expected if no parts exist)
      if (firstError.code === 'PGRST116') {
        console.log('No story parts found for story:', storyId);
        return null;
      }
      console.error('Error getting first part:', firstError);
      return null;
    }

    if (firstPart?.id) {
      console.log('Using first part as start:', firstPart.id);
      return firstPart.id;
    }

    console.error('No parts found for story');
    return null;
  };

  const loadStoryPart = async (partId: string, story: Story, progress: StoryProgress) => {
    try {
      // Get part with choices
      const { data: part, error: partError } = await supabase
        .from('story_parts')
        .select('*')
        .eq('id', partId)
        .single();

      if (partError) throw partError;

      // Get choices for this part
      const { data: choices, error: choicesError } = await supabase
        .from('story_choices')
        .select('*')
        .eq('part_id', partId)
        .order('order_index', { ascending: true });

      if (choicesError) throw choicesError;

      const partWithChoices: StoryPartWithChoices = {
        ...part,
        choices: choices || [],
      };

      setReadingState({
        currentPart: partWithChoices,
        story,
        progress,
      });

      // Record the initial part in the story path if this is the first part
      if (storyPath.length === 0) {
        setStoryPath([{
          part_id: partId,
          timestamp: new Date().toISOString(),
          part_content: part.content
        }]);
      }

      // In replay mode, automatically proceed with the recorded choice
      if (isReplayMode && !partWithChoices.is_ending && partWithChoices.choices.length > 0) {
        // Find the recorded choice for this part
        const recordedChoice = storyPath.find(entry =>
          entry.part_id === partId && entry.choice_id
        );

        if (recordedChoice) {
          const choice = partWithChoices.choices.find(c => c.id === recordedChoice.choice_id);
          if (choice) {
            // Auto-proceed with the recorded choice after a short delay
            setTimeout(() => {
              handleChoice(choice);
            }, 1500); // 1.5 second delay to let user see the content
          }
        }
      }

      // Ending parts are now handled in the UI with the Finish button
      // No automatic alerts or navigation for ending parts
    } catch (error) {
      console.error('Error loading story part:', error);
      Alert.alert('Error', 'Failed to load story part');
    }
  };

  const handleChoice = async (choice: StoryChoice) => {
    if (!readingState || saving) return;

    try {
      setSaving(true);

      let nextPartId = choice.next_part_id;

      // If no next_part_id is set (choice links to "End Story"), end the story
      if (!nextPartId) {
        // End the story - mark as completed and navigate to rating
        if (!isPreview) {
          const { error: completeError } = await supabase
            .from('story_progress')
            .update({
              completed: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', readingState.progress.id);

          if (completeError) throw completeError;
        }

        // Navigate to ending screen for rating, passing the story path
        const pathParam = encodeURIComponent(JSON.stringify([...storyPath, {
          part_id: readingState.currentPart.id,
          choice_id: choice.id,
          choice_text: choice.choice_text,
          timestamp: new Date().toISOString(),
          part_content: readingState.currentPart.content
        }]));
        router.push(`../story-ending/${storyId}?path=${pathParam}` as any);
        return;
      }

      // Save progress (skip in preview mode)
      if (!isPreview) {
        const { error: updateError } = await supabase
          .from('story_progress')
          .update({
            current_part_id: nextPartId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', readingState.progress.id);

        if (updateError) throw updateError;
      }

      // Record the choice in the story path
      setStoryPath(prev => [...prev, {
        part_id: nextPartId,
        choice_id: choice.id,
        choice_text: choice.choice_text,
        timestamp: new Date().toISOString()
      }]);

      // Load next part
      await loadStoryPart(nextPartId, readingState.story, {
        ...readingState.progress,
        current_part_id: nextPartId,
      });

    } catch (error) {
      console.error('Error saving choice:', error);
      Alert.alert('Error', 'Failed to save progress');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    Alert.alert(
      'Leave Story?',
      'Your progress will be saved. Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', onPress: () => router.back() },
      ]
    );
  };

  const handleFinishStory = async () => {
    if (!readingState || saving) return;

    try {
      setSaving(true);

      if (!isPreview) {
        // Normal reading mode: Mark story as completed and go to rating
        const { error: completeError } = await supabase
          .from('story_progress')
          .update({
            completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', readingState.progress.id);

        if (completeError) {
          console.error('Error marking story as completed:', completeError);
          throw completeError;
        }

        // Navigate to ending screen for rating, passing the story path
        const pathParam = encodeURIComponent(JSON.stringify([...storyPath, {
          part_id: readingState.currentPart.id,
          timestamp: new Date().toISOString(),
          part_content: readingState.currentPart.content
        }]));
        router.push(`../story-ending/${storyId}?path=${pathParam}` as any);
      } else {
        // Preview mode: Go back to story detail page for editing
        router.replace(`../story-detail/${storyId}` as any);
      }
    } catch (error) {
      console.error('Error finishing story:', error);
      Alert.alert('Error', 'Failed to complete story. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
        <Text style={styles.loadingText}>Loading story...</Text>
      </SafeAreaView>
    );
  }

  if (!readingState) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load story</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { currentPart, story } = readingState;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButtonSmall} onPress={handleBack}>
          <IconSymbol name="chevron.left" size={24} color="#C4A574" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {story.title}
          </Text>
          {isPreview && (
            <Text style={styles.previewBadge}>PREVIEW</Text>
          )}
        </View>
        <TouchableOpacity style={styles.storiesButton} onPress={() => router.push('/(user)/(tabs)/stories' as any)}>
          <Text style={styles.storiesButtonText}>Stories</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#C4A574" />
          <Text style={styles.savingText}>Saving progress...</Text>
        </View>
      )}

      {/* Story Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.storyTextContainer}>
          <Text style={styles.storyText}>
            {currentPart.content}
          </Text>
        </View>

      </ScrollView>

      {/* Choices or Finish Button */}
      {!currentPart.is_ending && currentPart.choices.length > 0 && (
        <View style={styles.choicesContainer}>
          <Text style={styles.choicesTitle}>
            {isReplayMode ? 'Replaying your choices...' : 'What happens next?'}
          </Text>
          {currentPart.choices.map((choice) => {
            // In replay mode, highlight the choice that was made
            const isSelectedChoice = isReplayMode && storyPath.some(entry =>
              entry.part_id === currentPart.id && entry.choice_id === choice.id
            );

            return (
              <TouchableOpacity
                key={choice.id}
                style={[
                  styles.choiceButton,
                  isSelectedChoice && styles.selectedChoiceButton
                ]}
                onPress={() => !isReplayMode && handleChoice(choice)}
                disabled={saving || isReplayMode}
              >
                <Text style={[
                  styles.choiceText,
                  isSelectedChoice && styles.selectedChoiceText
                ]}>
                  {choice.choice_text}
                </Text>
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={isSelectedChoice ? "#4CAF50" : "#C4A574"}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Finish Button for Ending Parts */}
      {currentPart.is_ending && (
        <View style={styles.finishContainer}>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinishStory}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.finishButtonText}>
                  {isPreview ? 'Back to Editor' : 'Finish'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  backButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    textAlign: 'center',
  },
  previewBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9C27B0',
    textAlign: 'center',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  storiesButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  storiesButtonText: {
    color: '#E8D5B7',
    fontSize: 14,
    fontWeight: '600',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#2C2C2E',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3A3A3C',
  },
  savingText: {
    color: '#C4A574',
    fontSize: 14,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  storyTextContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  storyText: {
    fontSize: 18,
    color: '#E8D5B7',
    lineHeight: 28,
  },
  choicesContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 120, // Extra padding for mobile navigation
  },
  choicesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 16,
    textAlign: 'center',
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3A3A3C',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  choiceText: {
    fontSize: 16,
    color: '#E8D5B7',
    flex: 1,
    marginRight: 12,
  },
  selectedChoiceButton: {
    backgroundColor: '#1B5E20',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  selectedChoiceText: {
    color: '#81C784',
    fontWeight: '600',
  },
  finishContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 120, // Extra padding for mobile navigation
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
