import { supabase } from '@/src/config/supabase';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type Post = {
  id: string;
  text: string;
  reactions: number;
  rating: number;
  created_at: string;
  user_id: string;
  users?: {
    name: string;
  };
};

export default function BoardScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAllPosts();
  }, []);

  const fetchAllPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, users(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching posts:', error);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllPosts();
    setRefreshing(false);
  };

  const handleReaction = async (postId: string, currentReactions: number) => {
    const { error } = await supabase
      .from('posts')
      .update({ reactions: currentReactions + 1 })
      .eq('id', postId);

    if (!error) {
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, reactions: post.reactions + 1 }
          : post
      ));
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.users?.name || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.authorName}>{item.users?.name || 'Unknown'}</Text>
      </View>
      <Text style={styles.postText}>{item.text}</Text>
      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleReaction(item.id, item.reactions)}>
          <Text style={styles.actionText}>❤️ {item.reactions}</Text>
        </TouchableOpacity>
        <View style={styles.actionButton}>
          <Text style={styles.actionText}>⭐ {item.rating}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C4A574" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share something!</Text>
          </View>
        }
      />
    </View>
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
  },
  postCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C4A574',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  postText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  postActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  actionButton: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
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

