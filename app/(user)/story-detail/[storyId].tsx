import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { StoryWithProgress } from '@/src/types/stories';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
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
  created_by?: string;
  modified_by?: string;
  modified_at?: string;
  choices?: StoryChoice[];
}

interface StoryChoice {
  id: string;
  choice_text: string;
  next_part_id: string | null;
  order_index: number;
}

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
  const [reacting, setReacting] = useState(false);

  // Edit part modal state
  const [editPartModalVisible, setEditPartModalVisible] = useState(false);
  const [editingPart, setEditingPart] = useState<StoryPart | null>(null);
  const [editPartContent, setEditPartContent] = useState('');
  const [editPartIsStarting, setEditPartIsStarting] = useState(false);
  const [editPartIsEnding, setEditPartIsEnding] = useState(false);
  const [savingPartEdit, setSavingPartEdit] = useState(false);

  // Parts visibility toggle
  const [partsVisible, setPartsVisible] = useState(true);

  // Reactions and ratings modal state
  const [reactionsModalVisible, setReactionsModalVisible] = useState(false);
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false);
  const [userReactions, setUserReactions] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Expanded content state for View More functionality
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [expandedChoices, setExpandedChoices] = useState<Set<string>>(new Set());

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
          story_parts(
            *,
            choices:story_choices!story_choices_part_id_fkey(*)
          )
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

      // Get user's rating if exists
      const { data: userRating } = await supabase
        .from('story_ratings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      // Get reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('story_reactions')
        .select('reaction_type')
        .eq('story_id', storyId);

      if (reactionsError) throw reactionsError;

      const likes = reactionsData?.filter(r => r.reaction_type === 'like').length || 0;
      const dislikes = reactionsData?.filter(r => r.reaction_type === 'dislike').length || 0;

      // Get user's reaction
      const { data: userReaction } = await supabase
        .from('story_reactions')
        .select('reaction_type')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      const storyWithDetails: StoryWithProgress = {
        ...storyData,
        author_name: storyData.users?.name || 'Anonymous',
        average_rating: averageRating,
        total_ratings: ratingsData?.length || 0,
        likes: likes,
        dislikes: dislikes,
        user_reaction: userReaction?.reaction_type,
        progress: progressData || undefined,
        user_rating: userRating || undefined,
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

  // Real-time subscription for story reactions and ratings
  useEffect(() => {
    if (!storyId) return;

    const subscription = supabase
      .channel(`story-reactions-${storyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'story_reactions',
          filter: `story_id=eq.${storyId}`,
        },
        async (payload) => {
          console.log('Story reaction change detected:', payload);
          // Reload story details to get updated reaction counts
          if (user) {
            await loadStoryDetails();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'story_ratings',
          filter: `story_id=eq.${storyId}`,
        },
        async (payload) => {
          console.log('Story rating change detected:', payload);
          // Reload story details to get updated rating data
          if (user) {
            await loadStoryDetails();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [storyId, user]);

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
    if (!story || !story.story_parts || story.story_parts.length === 0) {
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
      `Are you sure you want to delete "${story?.title || 'this story'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!story?.id) {
                Alert.alert('Error', 'Story not found');
                return;
              }

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

  const handleReaction = async (reactionType: 'like' | 'dislike') => {
    if (!story || !user?.id || reacting) return;

    try {
      setReacting(true);

      const currentReaction = story.user_reaction;

      if (currentReaction === reactionType) {
        // Remove reaction
        const { error } = await supabase
          .from('story_reactions')
          .delete()
          .eq('user_id', user.id)
          .eq('story_id', story.id);

        if (error) throw error;

        // Update local state
        setStory(prev => prev ? {
          ...prev,
          likes: reactionType === 'like' ? (prev.likes || 0) - 1 : (prev.likes || 0),
          dislikes: reactionType === 'dislike' ? (prev.dislikes || 0) - 1 : (prev.dislikes || 0),
          user_reaction: undefined
        } : null);
      } else {
        // Delete existing reaction first, then insert new one
        if (currentReaction) {
          await supabase
            .from('story_reactions')
            .delete()
            .eq('user_id', user.id)
            .eq('story_id', story.id);
        }

        const { error } = await supabase
          .from('story_reactions')
          .insert({
            user_id: user.id,
            story_id: story.id,
            reaction_type: reactionType
          });

        if (error) throw error;

        // Update local state
        setStory(prev => prev ? {
          ...prev,
          likes: reactionType === 'like'
            ? (currentReaction === 'dislike' ? (prev.likes || 0) + 1 : (prev.likes || 0) + (currentReaction ? 0 : 1))
            : (currentReaction === 'like' ? (prev.likes || 0) - 1 : (prev.likes || 0)),
          dislikes: reactionType === 'dislike'
            ? (currentReaction === 'like' ? (prev.dislikes || 0) + 1 : (prev.dislikes || 0) + (currentReaction ? 0 : 1))
            : (currentReaction === 'dislike' ? (prev.dislikes || 0) - 1 : (prev.dislikes || 0)),
          user_reaction: reactionType
        } : null);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      Alert.alert('Error', 'Failed to update reaction');
    } finally {
      setReacting(false);
    }
  };

  const handleEditPart = (part: StoryPart) => {
    setEditingPart(part);
    setEditPartContent(part.content);
    setEditPartIsStarting(part.is_start);
    setEditPartIsEnding(part.is_ending);
    setEditPartModalVisible(true);
  };

  const handleDeletePart = (part: StoryPart) => {
    Alert.alert(
      'Delete Story Part',
      `Are you sure you want to delete this story part? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('story_parts')
                .delete()
                .eq('id', part.id);

              if (error) throw error;

              // Reload story details to update the UI
              loadStoryDetails();
              Alert.alert('Success', 'Story part deleted successfully');
            } catch (error) {
              console.error('Error deleting part:', error);
              Alert.alert('Error', 'Failed to delete story part');
            }
          },
        },
      ]
    );
  };

  const handleSavePartEdit = async () => {
    if (!editingPart || !editPartContent.trim()) {
      Alert.alert('Error', 'Please enter content for the story part');
      return;
    }

    // If marking as starting scene, check if another part is already starting (but allow editing the current one)
    if (editPartIsStarting && story?.story_parts?.some(part => part.is_start && part.id !== editingPart.id)) {
      Alert.alert('Error', 'Only one part can be marked as the starting scene');
      return;
    }

    // Multiple ending scenes are allowed for branching story endings

    try {
      setSavingPartEdit(true);

      const partData = {
        content: editPartContent.trim(),
        is_start: editPartIsStarting,
        is_ending: editPartIsEnding,
        modified_by: user?.id,
        modified_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('story_parts')
        .update(partData)
        .eq('id', editingPart.id);

      if (error) throw error;

      setEditPartModalVisible(false);
      setEditingPart(null);
      loadStoryDetails(); // Reload to show the updated part
      Alert.alert('Success', 'Story part updated successfully');
    } catch (error) {
      console.error('Error updating part:', error);
      Alert.alert('Error', 'Failed to update story part');
    } finally {
      setSavingPartEdit(false);
    }
  };

  const loadUserDetails = async (viewType: 'reactions' | 'ratings') => {
    if (!story) return;

    try {
      setLoadingUserDetails(true);

      if (viewType === 'reactions') {
        // Load reactions with user info
        const { data: reactions, error: reactionsError } = await supabase
          .from('story_reactions')
          .select(`
            reaction_type,
            created_at,
            users!user_id(name)
          `)
          .eq('story_id', story.id);

        if (reactionsError) throw reactionsError;
        setUserReactions(reactions || []);
        setReactionsModalVisible(true);
      } else if (viewType === 'ratings') {
        // Load ratings with user info
        const { data: ratings, error: ratingsError } = await supabase
          .from('story_ratings')
          .select(`
            rating,
            created_at,
            users!user_id(name)
          `)
          .eq('story_id', story.id);

        if (ratingsError) throw ratingsError;
        setUserRatings(ratings || []);
        setRatingsModalVisible(true);
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      Alert.alert('Error', 'Failed to load user details');
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const togglePartExpansion = (partId: string) => {
    const newExpanded = new Set(expandedParts);
    if (newExpanded.has(partId)) {
      newExpanded.delete(partId);
    } else {
      newExpanded.add(partId);
    }
    setExpandedParts(newExpanded);
  };

  const toggleChoiceExpansion = (choiceId: string) => {
    const newExpanded = new Set(expandedChoices);
    if (newExpanded.has(choiceId)) {
      newExpanded.delete(choiceId);
    } else {
      newExpanded.add(choiceId);
    }
    setExpandedChoices(newExpanded);
  };

  const getPartDisplayName = (partId: string | null) => {
    if (!partId || !story?.story_parts) return 'End Story';
    const part = story.story_parts.find(p => p.id === partId);
    return part ? `"${part.content.substring(0, 30)}${part.content.length > 30 ? '...' : ''}"` : 'End Story';
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
        {/* Stories Navigation Button */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity style={styles.storiesButton} onPress={() => router.push('/(user)/(tabs)/stories' as any)}>
            <IconSymbol name="books.vertical" size={16} color="#E8D5B7" />
            <Text style={styles.storiesButtonText}>Stories</Text>
          </TouchableOpacity>
        </View>

        {/* Story Header */}
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

            {/* Reactions */}
            <View style={styles.reactionsContainer}>
              <TouchableOpacity
                style={[
                  styles.reactionButton,
                  styles.likeButton,
                  story.user_reaction === 'like' && styles.reactionButtonActive
                ]}
                onPress={() => handleReaction('like')}
                disabled={reacting}
              >
                <Text style={{ fontSize: 16, marginRight: 4 }}>
                  👍
                </Text>
                <Text style={[
                  styles.reactionText,
                  story.user_reaction === 'like' && styles.reactionTextActive
                ]}>
                  {story.likes || 0}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reactionButton,
                  styles.dislikeButton,
                  story.user_reaction === 'dislike' && styles.reactionButtonActive
                ]}
                onPress={() => handleReaction('dislike')}
                disabled={reacting}
              >
                <Text style={{ fontSize: 16, marginRight: 4 }}>
                  👎
                </Text>
                <Text style={[
                  styles.reactionText,
                  story.user_reaction === 'dislike' && styles.reactionTextActive
                ]}>
                  {story.dislikes || 0}
                </Text>
              </TouchableOpacity>
            </View>

            {/* View Reactions and Ratings Links */}
            <View style={styles.viewLinksContainer}>
              {(story.likes || 0) > 0 || (story.dislikes || 0) > 0 ? (
                <TouchableOpacity
                  style={styles.viewLink}
                  onPress={() => loadUserDetails('reactions')}>
                  <Text style={styles.viewLinkText}>
                    View {(story.likes || 0) + (story.dislikes || 0)} reaction{(story.likes || 0) + (story.dislikes || 0) !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {(story.total_ratings || 0) > 0 ? (
                <TouchableOpacity
                  style={styles.viewLink}
                  onPress={() => loadUserDetails('ratings')}>
                  <Text style={styles.viewLinkText}>View all ratings</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Story Parts - Only show for story authors */}
            {story.author_id === user?.id && story.story_parts && story.story_parts.length > 0 && (
              <View style={styles.partsSection}>
                <View style={styles.partsHeader}>
                  <Text style={styles.sectionTitle}>Story Parts ({story.story_parts.length})</Text>
                  <TouchableOpacity
                    style={styles.partsToggle}
                    onPress={() => setPartsVisible(!partsVisible)}
                  >
                    <IconSymbol
                      name={partsVisible ? "eye.slash.fill" : "eye.fill"}
                      size={20}
                      color="#C4A574"
                    />
                    <Text style={styles.partsToggleText}>
                      {partsVisible ? 'Hide All Parts' : 'Show All Parts'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {partsVisible && story.story_parts
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((part) => (
                    <View key={part.id} style={styles.partCard}>
                      <View style={styles.partHeader}>
                        <View style={styles.partContentContainer}>
                          <Text
                            style={styles.partContent}
                            numberOfLines={expandedParts.has(part.id) ? undefined : 3}
                          >
                            {part.content}
                          </Text>
                          {part.content.length > 150 && (
                            <TouchableOpacity
                              style={styles.viewMoreButton}
                              onPress={() => togglePartExpansion(part.id)}
                            >
                              <Text style={styles.viewMoreText}>
                                {expandedParts.has(part.id) ? 'View Less' : 'View More'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.partBadges}>
                          {part.is_start && (
                            <View style={styles.startBadge}>
                              <Text style={styles.startBadgeText}>Start</Text>
                            </View>
                          )}
                          {part.is_ending && (
                            <View style={styles.endBadge}>
                              <Text style={styles.endBadgeText}>End</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Display choices for this part */}
                      {part.choices && part.choices.length > 0 && (
                        <View style={styles.choicesSection}>
                          <View style={styles.choicesHeader}>
                            <Text style={styles.choicesTitle}>Choices:</Text>
                          </View>
                          {part.choices.map((choice: StoryChoice) => (
                            <View key={choice.id} style={styles.choiceItem}>
                              <View style={styles.choiceContent}>
                                <View style={styles.choiceTextContainer}>
                                  <Text
                                    style={styles.choiceText}
                                    numberOfLines={expandedChoices.has(choice.id) ? undefined : 2}
                                  >
                                    {choice.choice_text}
                                  </Text>
                                  {choice.choice_text.length > 100 && (
                                    <TouchableOpacity
                                      style={styles.viewMoreButtonSmall}
                                      onPress={() => toggleChoiceExpansion(choice.id)}
                                    >
                                      <Text style={styles.viewMoreTextSmall}>
                                        {expandedChoices.has(choice.id) ? 'Less' : 'More'}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                                <Text style={styles.choiceLink}>
                                  → {getPartDisplayName(choice.next_part_id)}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={styles.partActions}>
                        <TouchableOpacity
                          style={styles.editPartButton}
                          onPress={() => handleEditPart(part)}
                        >
                          <IconSymbol name="pencil" size={16} color="#2196F3" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deletePartButton}
                          onPress={() => handleDeletePart(part)}
                        >
                          <IconSymbol name="trash.fill" size={16} color="#F44336" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.partDate}>
                        Created {new Date(part.created_at).toLocaleDateString()}
                        {part.modified_at && part.modified_at !== part.created_at && (
                          <Text style={styles.modifiedText}>
                            {' • '}Modified {new Date(part.modified_at).toLocaleDateString()}
                          </Text>
                        )}
                      </Text>
                    </View>
                  ))}
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
                <Text style={{ fontSize: 16, marginRight: 4 }}>🗑️</Text>
                <Text style={styles.creatorButtonText} numberOfLines={1}>Delete</Text>
              </TouchableOpacity>

              {!story.is_published && !story.submitted_at && (
                <TouchableOpacity
                  style={[styles.creatorButton, styles.publishButton]}
                  onPress={handleSubmitForReview}
                >
                  <Text style={{ fontSize: 16, marginRight: 4 }}>📤</Text>
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

      {/* Reactions List Modal */}
      <Modal visible={reactionsModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setReactionsModalVisible(false)}>
          <Pressable style={styles.listModalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Reactions</Text>
            <ScrollView style={styles.reactionsList}>
              {loadingUserDetails ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#C4A574" />
                  <Text style={styles.loadingText}>Loading reactions...</Text>
                </View>
              ) : (
                <View style={styles.reactionSummary}>
                  {userReactions.length === 0 ? (
                    <Text style={styles.noDataText}>No reactions yet</Text>
                  ) : (
                    userReactions.map((reaction, index) => (
                      <View key={index} style={styles.summaryItem}>
                        <Text style={styles.summaryEmoji}>
                          {reaction.reaction_type === 'like' ? '👍' : '👎'}
                        </Text>
                        <View style={styles.userInfo}>
                          <Text style={styles.modalSummaryText}>{reaction.users?.name || 'Anonymous'}</Text>
                          <Text style={styles.timestampText}>
                            {new Date(reaction.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setReactionsModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Ratings List Modal */}
      <Modal visible={ratingsModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setRatingsModalVisible(false)}>
          <Pressable style={styles.listModalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Ratings</Text>
            <ScrollView style={styles.reactionsList}>
              {loadingUserDetails ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#C4A574" />
                  <Text style={styles.loadingText}>Loading ratings...</Text>
                </View>
              ) : (
                <View style={styles.ratingSummary}>
                  {userRatings.length === 0 ? (
                    <Text style={styles.noDataText}>No ratings yet</Text>
                  ) : (
                    userRatings.map((rating, index) => (
                      <View key={index} style={styles.summaryItem}>
                        <View style={styles.starsContainer}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Text key={star} style={[styles.starIcon, star <= rating.rating && styles.starFilled]}>
                              ★
                            </Text>
                          ))}
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.modalSummaryText}>{rating.users?.name || 'Anonymous'}</Text>
                          <Text style={styles.timestampText}>
                            {new Date(rating.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setRatingsModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Part Modal */}
      <Modal
        visible={editPartModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditPartModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Story Part</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={[styles.modalTextInput, { height: 120, textAlignVertical: 'top' }]}
                value={editPartContent}
                onChangeText={setEditPartContent}
                placeholder="Enter the scene content..."
                placeholderTextColor="#8E8E93"
                multiline={true}
                numberOfLines={6}
              />
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setEditPartIsStarting(!editPartIsStarting)}
              >
                {editPartIsStarting && <IconSymbol name="checkmark" size={16} color="#C4A574" />}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                Mark as Starting Scene
              </Text>
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setEditPartIsEnding(!editPartIsEnding)}
              >
                {editPartIsEnding && <IconSymbol name="checkmark" size={16} color="#C4A574" />}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                Mark as Ending Scene
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setEditPartModalVisible(false);
                  setEditPartContent('');
                  setEditPartIsStarting(false);
                  setEditPartIsEnding(false);
                  setEditingPart(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, savingPartEdit && styles.disabledButton]}
                onPress={handleSavePartEdit}
                disabled={savingPartEdit}
              >
                {savingPartEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Update Part</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  navigationContainer: {
    marginBottom: 16,
  },
  storiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  storiesButtonText: {
    color: '#E8D5B7',
    fontSize: 14,
    fontWeight: '600',
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
  reactionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#2C2C2E',
    gap: 6,
  },
  likeButton: {
    borderColor: '#4CAF50',
  },
  dislikeButton: {
    borderColor: '#F44336',
  },
  reactionButtonActive: {
    backgroundColor: '#C4A574',
    borderColor: '#C4A574',
  },
  reactionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  reactionTextActive: {
    color: '#FFFFFF',
  },
  viewLinksContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  viewLink: {
    flex: 1,
  },
  viewLinkText: {
    fontSize: 13,
    color: '#C4A574',
    textAlign: 'center',
  },

  // Story Parts Styles
  partsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  partsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  partsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  partsToggleText: {
    fontSize: 14,
    color: '#C4A574',
    fontWeight: '600',
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
  partContentContainer: {
    flex: 1,
  },
  viewMoreButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  viewMoreText: {
    fontSize: 12,
    color: '#C4A574',
    fontWeight: '600',
  },
  partBadges: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
  },
  startBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  startBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  endBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  endBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  partActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  editPartButton: {
    backgroundColor: '#2C2C2E',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  deletePartButton: {
    backgroundColor: '#2C2C2E',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  partDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  modifiedText: {
    color: '#8E8E93',
  },

  // Choice styles
  choicesSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
    paddingTop: 12,
  },
  choicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  choicesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8D5B7',
  },
  choiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  choiceContent: {
    flex: 1,
  },
  choiceTextContainer: {
    flex: 1,
  },
  choiceText: {
    fontSize: 14,
    color: '#E8D5B7',
    flex: 1,
  },
  choiceLink: {
    fontSize: 12,
    color: '#C4A574',
    fontStyle: 'italic',
    marginTop: 4,
  },
  viewMoreButtonSmall: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  viewMoreTextSmall: {
    fontSize: 11,
    color: '#C4A574',
    fontWeight: '600',
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
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  timestampText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    padding: 20,
  },
  starIcon: {
    fontSize: 16,
    color: '#8E8E93',
    marginRight: 2,
  },
  starFilled: {
    color: '#FFD700',
  },
  listModalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 350,
    maxHeight: '70%',
  },
  reactionsList: {
    maxHeight: 300,
  },
  reactionSummary: {
    padding: 10,
  },
  ratingSummary: {
    padding: 10,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  modalSummaryText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#3A3A3C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Checkbox styles for edit part modal
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: 'transparent',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#E8D5B7',
  },
});
