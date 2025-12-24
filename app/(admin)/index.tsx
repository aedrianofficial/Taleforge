import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
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

type Stats = {
  totalUsers: number;
  totalPosts: number;
  totalReactions: number;
  activeToday: number;
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalPosts: 0,
    totalReactions: 0,
    activeToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    // Fetch all posts with user info
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*, users(name)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (postsError) {
      console.error('Error fetching posts:', postsError);
    } else {
      setPosts(postsData || []);
    }

    // Fetch user count
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Fetch post count
    const { count: postCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    // Calculate total reactions
    const totalReactions = (postsData || []).reduce(
      (sum, post) => sum + (post.reactions || 0),
      0
    );

    setStats({
      totalUsers: userCount || 0,
      totalPosts: postCount || 0,
      totalReactions,
      activeToday: 0,
    });

    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.users?.name || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.postHeaderInfo}>
          <Text style={styles.authorName}>{item.users?.name || 'Unknown'}</Text>
          <Text style={styles.postDate}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
      <Text style={styles.postText} numberOfLines={3}>
        {item.text}
      </Text>
      <View style={styles.postStats}>
        <Text style={styles.postStatText}>❤️ {item.reactions}</Text>
        <Text style={styles.postStatText}>⭐ {item.rating}</Text>
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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C4A574" />
      }>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Admin Dashboard</Text>
        <Text style={styles.nameText}>Welcome, {profile?.name}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalPosts}</Text>
          <Text style={styles.statLabel}>Total Posts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalReactions}</Text>
          <Text style={styles.statLabel}>Total Reactions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.activeToday}</Text>
          <Text style={styles.statLabel}>Active Today</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Recent Posts</Text>
        {posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </View>
    </ScrollView>
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
  header: {
    padding: 24,
    paddingTop: 16,
  },
  welcomeText: {
    fontSize: 14,
    color: '#C4A574',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
  },
  nameText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E8D5B7',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    width: '47%',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#C4A574',
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  postCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C4A574',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  postHeaderInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  postDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  postText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  postStats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  postStatText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
