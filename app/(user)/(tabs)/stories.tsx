import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { StoryWithProgress } from '@/src/types/stories';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

type StoryTab = 'all' | 'my';

export default function StoriesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<StoryWithProgress[]>([]);
  const [myStories, setMyStories] = useState<StoryWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<StoryTab>('all');
  const [addPartModalVisible, setAddPartModalVisible] = useState(false);
  const [selectedStoryForPart, setSelectedStoryForPart] = useState<StoryWithProgress | null>(null);
  const [partContent, setPartContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStories, setFilteredStories] = useState<StoryWithProgress[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'rating'>('newest');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStory, setEditingStory] = useState<StoryWithProgress | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Reactions and ratings modal state
  const [reactionsModalVisible, setReactionsModalVisible] = useState(false);
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false);
  const [viewingReactionsStory, setViewingReactionsStory] = useState<StoryWithProgress | null>(null);
  const [viewingRatingsStory, setViewingRatingsStory] = useState<StoryWithProgress | null>(null);
  const [userReactions, setUserReactions] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [reactingStories, setReactingStories] = useState<Set<string>>(new Set());

  const loadStories = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // Fetch published stories with author info and ratings
      const { data: publishedStories, error: publishedError } = await supabase
        .from('stories')
        .select(`
          *,
          users!author_id(name)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (publishedError) throw publishedError;

      // Fetch user's own stories (both published and drafts)
      const { data: userStories, error: userError } = await supabase
        .from('stories')
        .select(`
          *,
          users!author_id(name)
        `)
        .eq('author_id', user.id)
        .order('updated_at', { ascending: false });

      if (userError) throw userError;

      // Get user progress for these stories
      const allStoryIds = [
        ...(publishedStories?.map(s => s.id) || []),
        ...(userStories?.map(s => s.id) || [])
      ];

      const { data: progressData, error: progressError } = await supabase
        .from('story_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('story_id', allStoryIds);

      if (progressError) throw progressError;

      // Get average ratings for stories
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('story_ratings')
        .select('story_id, rating')
        .in('story_id', allStoryIds);

      if (ratingsError) throw ratingsError;

      // Calculate average ratings
      const ratingsMap = new Map<string, { total: number; count: number }>();
      ratingsData?.forEach(rating => {
        const existing = ratingsMap.get(rating.story_id) || { total: 0, count: 0 };
        ratingsMap.set(rating.story_id, {
          total: existing.total + rating.rating,
          count: existing.count + 1
        });
      });

      // Get reactions for stories
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('story_reactions')
        .select('story_id, reaction_type')
        .in('story_id', allStoryIds);

      if (reactionsError) throw reactionsError;

      // Calculate reaction counts
      const reactionsMap = new Map<string, { likes: number; dislikes: number }>();
      reactionsData?.forEach(reaction => {
        const existing = reactionsMap.get(reaction.story_id) || { likes: 0, dislikes: 0 };
        if (reaction.reaction_type === 'like') {
          existing.likes++;
        } else if (reaction.reaction_type === 'dislike') {
          existing.dislikes++;
        }
        reactionsMap.set(reaction.story_id, existing);
      });

      // Get user's reactions
      const { data: userReactions, error: userReactionsError } = await supabase
        .from('story_reactions')
        .select('story_id, reaction_type')
        .eq('user_id', user.id)
        .in('story_id', allStoryIds);

      if (userReactionsError) throw userReactionsError;

      // Map user reactions
      const userReactionsMap = new Map<string, 'like' | 'dislike'>();
      userReactions?.forEach(reaction => {
        userReactionsMap.set(reaction.story_id, reaction.reaction_type);
      });

      // Helper function to create story with progress
      const createStoryWithProgress = (story: any) => {
        const progress = progressData?.find(p => p.story_id === story.id);
        const ratingInfo = ratingsMap.get(story.id);
        const reactionInfo = reactionsMap.get(story.id);
        const userReaction = userReactionsMap.get(story.id);

        return {
          ...story,
          author_name: story.users?.name || 'Anonymous',
          average_rating: ratingInfo ? ratingInfo.total / ratingInfo.count : undefined,
          total_ratings: ratingInfo?.count || 0,
          likes: reactionInfo?.likes || 0,
          dislikes: reactionInfo?.dislikes || 0,
          user_reaction: userReaction,
          progress,
        };
      };

      // Combine and deduplicate stories (user's stories take precedence)
      const allStories = [...(userStories || []), ...(publishedStories || [])];
      const uniqueStories = allStories.filter((story, index, self) =>
        index === self.findIndex(s => s.id === story.id)
      );

      const storiesWithProgress: StoryWithProgress[] = uniqueStories.map(createStoryWithProgress);
      const userStoriesWithProgress: StoryWithProgress[] = (userStories || []).map(createStoryWithProgress);

      setStories(storiesWithProgress);
      setMyStories(userStoriesWithProgress);
    } catch (error) {
      console.error('Error loading stories:', error);
      Alert.alert('Error', 'Failed to load stories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadStories();
    }
  }, [user, loadStories]);

  // Real-time subscription for story reactions and ratings
  useEffect(() => {
    const subscription = supabase
      .channel('user-stories-reactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_reactions' }, () => {
        // Reload stories to get updated reaction counts
        loadStories();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_ratings' }, () => {
        // Reload stories to get updated rating data
        loadStories();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        // Reload stories when story data changes (like publishing status)
        loadStories();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Filter and sort stories based on search query, genre, and sort options
  useEffect(() => {
    let sourceStories = activeTab === 'all' ? stories : myStories;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sourceStories = sourceStories.filter(story =>
        story.title.toLowerCase().includes(query) ||
        story.description?.toLowerCase().includes(query) ||
        story.genre?.toLowerCase().includes(query) ||
        story.users?.name.toLowerCase().includes(query)
      );
    }

    // Apply genre filter
    if (selectedGenre !== 'all') {
      sourceStories = sourceStories.filter(story =>
        story.genre?.toLowerCase() === selectedGenre.toLowerCase()
      );
    }

    // Apply sorting
    const sortedStories = [...sourceStories].sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.total_ratings || 0) - (a.total_ratings || 0);
        case 'rating':
          return (b.average_rating || 0) - (a.average_rating || 0);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredStories(sortedStories);
  }, [searchQuery, activeTab, stories, myStories, selectedGenre, sortBy]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStories();
  };

  const renderStoryCard = ({ item }: { item: StoryWithProgress }) => {
    const isMyStory = item.author_id === user?.id;

    return (
      <TouchableOpacity
        style={styles.simpleStoryCard}
        onPress={() => router.push(`../story-detail/${item.id}` as any)}
      >
        <View style={styles.simpleCardContent}>
          <View style={styles.cardHeader}>
            <IconSymbol name="book.fill" size={24} color="#C4A574" />
            <View style={styles.titleContainer}>
              <Text style={styles.storyTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {isMyStory && (
              <View style={[
                styles.statusBadge,
                item.is_published ? styles.publishedBadge :
                item.submitted_at ? styles.pendingBadge :
                styles.draftBadge
              ]}>
                <Text style={styles.statusText}>
                  {item.is_published ? 'Published' :
                   item.submitted_at ? 'Under Review' :
                   'Draft'}
                </Text>
              </View>
            )}
            </View>
          </View>

          {item.genre && (
            <View style={styles.genreContainer}>
              <Text style={styles.genreText}>{item.genre}</Text>
            </View>
          )}

          {item.description && (
            <Text style={styles.storyDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.metaContainer}>
              <Text style={styles.authorText}>
                by {item.author_name}
              </Text>
              {item.average_rating && (
                <View style={styles.ratingContainer}>
                  {renderStars(Math.round(item.average_rating), 12)}
                  <Text style={styles.ratingText}>
                    {item.average_rating.toFixed(1)} ({item.total_ratings})
                  </Text>
                </View>
              )}
              {/* Reactions */}
              <View style={styles.reactionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.reactionButton,
                    styles.likeButton,
                    item.user_reaction === 'like' && styles.reactionButtonActive
                  ]}
                  onPress={() => handleReaction(item, 'like')}
                  disabled={reactingStories.has(item.id)}
                >
                  <Text style={{ fontSize: 14, marginRight: 2 }}>
                    👍
                  </Text>
                  <Text style={[
                    styles.reactionText,
                    item.user_reaction === 'like' && styles.reactionTextActive
                  ]}>
                    {item.likes || 0}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.reactionButton,
                    styles.dislikeButton,
                    item.user_reaction === 'dislike' && styles.reactionButtonActive
                  ]}
                  onPress={() => handleReaction(item, 'dislike')}
                  disabled={reactingStories.has(item.id)}
                >
                  <Text style={{ fontSize: 14, marginRight: 2 }}>
                    👎
                  </Text>
                  <Text style={[
                    styles.reactionText,
                    item.user_reaction === 'dislike' && styles.reactionTextActive
                  ]}>
                    {item.dislikes || 0}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.actionButton,
                item.progress ? styles.continueButton : styles.startButton
              ]}
              onPress={() => handleStoryAction(item)}
            >
              <Text style={styles.actionButtonText}>
                {item.progress ? 'Continue' : 'Read'}
            </Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons based on ownership and tab */}
          {isMyStory ? (
            <View style={styles.creatorActions}>
              <TouchableOpacity
                style={[styles.creatorButton, styles.editButton]}
                onPress={() => handleEditStory(item)}
              >
                <IconSymbol name="pencil" size={16} color="#FFFFFF" />
                <Text style={styles.creatorButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.creatorButton, styles.addPartButton]}
                onPress={() => handleAddPart(item)}
              >
                <IconSymbol name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.creatorButtonText}>Add Part</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.creatorButton, styles.previewButton]}
                onPress={() => handlePreviewStory(item.id)}
              >
                <IconSymbol name="eye" size={16} color="#FFFFFF" />
                <Text style={styles.creatorButtonText}>Preview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.creatorButton, styles.deleteButton]}
                onPress={() => handleDeleteStory(item)}
              >
                <Text style={{ fontSize: 14, marginRight: 4 }}>🗑️</Text>
                <Text style={styles.creatorButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionButton,
                item.progress ? styles.continueButton : styles.startButton
              ]}
              onPress={() => handleStoryAction(item)}
            >
              <Text style={styles.actionButtonText}>
                {item.progress ? 'Continue' : 'Start'}
              </Text>
            </TouchableOpacity>
          )}

          {/* View Reactions and Ratings Links */}
          {(item.likes || 0) > 0 || (item.dislikes || 0) > 0 ? (
            <TouchableOpacity
              style={styles.viewReactionsLink}
              onPress={() => loadUserDetails(item, 'reactions')}>
              <Text style={styles.viewReactionsText}>
                View {(item.likes || 0) + (item.dislikes || 0)} reaction{(item.likes || 0) + (item.dislikes || 0) !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          ) : null}

          {(item.total_ratings || 0) > 0 ? (
            <TouchableOpacity
              style={styles.viewRatingsLink}
              onPress={() => loadUserDetails(item, 'ratings')}>
              <Text style={styles.viewRatingsText}>View all ratings</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const handleStoryAction = (story: StoryWithProgress) => {
    // Always go to detail/preview page first
    router.push(`../story-detail/${story.id}` as any);
  };

  const renderStars = (rating: number, size: number = 12) => {
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

  const handleCreateStory = () => {
    router.push('../story-create' as any);
  };

  const handleAddPart = (story: StoryWithProgress) => {
    console.log('handleAddPart called for story:', story.id, 'published:', story.is_published, 'author:', story.author_id, 'user:', user?.id);

    // Only allow adding parts to user's own stories
    if (story.author_id !== user?.id) {
      console.log('Not author of story');
      return;
    }

    // Open modal for input
    setSelectedStoryForPart(story);
    setPartContent('');
    setAddPartModalVisible(true);
  };

  const handleAddPartSubmit = async () => {
    if (!selectedStoryForPart || !partContent.trim()) {
      return;
    }

    try {
      console.log('Inserting story part for story:', selectedStoryForPart.id, 'user:', user?.id);

      // Check if this story has any parts already
      const { data: existingParts, error: checkError } = await supabase
        .from('story_parts')
        .select('id')
        .eq('story_id', selectedStoryForPart.id)
        .limit(1);

      if (checkError) {
        console.error('Error checking existing parts:', checkError);
      }

      const hasExistingParts = existingParts && existingParts.length > 0;
      const shouldMarkAsStart = !hasExistingParts; // Mark as start if it's the first part

      console.log('Has existing parts:', hasExistingParts, 'Should mark as start:', shouldMarkAsStart);

      const { error } = await supabase
        .from('story_parts')
        .insert({
          story_id: selectedStoryForPart.id,
          content: partContent.trim(),
          is_start: shouldMarkAsStart, // Mark as start if it's the first part
          is_ending: false,
          created_by: user?.id,
        });

      console.log('Insert result error:', error);

      if (error) {
        console.error('Insert failed:', error);
        throw error;
      }

      console.log('Story part inserted successfully, marked as start:', shouldMarkAsStart);

      // Close modal and reload stories
      setAddPartModalVisible(false);
      setSelectedStoryForPart(null);
      loadStories();

      Alert.alert('Success', shouldMarkAsStart
        ? 'First story part added successfully! This will be the starting point of your story.'
        : 'Story part added successfully! An admin will review and add choices to make it interactive.');
    } catch (error) {
      console.error('Error adding story part:', error);
      Alert.alert('Error', `Failed to add story part: ${error.message || 'Unknown error'}`);
    }
  };

  const handleEditStory = (story: StoryWithProgress) => {
    setEditingStory(story);
    setEditTitle(story.title);
    setEditDescription(story.description || '');
    setEditGenre(story.genre || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStory || savingEdit) return;

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
        .eq('id', editingStory.id)
        .eq('author_id', user?.id);

      if (error) throw error;

      // Reload stories to reflect changes
      loadStories();
      setEditModalVisible(false);
      setEditingStory(null);
      Alert.alert('Success', 'Story updated successfully');
    } catch (error) {
      console.error('Error updating story:', error);
      Alert.alert('Error', 'Failed to update story');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStory = async (story: StoryWithProgress) => {
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
                .eq('id', story.id);

              if (error) throw error;

              // Reload stories
              loadStories();
              Alert.alert('Success', 'Story deleted successfully');
            } catch (error) {
              console.error('Error deleting story:', error);
              Alert.alert('Error', 'Failed to delete story');
            }
          }
        }
      ]
    );
  };

  const handlePreviewStory = (storyId: string) => {
    router.push(`../story-reading/${storyId}?preview=true` as any);
  };

  const handleReaction = async (story: StoryWithProgress, reactionType: 'like' | 'dislike') => {
    if (!user?.id || reactingStories.has(story.id)) return;

    try {
      setReactingStories(prev => new Set(prev).add(story.id));

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
        setStories(prev => prev.map(s =>
          s.id === story.id
            ? {
                ...s,
                likes: reactionType === 'like' ? (s.likes || 0) - 1 : (s.likes || 0),
                dislikes: reactionType === 'dislike' ? (s.dislikes || 0) - 1 : (s.dislikes || 0),
                user_reaction: undefined
              }
            : s
        ));
        setMyStories(prev => prev.map(s =>
          s.id === story.id
            ? {
                ...s,
                likes: reactionType === 'like' ? (s.likes || 0) - 1 : (s.likes || 0),
                dislikes: reactionType === 'dislike' ? (s.dislikes || 0) - 1 : (s.dislikes || 0),
                user_reaction: undefined
              }
            : s
        ));
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
        setStories(prev => prev.map(s =>
          s.id === story.id
            ? {
                ...s,
                likes: reactionType === 'like'
                  ? (currentReaction === 'dislike' ? (s.likes || 0) + 1 : (s.likes || 0) + (currentReaction ? 0 : 1))
                  : (currentReaction === 'like' ? (s.likes || 0) - 1 : (s.likes || 0)),
                dislikes: reactionType === 'dislike'
                  ? (currentReaction === 'like' ? (s.dislikes || 0) + 1 : (s.dislikes || 0) + (currentReaction ? 0 : 1))
                  : (currentReaction === 'dislike' ? (s.dislikes || 0) - 1 : (s.dislikes || 0)),
                user_reaction: reactionType
              }
            : s
        ));
        setMyStories(prev => prev.map(s =>
          s.id === story.id
            ? {
                ...s,
                likes: reactionType === 'like'
                  ? (currentReaction === 'dislike' ? (s.likes || 0) + 1 : (s.likes || 0) + (currentReaction ? 0 : 1))
                  : (currentReaction === 'like' ? (s.likes || 0) - 1 : (s.likes || 0)),
                dislikes: reactionType === 'dislike'
                  ? (currentReaction === 'like' ? (s.dislikes || 0) + 1 : (s.dislikes || 0) + (currentReaction ? 0 : 1))
                  : (currentReaction === 'dislike' ? (s.dislikes || 0) - 1 : (s.dislikes || 0)),
                user_reaction: reactionType
              }
            : s
        ));
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      Alert.alert('Error', 'Failed to update reaction');
    } finally {
      setReactingStories(prev => {
        const newSet = new Set(prev);
        newSet.delete(story.id);
        return newSet;
      });
    }
  };

  const loadUserDetails = async (story: StoryWithProgress, viewType: 'reactions' | 'ratings') => {
    try {
      setLoadingUserDetails(true);
      setViewingReactionsStory(viewType === 'reactions' ? story : null);
      setViewingRatingsStory(viewType === 'ratings' ? story : null);

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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
        <Text style={styles.loadingText}>Loading stories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Interactive Stories</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateStory}>
            <IconSymbol name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <IconSymbol name="magnifyingglass" size={16} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search stories..."
              placeholderTextColor="#8E8E93"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={16} color="#8E8E93" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Controls */}
        <View style={styles.filterContainer}>
          <View style={styles.sortContainer}>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
              onPress={() => setSortBy('newest')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'newest' && styles.sortButtonTextActive]}>
                Newest
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'popular' && styles.sortButtonActive]}
              onPress={() => setSortBy('popular')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'popular' && styles.sortButtonTextActive]}>
                Popular
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'rating' && styles.sortButtonActive]}
              onPress={() => setSortBy('rating')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'rating' && styles.sortButtonTextActive]}>
                Top Rated
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Text style={{ fontSize: 16 }}>⚙️</Text>
            <Text style={styles.filterButtonText}>
              {selectedGenre === 'all' ? 'All Genres' : selectedGenre}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'my'
            ? 'Create and manage your interactive stories'
            : 'Choose your own adventure and shape the story'
          }
        </Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'all' && styles.activeTabButton]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All Stories
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my' && styles.activeTabButton]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
            My Stories
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredStories}
        renderItem={renderStoryCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name={activeTab === 'my' ? "plus.circle" : "book"} size={64} color="#8E8E93" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'my' ? 'No Stories Created Yet' : 'No Stories Available'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'my'
                ? 'Create your first interactive story to get started!'
                : 'Check back later for new interactive stories!'
              }
            </Text>
            {activeTab === 'my' && (
              <TouchableOpacity style={styles.createStoryPrompt} onPress={handleCreateStory}>
                <Text style={styles.createStoryPromptText}>Create Your First Story</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Add Part Modal */}
      <Modal
        visible={addPartModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAddPartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Story Part</Text>
            <Text style={styles.modalSubtitle}>
              Enter the content for the new part of your story:
            </Text>

            <TextInput
              style={styles.modalTextInput}
              value={partContent}
              onChangeText={setPartContent}
              placeholder="Enter your story content here..."
              placeholderTextColor="#8E8E93"
              multiline={true}
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAddPartModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleAddPartSubmit}
              >
                <Text style={styles.submitButtonText}>Add Part</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Story Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <IconSymbol name="pencil" size={24} color="#C4A574" />
              <Text style={styles.modalTitle}>Edit Story</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeButton}
              >
                <IconSymbol name="xmark" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>✏️</Text>
                  <Text style={styles.inputLabel}>Title *</Text>
                </View>
                <TextInput
                  style={[styles.modalTextInput, styles.titleInput]}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Enter an engaging story title..."
                  placeholderTextColor="#8E8E93"
                  maxLength={100}
                />
                <Text style={styles.charCount}>{editTitle.length}/100</Text>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>💬</Text>
                  <Text style={styles.inputLabel}>Description</Text>
                </View>
                <TextInput
                  style={[styles.modalTextInput, styles.descriptionInput]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Describe your story's premise, setting, and main character..."
                  placeholderTextColor="#8E8E93"
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text style={styles.charCount}>{editDescription.length}/500</Text>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>🏷️</Text>
                  <Text style={styles.inputLabel}>Genre</Text>
                </View>
                <TextInput
                  style={[styles.modalTextInput, styles.genreInput]}
                  value={editGenre}
                  onChangeText={setEditGenre}
                  placeholder="e.g., Fantasy, Mystery, Romance, Sci-Fi..."
                  placeholderTextColor="#8E8E93"
                  maxLength={50}
                />
                <Text style={styles.genreHint}>
                  Choose a genre that best describes your story
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <IconSymbol name="xmark" size={16} color="#8E8E93" />
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
                  <>
                    <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Stories</Text>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Genre</Text>
              <TouchableOpacity
                style={[styles.genreOption, selectedGenre === 'all' && styles.genreOptionSelected]}
                onPress={() => setSelectedGenre('all')}
              >
                <Text style={[styles.genreOptionText, selectedGenre === 'all' && styles.genreOptionTextSelected]}>
                  All Genres
                </Text>
              </TouchableOpacity>
              {['Fantasy', 'Mystery', 'Adventure', 'Romance', 'Sci-Fi', 'Horror', 'Comedy', 'Drama'].map((genre) => (
                <TouchableOpacity
                  key={genre}
                  style={[styles.genreOption, selectedGenre === genre && styles.genreOptionSelected]}
                  onPress={() => setSelectedGenre(genre)}
                >
                  <Text style={[styles.genreOptionText, selectedGenre === genre && styles.genreOptionTextSelected]}>
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.saveButtonText}>Apply Filters</Text>
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
                          <Text style={styles.summaryText}>{reaction.users?.name || 'Anonymous'}</Text>
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
                          <Text style={styles.summaryText}>{rating.users?.name || 'Anonymous'}</Text>
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
    </View>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E8D5B7',
  },
  createButton: {
    backgroundColor: '#C4A574',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#C4A574',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  simpleStoryCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  simpleCardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  publishedBadge: {
    backgroundColor: '#4CAF50',
  },
  draftBadge: {
    backgroundColor: '#FF9800',
  },
  pendingBadge: {
    backgroundColor: '#2196F3',
  },
  rejectedBadge: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  storyDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  authorText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#C4A574',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  creatorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 16, // Extra margin for mobile navigation
  },
  creatorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  previewButton: {
    backgroundColor: '#9C27B0',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  addPartButton: {
    backgroundColor: '#4CAF50',
  },
  creatorButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8D5B7',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
  createStoryPrompt: {
    backgroundColor: '#C4A574',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  createStoryPromptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 0,
    width: '95%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E8D5B7',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  modalScroll: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#C4A574',
    marginBottom: 16,
  },
  modalTextInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 16,
    color: '#E8D5B7',
    fontSize: 16,
    minHeight: 50,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 8,
  },
  saveButtonText: {
    color: '#E8D5B7',
    fontSize: 16,
    fontWeight: '600',
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  descriptionInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  genreInput: {
    fontSize: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
  },
  genreHint: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
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
  submitButton: {
    backgroundColor: '#C4A574',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Search bar styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#E8D5B7',
    fontSize: 16,
  },

  // Enhanced card styles
  genreContainer: {
    marginTop: 4,
  },
  genreText: {
    color: '#C4A574',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaContainer: {
    flex: 1,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#2C2C2E',
    gap: 4,
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
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  reactionTextActive: {
    color: '#FFFFFF',
  },
  viewReactionsLink: {
    marginTop: 8,
    paddingVertical: 4,
  },
  viewReactionsText: {
    fontSize: 13,
    color: '#C4A574',
    textAlign: 'center',
  },
  viewRatingsLink: {
    marginTop: 4,
    paddingVertical: 4,
  },
  viewRatingsText: {
    fontSize: 13,
    color: '#C4A574',
    textAlign: 'center',
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
  summaryText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
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

  // Filter styles
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#2C2C2E',
  },
  sortButtonActive: {
    backgroundColor: '#C4A574',
    borderColor: '#C4A574',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#C4A574',
    fontWeight: '500',
  },

  // Modal filter styles
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 16,
  },
  genreOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    marginBottom: 8,
  },
  genreOptionSelected: {
    backgroundColor: '#C4A574',
  },
  genreOptionText: {
    fontSize: 16,
    color: '#E8D5B7',
  },
  genreOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
