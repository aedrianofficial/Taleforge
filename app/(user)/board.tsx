import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
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

type ReactionType = 'like' | 'heart' | 'laugh';

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
  };
  post_reactions?: PostReaction[];
  post_ratings?: PostRating[];
};

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
};

export default function BoardScreen() {
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
      .channel('user-posts-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchAllPosts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => {
        fetchAllPosts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_ratings' }, () => {
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
        users(name, is_admin, privacy_posts_visible),
        post_reactions(id, post_id, user_id, reaction_type, users(name)),
        post_ratings(id, post_id, user_id, rating, users(name))
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      // Filter posts: only show posts from users who have enabled post visibility
      // or the user's own posts
      const filteredPosts = (data || []).filter(post => 
        post.users?.privacy_posts_visible !== false || post.user_id === profile?.id
      );
      setPosts(filteredPosts);
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

    const { error } = await supabase
      .from('posts')
      .insert([{ text: postText.trim(), user_id: profile.id }]);

    if (error) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } else {
      setPostText('');
      showToast('Post created successfully!');
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
    const { error } = await supabase
      .from('posts')
      .update({ text: editText.trim() })
      .eq('id', editingPost.id);

    if (error) {
      Alert.alert('Error', 'Failed to update post');
    } else {
      showToast('Post updated successfully!');
      setEditModalVisible(false);
      setEditingPost(null);
    }
    setIsSaving(false);
  };

  const handleDeletePost = (post: Post) => {
    setMenuPostId(null);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('posts')
              .delete()
              .eq('id', post.id);

            if (error) {
              Alert.alert('Error', 'Failed to delete post');
            } else {
              showToast('Post deleted successfully');
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
  };

  const handleRating = async () => {
    if (!profile?.id || !ratingPost || selectedRating === 0) return;

    const existingRating = ratingPost.post_ratings?.find(r => r.user_id === profile.id);

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
    setRatingPost(null);
    setSelectedRating(0);
  };

  const getReactionCounts = (post: Post) => {
    const counts: Record<ReactionType, number> = { like: 0, heart: 0, laugh: 0 };
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

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const canEditOrDelete = (post: Post) => {
    return profile?.id === post.user_id;
  };

  const renderComposer = () => (
    <View style={styles.composerCard}>
      <View style={styles.composerHeader}>
        <View style={styles.composerAvatar}>
          <Text style={styles.composerAvatarText}>
            {(profile?.name || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.composerUserInfo}>
          <Text style={styles.composerUserName}>{profile?.name || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>User</Text>
          </View>
        </View>
      </View>
      
      <TextInput
        style={styles.composerInput}
        placeholder="What's on your mind?"
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
            <ActivityIndicator size="small" color="#0D0D0D" />
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

    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={[styles.avatar, item.users?.is_admin && styles.adminAvatar]}>
            <Text style={styles.avatarText}>
              {(item.users?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
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
          
          {/* Menu Button - Only show if user can edit/delete */}
          {canEditOrDelete(item) && (
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
              <Text style={styles.menuItemText}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleDeletePost(item)}>
              <Text style={[styles.menuItemText, styles.deleteText]}>🗑️ Delete</Text>
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
          <TextInput
            style={styles.modalInput}
            multiline
            maxLength={MAX_CHARACTERS}
            value={editText}
            onChangeText={setEditText}
            textAlignVertical="top"
            placeholder="Edit your post..."
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
        <ActivityIndicator size="large" color="#C4A574" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C4A574" />
        }
        ListHeaderComponent={
          <>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>Board</Text>
              <Text style={styles.pageSubtitle}>Share and discover posts</Text>
            </View>
            {renderComposer()}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share something!</Text>
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
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 4,
  },
  // Composer styles
  composerCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C4A574',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  composerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0D0D0D',
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
  roleBadge: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
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
    backgroundColor: '#C4A574',
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
    color: '#0D0D0D',
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
  adminAvatar: {
    backgroundColor: '#5E5CE6',
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
    backgroundColor: 'rgba(196, 165, 116, 0.2)',
    borderWidth: 1,
    borderColor: '#C4A574',
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
    color: '#C4A574',
  },
  viewLink: {
    marginBottom: 12,
  },
  viewLinkText: {
    fontSize: 13,
    color: '#C4A574',
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
    color: '#C4A574',
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
    backgroundColor: '#C4A574',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#3A3A3C',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#0D0D0D',
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
