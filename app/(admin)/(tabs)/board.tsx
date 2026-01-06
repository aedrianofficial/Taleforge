import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const MAX_CHARACTERS = 500;
const REACTION_COOLDOWN = 1500; // 1.5 seconds

type FilterOption = 'newest' | 'highest_rated' | 'most_reacted';

type ReactionType = 'like' | 'heart' | 'laugh' | 'sad' | 'dislike';

type PostReaction = {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  users?: { name: string };
};

type PostRating = {
  id: string;
  post_id: string;
  user_id: string;
  rating: number;
  users?: { name: string };
};

type Post = {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  users?: {
    name: string;
    is_admin: boolean;
    privacy_posts_visible: boolean;
    avatar_url?: string | null;
  };
  post_reactions?: PostReaction[];
  post_ratings?: PostRating[];
};

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
  sad: '😢',
  dislike: '👎',
};

export default function AdminBoardScreen() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postText, setPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Menu state
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  
  // Reactions modal state
  const [reactionsModalVisible, setReactionsModalVisible] = useState(false);
  const [viewingReactionsPost, setViewingReactionsPost] = useState<Post | null>(null);
  
  // Ratings modal state
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false);
  const [viewingRatingsPost, setViewingRatingsPost] = useState<Post | null>(null);
  const [ratingPost, setRatingPost] = useState<Post | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  
  // Cooldown state for reactions
  const [reactionCooldowns, setReactionCooldowns] = useState<Record<string, boolean>>({});
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const toastOpacity = useState(new Animated.Value(0))[0];
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<FilterOption>('newest');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast({ message: '', visible: false }));
  }, [toastOpacity]);

  useEffect(() => {
    fetchAllPosts();

    const postsSubscription = supabase
      .channel('admin-board-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchAllPosts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => {
        fetchAllPosts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_ratings' }, () => {
        fetchAllPosts();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
        // Refresh posts when user profiles are updated (including avatar changes)
        fetchAllPosts();
      })
      .subscribe();

    return () => {
      postsSubscription.unsubscribe();
    };
  }, []);

  const fetchAllPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users(name, is_admin, privacy_posts_visible, avatar_url),
        post_reactions(id, post_id, user_id, reaction_type, users(name)),
        post_ratings(id, post_id, user_id, rating, users(name))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      // Admin can see all posts regardless of privacy settings
      setPosts(data || []);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllPosts();
    setRefreshing(false);
  };

  const handleCreatePost = async () => {
    if (!postText.trim() || !profile?.id) return;
    if (postText.length > MAX_CHARACTERS) {
      Alert.alert('Error', `Post exceeds maximum ${MAX_CHARACTERS} characters`);
      return;
    }

    setIsPosting(true);
    Keyboard.dismiss();

    // Optimistic update - immediately add post to UI
    const optimisticPost: Post = {
      id: `temp-${Date.now()}`, // Temporary ID
      text: postText.trim(),
      created_at: new Date().toISOString(),
      user_id: profile.id,
      users: {
        name: profile.name,
        is_admin: profile.is_admin,
        privacy_posts_visible: profile.privacy_posts_visible ?? true,
        avatar_url: profile.avatar_url
      },
      post_reactions: [],
      post_ratings: []
    };

    // Add to posts state immediately
    setPosts(prevPosts => [optimisticPost, ...prevPosts]);

    // Clear the input immediately for better UX
    setPostText('');
    showToast('Post created successfully!');

    try {
      const { error } = await supabase
        .from('posts')
        .insert([{ text: postText.trim(), user_id: profile.id }]);

      if (error) {
        console.error('Error creating post:', error);
        // Remove optimistic post on error
        setPosts(prevPosts => prevPosts.filter(p => p.id !== optimisticPost.id));
        Alert.alert('Error', 'Failed to create post. Please try again.');
        // Restore the text so user can try again
        setPostText(postText.trim());
      }
      // If successful, real-time subscription will update with real data
    } catch (error) {
      console.error('Error in handleCreatePost:', error);
      // Remove optimistic post on error
      setPosts(prevPosts => prevPosts.filter(p => p.id !== optimisticPost.id));
      Alert.alert('Error', 'Failed to create post. Please try again.');
      // Restore the text so user can try again
      setPostText(postText.trim());
    }

    setIsPosting(false);
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setEditText(post.text);
    setEditModalVisible(true);
    setMenuPostId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editText.trim()) return;
    if (editText.length > MAX_CHARACTERS) {
      Alert.alert('Error', `Post exceeds maximum ${MAX_CHARACTERS} characters`);
      return;
    }

    setIsSaving(true);

    // Optimistic update - immediately update UI
    const originalText = editingPost.text;
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === editingPost.id
          ? { ...p, text: editText.trim() }
          : p
      )
    );

    // Close modal and clear editing state immediately
    setEditModalVisible(false);
    setEditingPost(null);
    showToast('Post updated successfully!');

    try {
      const { error } = await supabase
        .from('posts')
        .update({ text: editText.trim() })
        .eq('id', editingPost.id);

      if (error) {
        console.error('Error updating post:', error);
        // Revert optimistic update on error
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === editingPost.id
              ? { ...p, text: originalText }
              : p
          )
        );
        Alert.alert('Error', 'Failed to update post. Changes have been reverted.');
      }
      // If successful, real-time subscription will confirm the update
    } catch (error) {
      console.error('Error in handleSaveEdit:', error);
      // Revert optimistic update on error
      setPosts(prevPosts =>
        prevPosts.map(p =>
          p.id === editingPost.id
            ? { ...p, text: originalText }
            : p
        )
      );
      Alert.alert('Error', 'Failed to update post. Changes have been reverted.');
    }

    setIsSaving(false);
  };

  const handleDeletePost = (post: Post) => {
    setMenuPostId(null);
    const isOwnPost = profile?.id === post.user_id;
    
    Alert.alert(
      'Delete Post',
      isOwnPost 
        ? 'Are you sure you want to delete this post? This action cannot be undone.'
        : `Are you sure you want to delete this post by ${post.users?.name || 'Unknown'}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update - immediately remove post from UI
            setPosts(prevPosts => prevPosts.filter(p => p.id !== post.id));
            showToast('Post deleted successfully');

            try {
              const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', post.id);

              if (error) {
                console.error('Error deleting post:', error);
                // Revert optimistic update on error - need to refetch to restore
                fetchAllPosts();
                Alert.alert('Error', 'Failed to delete post. Post has been restored.');
              }
              // If successful, real-time subscription will confirm the deletion
            } catch (error) {
              console.error('Error in handleDeletePost:', error);
              // Revert optimistic update on error
              fetchAllPosts();
              Alert.alert('Error', 'Failed to delete post. Post has been restored.');
            }
          },
        },
      ]
    );
  };

  const handleReaction = async (post: Post, reactionType: ReactionType) => {
    if (!profile?.id) return;

    const cooldownKey = `${post.id}-${reactionType}`;
    if (reactionCooldowns[cooldownKey]) return;

    // Set cooldown
    setReactionCooldowns(prev => ({ ...prev, [cooldownKey]: true }));
    setTimeout(() => {
      setReactionCooldowns(prev => ({ ...prev, [cooldownKey]: false }));
    }, REACTION_COOLDOWN);

    const existingReaction = post.post_reactions?.find(
      r => r.user_id === profile.id
    );

    // Optimistic update - immediately update UI
    setPosts(prevPosts => {
      return prevPosts.map(p => {
        if (p.id === post.id) {
          const currentReactions = p.post_reactions || [];
          let updatedReactions;

          if (existingReaction) {
            if (existingReaction.reaction_type === reactionType) {
              // Remove reaction
              updatedReactions = currentReactions.filter(r => r.id !== existingReaction.id);
            } else {
              // Update reaction type
              updatedReactions = currentReactions.map(r =>
                r.id === existingReaction.id
                  ? { ...r, reaction_type: reactionType }
                  : r
              );
            }
          } else {
            // Add new reaction (generate temporary ID for UI update)
            const tempId = `temp-${Date.now()}`;
            updatedReactions = [...currentReactions, {
              id: tempId,
              post_id: post.id,
              user_id: profile.id,
              reaction_type: reactionType,
              users: { name: profile.name }
            }];
          }

          return { ...p, post_reactions: updatedReactions };
        }
        return p;
      });
    });

    // Then sync with server
    try {
      if (existingReaction) {
        if (existingReaction.reaction_type === reactionType) {
          // Remove reaction if same type
          await supabase.from('post_reactions').delete().eq('id', existingReaction.id);
        } else {
          // Update to new reaction type
          await supabase
            .from('post_reactions')
            .update({ reaction_type: reactionType })
            .eq('id', existingReaction.id);
        }
      } else {
        // Add new reaction
        await supabase.from('post_reactions').insert([{
          post_id: post.id,
          user_id: profile.id,
          reaction_type: reactionType,
        }]);
      }
    } catch (error) {
      console.error('Error updating reaction:', error);
      // Revert optimistic update on error by refreshing data
      fetchAllPosts();
    }
  };

  const handleRating = async () => {
    if (!profile?.id || !ratingPost || selectedRating === 0) return;

    const existingRating = ratingPost.post_ratings?.find(r => r.user_id === profile.id);

    // Optimistic update - immediately update UI
    setPosts(prevPosts => {
      return prevPosts.map(p => {
        if (p.id === ratingPost.id) {
          const currentRatings = p.post_ratings || [];
          let updatedRatings;

          if (existingRating) {
            // Update existing rating
            updatedRatings = currentRatings.map(r =>
              r.id === existingRating.id
                ? { ...r, rating: selectedRating }
                : r
            );
          } else {
            // Add new rating (generate temporary ID for UI update)
            const tempId = `temp-rating-${Date.now()}`;
            updatedRatings = [...currentRatings, {
              id: tempId,
              post_id: ratingPost.id,
              user_id: profile.id,
              rating: selectedRating,
              users: { name: profile.name }
            }];
          }

          return { ...p, post_ratings: updatedRatings };
        }
        return p;
      });
    });

    // Then sync with server
    try {
      if (existingRating) {
        await supabase
          .from('post_ratings')
          .update({ rating: selectedRating })
          .eq('id', existingRating.id);
      } else {
        await supabase.from('post_ratings').insert([{
          post_id: ratingPost.id,
          user_id: profile.id,
          rating: selectedRating,
        }]);
      }

      showToast('Rating submitted!');
    } catch (error) {
      console.error('Error updating rating:', error);
      showToast('Failed to submit rating');
      // Revert optimistic update on error
      fetchAllPosts();
    }

    setRatingPost(null);
    setSelectedRating(0);
  };

  const getReactionCounts = (post: Post) => {
    const counts: Record<ReactionType, number> = { like: 0, heart: 0, laugh: 0, sad: 0, dislike: 0 };
    post.post_reactions?.forEach(r => {
      counts[r.reaction_type]++;
    });
    return counts;
  };

  const getUserReaction = (post: Post): ReactionType | null => {
    const reaction = post.post_reactions?.find(r => r.user_id === profile?.id);
    return reaction?.reaction_type || null;
  };

  const getAverageRating = (post: Post) => {
    const ratings = post.post_ratings || [];
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return sum / ratings.length;
  };

  const getUserRating = (post: Post): number => {
    const rating = post.post_ratings?.find(r => r.user_id === profile?.id);
    return rating?.rating || 0;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Admin can edit/delete any post
  const canEditOrDelete = () => {
    return profile?.is_admin === true;
  };

  // Filter and search posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(post => 
        post.text.toLowerCase().includes(query) ||
        post.users?.name?.toLowerCase().includes(query)
      );
    }
    
    // Apply sort filter
    switch (filterOption) {
      case 'highest_rated':
        result.sort((a, b) => {
          const avgA = getAverageRating(a);
          const avgB = getAverageRating(b);
          return avgB - avgA;
        });
        break;
      case 'most_reacted':
        result.sort((a, b) => {
          const reactionsA = a.post_reactions?.length || 0;
          const reactionsB = b.post_reactions?.length || 0;
          return reactionsB - reactionsA;
        });
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    
    return result;
  }, [posts, searchQuery, filterOption]);

  const getFilterLabel = (option: FilterOption): string => {
    switch (option) {
      case 'newest': return 'Newest First';
      case 'highest_rated': return 'Highest Rated';
      case 'most_reacted': return 'Most Reacted';
      default: return 'Newest First';
    }
  };

  const renderSearchAndFilter = () => (
    <View style={styles.searchFilterContainer}>
      <View style={styles.searchInputWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search posts..."
          placeholderTextColor="#6E6E73"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.filterWrapper}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilterDropdown(!showFilterDropdown)}>
          <Text style={styles.filterIcon}>⚙️</Text>
          <Text style={styles.filterButtonText}>{getFilterLabel(filterOption)}</Text>
          <Text style={styles.filterArrow}>{showFilterDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showFilterDropdown && (
          <View style={styles.filterDropdown}>
            {(['newest', 'highest_rated', 'most_reacted'] as FilterOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.filterOption,
                  filterOption === option && styles.filterOptionActive,
                ]}
                onPress={() => {
                  setFilterOption(option);
                  setShowFilterDropdown(false);
                }}>
                <Text style={[
                  styles.filterOptionText,
                  filterOption === option && styles.filterOptionTextActive,
                ]}>
                  {getFilterLabel(option)}
                </Text>
                {filterOption === option && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      
      {(searchQuery || filterOption !== 'newest') && (
        <View style={styles.activeFiltersRow}>
          {searchQuery && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>"{searchQuery}"</Text>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.removeFilterText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {filterOption !== 'newest' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>{getFilterLabel(filterOption)}</Text>
              <TouchableOpacity onPress={() => setFilterOption('newest')}>
                <Text style={styles.removeFilterText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity 
            style={styles.clearAllButton}
            onPress={() => {
              setSearchQuery('');
              setFilterOption('newest');
            }}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <Text style={styles.resultsCount}>
        {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'} found
      </Text>
    </View>
  );

  const renderComposer = () => (
    <View style={styles.composerCard}>
      <View style={styles.composerHeader}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.composerAvatarImage} />
        ) : (
          <View style={styles.composerAvatar}>
            <Text style={styles.composerAvatarText}>
              {(profile?.name || 'A')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.composerUserInfo}>
          <Text style={styles.composerUserName}>{profile?.name || 'Admin'}</Text>
          <View style={styles.adminBadgeComposer}>
            <Text style={styles.adminBadgeTextComposer}>Admin</Text>
          </View>
        </View>
      </View>
      
      <TextInput
        style={styles.composerInput}
        placeholder="Share an announcement or update..."
        placeholderTextColor="#6E6E73"
        multiline
        maxLength={MAX_CHARACTERS}
        value={postText}
        onChangeText={setPostText}
        textAlignVertical="top"
      />
      
      <View style={styles.composerFooter}>
        <Text style={[
          styles.charCounter,
          postText.length > MAX_CHARACTERS * 0.9 && styles.charCounterWarning,
          postText.length >= MAX_CHARACTERS && styles.charCounterError,
        ]}>
          {postText.length}/{MAX_CHARACTERS}
        </Text>
        
        <TouchableOpacity
          style={[styles.postButton, (!postText.trim() || isPosting) && styles.postButtonDisabled]}
          onPress={handleCreatePost}
          disabled={!postText.trim() || isPosting}>
          {isPosting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={[styles.postButtonText, !postText.trim() && styles.postButtonTextDisabled]}>
              Post
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => {
    const reactionCounts = getReactionCounts(item);
    const userReaction = getUserReaction(item);
    const avgRating = getAverageRating(item);
    const userRating = getUserRating(item);
    const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
    const totalRatings = item.post_ratings?.length || 0;
    const isOwnPost = profile?.id === item.user_id;

    return (
    <View style={styles.postCard}>
        {/* Post Header */}
      <View style={styles.postHeader}>
        {item.users?.avatar_url ? (
          <Image 
            source={{ uri: item.users.avatar_url }} 
            style={[styles.avatarImage, item.users?.is_admin && styles.adminAvatarBorder]} 
          />
        ) : (
        <View style={[styles.avatar, item.users?.is_admin && styles.adminAvatar]}>
          <Text style={styles.avatarText}>
            {(item.users?.name || 'U')[0].toUpperCase()}
          </Text>
        </View>
        )}
        <View style={styles.postHeaderInfo}>
            <View style={styles.authorRow}>
            <Text style={styles.authorName}>{item.users?.name || 'Unknown'}</Text>
              <View style={[styles.roleBadgeSmall, item.users?.is_admin && styles.adminBadge]}>
                <Text style={[styles.roleBadgeSmallText, item.users?.is_admin && styles.adminBadgeText]}>
                  {item.users?.is_admin ? 'Admin' : 'User'}
                </Text>
              </View>
          </View>
          <Text style={styles.postDate}>{formatDate(item.created_at)}</Text>
        </View>
          
          {/* Menu Button - Admin can access for all posts */}
          {canEditOrDelete() && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setMenuPostId(menuPostId === item.id ? null : item.id)}>
              <Text style={styles.menuButtonText}>⋮</Text>
            </TouchableOpacity>
          )}
      </View>

        {/* Dropdown Menu */}
        {menuPostId === item.id && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleEditPost(item)}>
              <Text style={styles.menuItemText}>✏️ Edit {!isOwnPost && '(Admin)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleDeletePost(item)}>
              <Text style={[styles.menuItemText, styles.deleteText]}>🗑️ Delete {!isOwnPost && '(Admin)'}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Post Text */}
      <Text style={styles.postText}>{item.text}</Text>
        
        {/* Reactions Bar */}
        <View style={styles.reactionsBar}>
          {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.reactionButton,
                userReaction === type && styles.reactionButtonActive,
                reactionCooldowns[`${item.id}-${type}`] && styles.reactionButtonDisabled,
              ]}
              onPress={() => handleReaction(item, type)}
              disabled={reactionCooldowns[`${item.id}-${type}`]}>
              <Text style={styles.reactionEmoji}>{REACTION_EMOJIS[type]}</Text>
              <Text style={[
                styles.reactionCount,
                userReaction === type && styles.reactionCountActive,
              ]}>
                {reactionCounts[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* View Reactions Link */}
        {totalReactions > 0 && (
        <TouchableOpacity
            style={styles.viewLink}
            onPress={() => {
              setViewingReactionsPost(item);
              setReactionsModalVisible(true);
            }}>
            <Text style={styles.viewLinkText}>View {totalReactions} reaction{totalReactions !== 1 ? 's' : ''}</Text>
        </TouchableOpacity>
        )}

        {/* Rating Section */}
        <View style={styles.ratingSection}>
          <View style={styles.ratingDisplay}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={[styles.starIcon, star <= Math.round(avgRating) && styles.starFilled]}>
                  ★
                </Text>
              ))}
      </View>
            <Text style={styles.ratingText}>
              {avgRating > 0 ? avgRating.toFixed(1) : '0.0'} · Rated by {totalRatings} user{totalRatings !== 1 ? 's' : ''}
            </Text>
    </View>
          
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => {
              setRatingPost(item);
              setSelectedRating(userRating);
            }}>
            <Text style={styles.rateButtonText}>
              {userRating > 0 ? `Your rating: ${userRating}★` : 'Rate'}
            </Text>
          </TouchableOpacity>
          </View>

        {/* View Ratings Link */}
        {totalRatings > 0 && (
          <TouchableOpacity
            style={styles.viewLink}
            onPress={() => {
              setViewingRatingsPost(item);
              setRatingsModalVisible(true);
            }}>
            <Text style={styles.viewLinkText}>View all ratings</Text>
          </TouchableOpacity>
        )}
          </View>
    );
  };

  // Edit Modal
  const renderEditModal = () => (
    <Modal visible={editModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Edit Post</Text>
          {editingPost && editingPost.user_id !== profile?.id && (
            <View style={styles.adminEditNotice}>
              <Text style={styles.adminEditNoticeText}>
                ⚠️ Editing post by {editingPost.users?.name || 'Unknown'}
              </Text>
        </View>
          )}
        <TextInput
            style={styles.modalInput}
          multiline
            maxLength={MAX_CHARACTERS}
            value={editText}
            onChangeText={setEditText}
            textAlignVertical="top"
            placeholder="Edit post..."
            placeholderTextColor="#6E6E73"
          />
          <Text style={styles.modalCharCounter}>{editText.length}/{MAX_CHARACTERS}</Text>
          <View style={styles.modalButtons}>
          <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setEditModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveButton, (!editText.trim() || isSaving) && styles.modalSaveButtonDisabled]}
              onPress={handleSaveEdit}
              disabled={!editText.trim() || isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Rating Modal
  const renderRatingModal = () => (
    <Modal visible={!!ratingPost} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setRatingPost(null)}>
        <Pressable style={styles.ratingModalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Rate this post</Text>
          <View style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setSelectedRating(star)}>
                <Text style={[styles.ratingStar, star <= selectedRating && styles.ratingStarSelected]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
        </View>
          <Text style={styles.ratingHint}>
            {selectedRating > 0 ? `You selected ${selectedRating} star${selectedRating !== 1 ? 's' : ''}` : 'Tap a star to rate'}
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setRatingPost(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveButton, selectedRating === 0 && styles.modalSaveButtonDisabled]}
              onPress={handleRating}
              disabled={selectedRating === 0}>
              <Text style={styles.modalSaveText}>Submit</Text>
            </TouchableOpacity>
      </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Reactions List Modal
  const renderReactionsModal = () => (
    <Modal visible={reactionsModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setReactionsModalVisible(false)}>
        <Pressable style={styles.listModalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Reactions</Text>
          <ScrollView style={styles.reactionsList}>
            {viewingReactionsPost?.post_reactions?.map((reaction) => (
              <View key={reaction.id} style={styles.listItem}>
                <Text style={styles.listEmoji}>{REACTION_EMOJIS[reaction.reaction_type]}</Text>
                <Text style={styles.listName}>{reaction.users?.name || 'Unknown'}</Text>
    </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setReactionsModalVisible(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Ratings List Modal
  const renderRatingsModal = () => (
    <Modal visible={ratingsModalVisible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setRatingsModalVisible(false)}>
        <Pressable style={styles.listModalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Ratings</Text>
          <ScrollView style={styles.reactionsList}>
            {viewingRatingsPost?.post_ratings?.map((rating) => (
              <View key={rating.id} style={styles.listItem}>
                <Text style={styles.listStars}>{'★'.repeat(rating.rating)}{'☆'.repeat(5 - rating.rating)}</Text>
                <Text style={styles.listName}>{rating.users?.name || 'Unknown'}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setRatingsModalVisible(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Toast Component
  const renderToast = () => (
    toast.visible && (
      <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
        <Text style={styles.toastText}>{toast.message}</Text>
      </Animated.View>
    )
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E5CE6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E5CE6" />
        }
        ListHeaderComponent={
          <>
            <View style={styles.pageHeader}>
              <View style={styles.headerRow}>
                <Text style={styles.pageTitle}>Board</Text>
                <View style={styles.postCountBadge}>
                  <Text style={styles.postCountText}>{posts.length} total</Text>
                </View>
              </View>
              <Text style={styles.pageSubtitle}>Communication hub · Admin view</Text>
            </View>
            {renderSearchAndFilter()}
            {renderComposer()}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '📭'}</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No results found' : 'No posts yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Be the first to share an update!'}
            </Text>
          </View>
        }
      />
      {renderEditModal()}
      {renderRatingModal()}
      {renderReactionsModal()}
      {renderRatingsModal()}
      {renderToast()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  pageHeader: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  postCountBadge: {
    backgroundColor: 'rgba(94, 92, 230, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  postCountText: {
    fontSize: 13,
    color: '#BF5AF2',
    fontWeight: '500',
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 4,
  },
  // Search and filter styles
  searchFilterContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 46,
    fontSize: 16,
    color: '#FFFFFF',
  },
  clearButton: {
    padding: 6,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  filterWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    gap: 8,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  filterArrow: {
    fontSize: 10,
    color: '#8E8E93',
  },
  filterDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    overflow: 'hidden',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  filterOptionActive: {
    backgroundColor: 'rgba(94, 92, 230, 0.15)',
  },
  filterOptionText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  filterOptionTextActive: {
    color: '#5E5CE6',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#5E5CE6',
    fontWeight: '700',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(94, 92, 230, 0.2)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 13,
    color: '#5E5CE6',
  },
  removeFilterText: {
    fontSize: 12,
    color: '#5E5CE6',
    fontWeight: '600',
  },
  clearAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearAllText: {
    fontSize: 13,
    color: '#8E8E93',
    textDecorationLine: 'underline',
  },
  resultsCount: {
    fontSize: 13,
    color: '#6E6E73',
    marginTop: 12,
  },
  // Composer styles
  composerCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(94, 92, 230, 0.3)',
    shadowColor: '#5E5CE6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  composerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5E5CE6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  composerAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#5E5CE6',
  },
  composerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  composerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminBadgeComposer: {
    backgroundColor: 'rgba(94, 92, 230, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeTextComposer: {
    fontSize: 11,
    fontWeight: '600',
    color: '#BF5AF2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  composerInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 100,
    maxHeight: 200,
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  charCounter: {
    fontSize: 13,
    color: '#6E6E73',
  },
  charCounterWarning: {
    color: '#FF9F0A',
  },
  charCounterError: {
    color: '#FF453A',
  },
  postButton: {
    backgroundColor: '#5E5CE6',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#3A3A3C',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  postButtonTextDisabled: {
    color: '#6E6E73',
  },
  // Post card styles
  postCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C4A574',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  adminAvatar: {
    backgroundColor: '#5E5CE6',
  },
  adminAvatarBorder: {
    borderWidth: 2,
    borderColor: '#5E5CE6',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  postHeaderInfo: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  roleBadgeSmall: {
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  adminBadge: {
    backgroundColor: 'rgba(94, 92, 230, 0.2)',
  },
  adminBadgeText: {
    color: '#BF5AF2',
  },
  postDate: {
    fontSize: 13,
    color: '#6E6E73',
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
    marginLeft: 8,
  },
  menuButtonText: {
    fontSize: 20,
    color: '#8E8E93',
    fontWeight: '700',
  },
  dropdownMenu: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  menuItemText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  deleteText: {
    color: '#FF453A',
  },
  postText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: 16,
  },
  // Reactions styles
  reactionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(94, 92, 230, 0.2)',
    borderWidth: 1,
    borderColor: '#5E5CE6',
  },
  reactionButtonDisabled: {
    opacity: 0.5,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  reactionCountActive: {
    color: '#BF5AF2',
  },
  viewLink: {
    marginBottom: 12,
  },
  viewLinkText: {
    fontSize: 13,
    color: '#5E5CE6',
  },
  // Rating styles
  ratingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  ratingDisplay: {
    flex: 1,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  starIcon: {
    fontSize: 16,
    color: '#3A3A3C',
  },
  starFilled: {
    color: '#FFD60A',
  },
  ratingText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  rateButton: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rateButtonText: {
    fontSize: 13,
    color: '#5E5CE6',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  ratingModalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  listModalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 350,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  adminEditNotice: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.3)',
  },
  adminEditNoticeText: {
    fontSize: 13,
    color: '#FF9F0A',
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 120,
    maxHeight: 200,
  },
  modalCharCounter: {
    fontSize: 12,
    color: '#6E6E73',
    textAlign: 'right',
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#3A3A3C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#5E5CE6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#3A3A3C',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  ratingStar: {
    fontSize: 40,
    color: '#3A3A3C',
  },
  ratingStarSelected: {
    color: '#FFD60A',
  },
  ratingHint: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  reactionsList: {
    maxHeight: 300,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  listEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  listStars: {
    fontSize: 16,
    color: '#FFD60A',
    marginRight: 12,
  },
  listName: {
    fontSize: 15,
    color: '#FFFFFF',
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
  // Toast styles
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#30D158',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
});
