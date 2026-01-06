import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface Story {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  is_published: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  genre: string | null;
  created_at: string;
  updated_at: string;
  users: {
    name: string;
  };
  story_parts?: StoryPart[];
  average_rating: number;
  total_ratings: number;
  likes?: number;
  dislikes?: number;
  user_reaction?: 'like' | 'dislike' | null;
  user_rating?: number | null;
}

interface StoryPart {
  id: string;
  content: string;
  is_start: boolean;
  is_ending: boolean;
  choices?: StoryChoice[];
}

interface StoryChoice {
  id: string;
  choice_text: string;
  next_part_id: string | null;
  order_index: number;
}

export default function StoryManagementScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [stories, setStories] = useState<Story[]>([]);
  const [filteredStories, setFilteredStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [updating, setUpdating] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'under_review' | 'published'>('all');
  const [authorFilter, setAuthorFilter] = useState<string | null>('all');
  const [genreFilter, setGenreFilter] = useState<string | null>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | 'unrated' | '1+' | '2+' | '3+' | '4+' | '5'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating_high' | 'rating_low' | 'most_rated'>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [selectedStoryForUsers, setSelectedStoryForUsers] = useState<Story | null>(null);
  const [userReactions, setUserReactions] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [detailsViewType, setDetailsViewType] = useState<'reactions' | 'ratings' | 'all'>('all');



  useEffect(() => {
    loadStories();
  }, []);

  // Real-time subscription for story reactions and ratings
  useEffect(() => {
    const subscription = supabase
      .channel('admin-stories-reactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_reactions' }, () => {
        // Reload stories to get updated reaction counts
        loadStories();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_ratings' }, () => {
        // Reload stories to get updated rating data
        loadStories();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        // Reload stories when story data changes
        loadStories();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Filter stories based on search and filter criteria
  useEffect(() => {
    let filtered = [...stories];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(story =>
        story.title.toLowerCase().includes(query) ||
        story.description?.toLowerCase().includes(query) ||
        story.users?.name.toLowerCase().includes(query) ||
        story.genre?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'under_review') {
        filtered = filtered.filter(story => !story.is_published);
      } else if (statusFilter === 'published') {
        filtered = filtered.filter(story => story.is_published);
      }
    }

    // Author filter
    if (authorFilter !== 'all') {
      filtered = filtered.filter(story => story.author_id === authorFilter);
    }

    // Genre filter
    if (genreFilter !== 'all') {
      filtered = filtered.filter(story => story.genre === genreFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(story => {
        const createdDate = new Date(story.created_at);
        if (dateFilter === 'today') {
          return createdDate >= today;
        } else if (dateFilter === 'week') {
          return createdDate >= weekAgo;
        } else if (dateFilter === 'month') {
          return createdDate >= monthAgo;
        }
        return true;
      });
    }

    // Rating filter
    if (ratingFilter !== 'all') {
      filtered = filtered.filter(story => {
        if (ratingFilter === 'unrated') {
          return story.total_ratings === 0;
        } else if (ratingFilter === '1+') {
          return story.average_rating >= 1;
        } else if (ratingFilter === '2+') {
          return story.average_rating >= 2;
        } else if (ratingFilter === '3+') {
          return story.average_rating >= 3;
        } else if (ratingFilter === '4+') {
          return story.average_rating >= 4;
        } else if (ratingFilter === '5') {
          return story.average_rating === 5;
        }
        return true;
      });
    }

    // Sort stories
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'rating_high':
          return b.average_rating - a.average_rating;
        case 'rating_low':
          return a.average_rating - b.average_rating;
        case 'most_rated':
          return b.total_ratings - a.total_ratings;
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredStories(filtered);
  }, [stories, searchQuery, statusFilter, authorFilter, genreFilter, dateFilter, ratingFilter, sortBy]);

  const loadStories = useCallback(async () => {
    try {
      setLoading(true);

      // First get stories
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select(`
          *,
          users!author_id(name)
        `)
        .order('updated_at', { ascending: false });

      if (storiesError) throw storiesError;

      // Then get ratings, reactions, and admin's personal data for each story
      const storiesWithRatings = await Promise.all(
        (storiesData || []).map(async (story) => {
          // Get ratings
          const { data: ratings, error: ratingsError } = await supabase
            .from('story_ratings')
            .select('rating')
            .eq('story_id', story.id);

          if (ratingsError) {
            console.error('Error fetching ratings for story:', story.id, ratingsError);
          }

          const totalRatings = ratings?.length || 0;
          const averageRating = totalRatings > 0
            ? ratings!.reduce((sum, r) => sum + r.rating, 0) / totalRatings
            : 0;

          // Get reactions
          const { data: reactions, error: reactionsError } = await supabase
            .from('story_reactions')
            .select('reaction_type')
            .eq('story_id', story.id);

          if (reactionsError) {
            console.error('Error fetching reactions for story:', story.id, reactionsError);
          }

          const likes = reactions?.filter(r => r.reaction_type === 'like').length || 0;
          const dislikes = reactions?.filter(r => r.reaction_type === 'dislike').length || 0;

          // Get admin's personal reaction
          const { data: adminReaction } = await supabase
            .from('story_reactions')
            .select('reaction_type')
            .eq('user_id', user?.id)
            .eq('story_id', story.id)
            .single();

          // Get admin's personal rating
          const { data: adminRating } = await supabase
            .from('story_ratings')
            .select('rating')
            .eq('user_id', user?.id)
            .eq('story_id', story.id)
            .single();

          return {
            ...story,
            average_rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
            total_ratings: totalRatings,
            likes: likes,
            dislikes: dislikes,
            user_reaction: adminReaction?.reaction_type || null,
            user_rating: adminRating?.rating || null,
          };
        })
      );

      setStories(storiesWithRatings);
      setFilteredStories(storiesWithRatings);
    } catch (error) {
      console.error('Error loading stories:', error);
      Alert.alert('Error', 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleStoryExpansion = (storyId: string) => {
    const newExpanded = new Set(expandedStories);
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId);
    } else {
      newExpanded.add(storyId);
    }
    setExpandedStories(newExpanded);
  };


  const handleStoryReview = (story: Story) => {
    // Navigate to single story view for detailed review
    router.push(`../story-review/${story.id}` as any);
  };

  const handleStoryAction = async (story: Story, action: 'publish' | 'reject') => {
    try {
      let updateData: any = {
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      };

      if (action === 'publish') {
        updateData.is_published = true;
      } else if (action === 'reject') {
        updateData.is_published = false; // Explicitly set to false for rejected stories
      }

      const { error } = await supabase
        .from('stories')
        .update(updateData)
        .eq('id', story.id);

      if (error) throw error;

      // Log the action in audit log
      await supabase
        .from('story_audit_log')
        .insert({
          story_id: story.id,
          action: action,
          performed_by: user?.id,
        });

      Alert.alert('Success', `Story ${action}ed successfully`);
      loadStories();
    } catch (error) {
      console.error(`Error ${action}ing story:`, error);
      Alert.alert('Error', `Failed to ${action} story`);
    }
  };

  const handleEditStory = (story: Story) => {
    setEditingStory(story);
    setEditTitle(story.title);
    setEditDescription(story.description || '');
    setEditGenre(story.genre || '');
    setEditModalVisible(true);
  };

  const handleUpdateStory = async () => {
    if (!editingStory || updating) return;

    if (!editTitle.trim()) {
      Alert.alert('Error', 'Please enter a story title');
      return;
    }

    try {
      setUpdating(true);

              const { error } = await supabase
        .from('stories')
                .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          genre: editGenre.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingStory.id);

              if (error) throw error;

      // Log the changes
      if (editingStory.title !== editTitle.trim()) {
              await supabase
                .from('story_audit_log')
                .insert({
            story_id: editingStory.id,
                  action: 'update',
            field_changed: 'title',
            old_value: editingStory.title,
            new_value: editTitle.trim(),
                  performed_by: user?.id,
                });
      }

      if ((editingStory.description || '') !== editDescription.trim()) {
        await supabase
          .from('story_audit_log')
          .insert({
            story_id: editingStory.id,
            action: 'update',
            field_changed: 'description',
            old_value: editingStory.description || '',
            new_value: editDescription.trim(),
            performed_by: user?.id,
          });
      }

      if ((editingStory.genre || '') !== editGenre.trim()) {
        await supabase
          .from('story_audit_log')
          .insert({
            story_id: editingStory.id,
            action: 'update',
            field_changed: 'genre',
            old_value: editingStory.genre || '',
            new_value: editGenre.trim(),
            performed_by: user?.id,
          });
      }

      setEditModalVisible(false);
      setEditingStory(null);
      setEditTitle('');
      setEditDescription('');
      setEditGenre('');

      loadStories();

      Alert.alert('Success', 'Story updated successfully');
            } catch (error) {
      console.error('Error updating story:', error);
      Alert.alert('Error', 'Failed to update story');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteStory = (story: Story) => {
    Alert.alert(
      'Delete Story',
      `Are you sure you want to delete "${story.title}"? This will permanently remove the story and all its parts and choices.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all part IDs for this story first
              const { data: parts } = await supabase
                .from('story_parts')
                .select('id')
                .eq('story_id', story.id);

              const partIds = parts?.map(part => part.id) || [];

              // Delete story choices first if there are any parts
              if (partIds.length > 0) {
                await supabase
                .from('story_choices')
                .delete()
                  .in('part_id', partIds);
              }

              // Delete story parts
              await supabase
                .from('story_parts')
                .delete()
                .eq('story_id', story.id);

              // Delete the story
              const { error } = await supabase
                .from('stories')
                .delete()
                .eq('id', story.id);

              if (error) throw error;

              // Log the deletion
              await supabase
                .from('story_audit_log')
                .insert({
                  story_id: story.id,
                  action: 'delete_story',
                  performed_by: user?.id,
                });

              Alert.alert('Success', 'Story deleted successfully');
              loadStories();
            } catch (error) {
              console.error('Error deleting story:', error);
              Alert.alert('Error', 'Failed to delete story');
            }
          }
        }
      ]
    );
  };






  const loadUserDetails = async (story: Story, viewType: 'reactions' | 'ratings' | 'all' = 'all') => {
    try {
      setLoadingUserDetails(true);
      setSelectedStoryForUsers(story);
      setDetailsViewType(viewType);

      if (viewType === 'reactions' || viewType === 'all') {
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
      }

      if (viewType === 'ratings' || viewType === 'all') {
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
      }

      setShowUserDetails(true);
    } catch (error) {
      console.error('Error loading user details:', error);
      Alert.alert('Error', 'Failed to load user details');
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const renderStoryItem = ({ item }: { item: Story }) => {
    const isExpanded = expandedStories.has(item.id);

    return (
      <View style={styles.storyCard}>
        <TouchableOpacity
          style={styles.storyHeader}
          onPress={() => toggleStoryExpansion(item.id)}
        >
          <View style={styles.storyInfo}>
            <Text style={styles.storyTitle}>{item.title}</Text>
            <Text style={styles.storyAuthor}>by {item.users.name}</Text>
            <Text style={styles.storyMeta}>
              Status: {item.is_published ? 'Published' : 'Pending Review'} • Submitted: {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'N/A'}
            </Text>
            <View style={styles.ratingContainer}>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <IconSymbol
                    key={star}
                    name={star <= Math.floor(item.average_rating) ? "star.fill" : star <= item.average_rating ? "star.leadinghalf.filled" : "star"}
                    size={14}
                    color="#FFD700"
                  />
                ))}
          </View>
              <Text style={styles.ratingText}>
                {item.average_rating > 0 ? `${item.average_rating.toFixed(1)} (${item.total_ratings})` : 'No ratings'}
              </Text>
            </View>
            <IconSymbol
              name={isExpanded ? "chevron.up" : "chevron.down"}
              size={20}
              color="#C4A574"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.storyDetails}>
            {item.description && (
              <Text style={styles.storyDescription}>{item.description}</Text>
            )}


            {/* Action Buttons */}
            <View style={styles.expandedActions}>
            <TouchableOpacity
                style={[styles.actionButton, styles.reviewButton]}
                onPress={() => handleStoryReview(item)}
              >
                <Text style={styles.actionButtonText}>Review</Text>
            </TouchableOpacity>
                        <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleEditStory(item)}
                        >
                <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>
                              <TouchableOpacity
                style={[styles.actionButton, styles.publishButton]}
                onPress={() => handleStoryAction(item, 'publish')}
                              >
                <Text style={styles.actionButtonText}>Publish</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleStoryAction(item, 'reject')}
              >
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteStoryButton]}
                onPress={() => handleDeleteStory(item)}
              >
                <Text style={styles.actionButtonText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
          </View>
        )}
      </View>
    );
  };

  // Get unique authors and genres for filter dropdowns
  const uniqueAuthors = Array.from(new Set(stories.map(s => s.author_id)))
    .map(authorId => {
      const story = stories.find(s => s.author_id === authorId);
      return { id: authorId, name: story?.users?.name || 'Unknown' };
    });

  const uniqueGenres = Array.from(new Set(stories.map(s => s.genre).filter(Boolean)));

    return (
      <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C4A574" />
          <Text style={styles.loadingText}>Loading stories...</Text>
        </View>
      ) : (
        <View>
      <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <IconSymbol name="book.fill" size={24} color="#E8D5B7" />
        <Text style={styles.headerTitle}>Story Management</Text>
              <TouchableOpacity
                style={styles.createStoryButton}
                onPress={() => router.push('../story-create' as any)}
              >
                <IconSymbol name="plus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        <Text style={styles.headerSubtitle}>Review and manage user-submitted stories</Text>

          {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <IconSymbol name="magnifyingglass" size={16} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by title, description, author, or genre..."
            placeholderTextColor="#8E8E93"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color="#8E8E93" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Sort Options */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
          {[
            { key: 'newest', label: 'Newest' },
            { key: 'oldest', label: 'Oldest' },
            { key: 'rating_high', label: 'Highest Rated' },
            { key: 'rating_low', label: 'Lowest Rated' },
            { key: 'most_rated', label: 'Most Rated' },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.sortChip, sortBy === option.key && styles.activeSortChip]}
              onPress={() => setSortBy(option.key as any)}
            >
              <Text style={[styles.sortChipText, sortBy === option.key && styles.activeSortChipText]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'all' && styles.activeFilterChip]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'all' && styles.activeFilterChipText]}>
              All ({stories.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'under_review' && styles.activeFilterChip]}
            onPress={() => setStatusFilter('under_review')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'under_review' && styles.activeFilterChipText]}>
              Under Review ({stories.filter(s => !s.is_published).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'published' && styles.activeFilterChip]}
            onPress={() => setStatusFilter('published')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'published' && styles.activeFilterChipText]}>
              Published ({stories.filter(s => s.is_published).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <IconSymbol name="line.horizontal.3.decrease.circle" size={16} color="#C4A574" />
            <Text style={styles.filterButtonText}>More Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredStories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="magnifyingglass" size={64} color="#8E8E93" />
            <Text style={styles.emptyTitle}>No stories found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || statusFilter !== 'all' || authorFilter !== 'all' || genreFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No stories available for review'
              }
            </Text>
          </View>
        }
      />

      {/* Filters Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFilters}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <IconSymbol name="xmark" size={24} color="#E8D5B7" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Author Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Author</Text>
                <TouchableOpacity
                  style={[styles.filterOption, authorFilter === 'all' && styles.activeFilterOption]}
                  onPress={() => setAuthorFilter('all')}
                >
                  <Text style={[styles.filterOptionText, authorFilter === 'all' && styles.activeFilterOptionText]}>
                    All Authors
                  </Text>
                </TouchableOpacity>
                {uniqueAuthors.map((author) => (
                  <TouchableOpacity
                    key={author.id}
                    style={[styles.filterOption, authorFilter === author.id && styles.activeFilterOption]}
                    onPress={() => setAuthorFilter(author.id)}
                  >
                    <Text style={[styles.filterOptionText, authorFilter === author.id && styles.activeFilterOptionText]}>
                      {author.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Genre Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Genre</Text>
                <TouchableOpacity
                  style={[styles.filterOption, genreFilter === 'all' && styles.activeFilterOption]}
                  onPress={() => setGenreFilter('all')}
                >
                  <Text style={[styles.filterOptionText, genreFilter === 'all' && styles.activeFilterOptionText]}>
                    All Genres
                  </Text>
                </TouchableOpacity>
                {uniqueGenres.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={[styles.filterOption, genreFilter === genre && styles.activeFilterOption]}
                    onPress={() => setGenreFilter(genre)}
                  >
                    <Text style={[styles.filterOptionText, genreFilter === genre && styles.activeFilterOptionText]}>
                      {genre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Created</Text>
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterOption, dateFilter === option.key && styles.activeFilterOption]}
                    onPress={() => setDateFilter(option.key as any)}
                  >
                    <Text style={[styles.filterOptionText, dateFilter === option.key && styles.activeFilterOptionText]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Rating Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Rating</Text>
                {[
                  { key: 'all', label: 'All Ratings' },
                  { key: 'unrated', label: 'Unrated' },
                  { key: '1+', label: '1+ Stars' },
                  { key: '2+', label: '2+ Stars' },
                  { key: '3+', label: '3+ Stars' },
                  { key: '4+', label: '4+ Stars' },
                  { key: '5', label: '5 Stars' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterOption, ratingFilter === option.key && styles.activeFilterOption]}
                    onPress={() => setRatingFilter(option.key as any)}
                  >
                    <Text style={[styles.filterOptionText, ratingFilter === option.key && styles.activeFilterOptionText]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setAuthorFilter('all');
                  setGenreFilter('all');
                  setDateFilter('all');
                  setRatingFilter('all');
                }}
              >
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyFiltersButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyFiltersText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </Modal>
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
  },
  loadingText: {
    color: '#E8D5B7',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8D5B7',
  },
  createStoryButton: {
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
  listContainer: {
    padding: 20,
    paddingBottom: 140, // Extra bottom padding to clear navigation bar and ensure last items are fully visible
  },
  storyCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  storyHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  storyInfo: {
    flex: 1,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 4,
  },
  storyAuthor: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  storyMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 12,
    color: '#E8D5B7',
    fontWeight: '500',
  },
  storyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  reviewButton: {
    backgroundColor: '#2196F3',
  },
  publishButton: {
    backgroundColor: '#2196F3',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  viewUsersButton: {
    backgroundColor: '#9C27B0',
  },
  deleteStoryButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  storyDetails: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3A3A3C',
  },
  expandedActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingTop: 8,
  },
  storyDescription: {
    fontSize: 14,
    color: '#E8D5B7',
    marginBottom: 16,
    lineHeight: 20,
  },

  // Search and Filter Styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  sortBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 8,
  },
  sortScroll: {
    flexDirection: 'row',
  },
  sortChip: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeSortChip: {
    backgroundColor: '#C4A574',
  },
  sortChipText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeSortChipText: {
    color: '#FFFFFF',
  },
  filterBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#C4A574',
  },
  filterChipText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#C4A574',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#C4A574',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Modal Styles
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 12,
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    marginBottom: 8,
  },
  activeFilterOption: {
    backgroundColor: '#C4A574',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#E8D5B7',
  },
  activeFilterOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
  },
  clearFiltersButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8E8E93',
  },
  clearFiltersText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  applyFiltersButton: {
    backgroundColor: '#C4A574',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyFiltersText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Choice Modal Styles
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
  modalPartsList: {
    maxHeight: 200,
  },
  partOption: {
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPartOption: {
    borderColor: '#C4A574',
    backgroundColor: '#3C3C3E',
  },
  partOptionText: {
    color: '#E8D5B7',
    fontSize: 14,
  },
  selectedPartOptionText: {
    color: '#C4A574',
    fontWeight: '600',
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
    backgroundColor: '#3A3A3C',
  },
  submitButton: {
    backgroundColor: '#C4A574',
  },
  cancelButtonText: {
    color: '#E8D5B7',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 16,
  },

  // User Details Modal Styles
  userDetailsSection: {
    marginBottom: 24,
  },
  userDetailItem: {
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  userDetailInfo: {
    flex: 1,
  },
  userDetailName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 4,
  },
  userDetailMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingValue: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 4,
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },

  // Checkbox styles for edit modals
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
