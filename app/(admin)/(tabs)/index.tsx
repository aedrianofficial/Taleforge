import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type Stats = {
  totalUsers: number;
  totalPosts: number;
  totalReactions: number;
  averageRating: number;
  activeToday: number;
  postsThisWeek: number;
  totalStories: number;
  totalStoryParts: number;
  totalStoryChoices: number;
  storyReactions: number;
  storyAvgRating: number;
  storiesThisWeek: number;
  storyCompletions: number;
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalPosts: 0,
    totalReactions: 0,
    averageRating: 0,
    activeToday: 0,
    postsThisWeek: 0,
    totalStories: 0,
    totalStoryParts: 0,
    totalStoryChoices: 0,
    storyReactions: 0,
    storyAvgRating: 0,
    storiesThisWeek: 0,
    storyCompletions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    
    // Real-time subscription for live updates
    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_ratings' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_parts' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_choices' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_reactions' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_ratings' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch user count
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Fetch post count
      const { count: postCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      // Fetch total reactions count
      const { count: reactionsCount } = await supabase
        .from('post_reactions')
        .select('*', { count: 'exact', head: true });

      // Fetch all ratings to calculate average
      const { data: ratingsData } = await supabase
        .from('post_ratings')
        .select('rating');

      const avgRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
        : 0;

      // Posts from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: weekPostCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      // Active users today (posted today)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todayPosts } = await supabase
        .from('posts')
        .select('user_id')
        .gte('created_at', todayStart.toISOString());

      const uniqueActiveUsers = todayPosts
        ? new Set(todayPosts.map(p => p.user_id)).size
        : 0;

      // Story Analytics
      const { count: storiesCount } = await supabase
        .from('stories')
        .select('*', { count: 'exact', head: true });

      const { count: storyPartsCount } = await supabase
        .from('story_parts')
        .select('*', { count: 'exact', head: true });

      const { count: storyChoicesCount } = await supabase
        .from('story_choices')
        .select('*', { count: 'exact', head: true });

      const { count: storyReactionsCount } = await supabase
        .from('story_reactions')
        .select('*', { count: 'exact', head: true });

      const { data: storyRatingsData } = await supabase
        .from('story_ratings')
        .select('rating');

      const storyAvgRating = storyRatingsData && storyRatingsData.length > 0
        ? storyRatingsData.reduce((sum, r) => sum + r.rating, 0) / storyRatingsData.length
        : 0;

      const { count: weekStoriesCount } = await supabase
        .from('stories')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      // Calculate story completions (stories that have ending parts)
      const { data: endingParts } = await supabase
        .from('story_parts')
        .select('story_id')
        .eq('is_ending', true);

      const storyCompletions = endingParts ? new Set(endingParts.map(p => p.story_id)).size : 0;

      setStats({
        totalUsers: userCount || 0,
        totalPosts: postCount || 0,
        totalReactions: reactionsCount || 0,
        averageRating: avgRating,
        activeToday: uniqueActiveUsers,
        postsThisWeek: weekPostCount || 0,
        totalStories: storiesCount || 0,
        totalStoryParts: storyPartsCount || 0,
        totalStoryChoices: storyChoicesCount || 0,
        storyReactions: storyReactionsCount || 0,
        storyAvgRating: storyAvgRating,
        storiesThisWeek: weekStoriesCount || 0,
        storyCompletions: storyCompletions,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };


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
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E5CE6" />
      }>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Admin Dashboard</Text>
        <Text style={styles.nameText}>Welcome, {profile?.name}</Text>
        <Text style={styles.subtitleText}>Platform analytics and insights</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Platform Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.primaryCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>👥</Text>
            </View>
            <Text style={styles.statNumber}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={[styles.statCard, styles.secondaryCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>📝</Text>
            </View>
            <Text style={styles.statNumber}>{stats.totalPosts}</Text>
            <Text style={styles.statLabel}>Total Posts</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 Engagement Metrics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>❤️</Text>
            </View>
            <Text style={styles.statNumber}>{stats.totalReactions}</Text>
            <Text style={styles.statLabel}>Total Reactions</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>⭐</Text>
            </View>
            <Text style={styles.statNumber}>
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Activity Overview</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.successCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>✨</Text>
            </View>
            <Text style={styles.statNumber}>{stats.activeToday}</Text>
            <Text style={styles.statLabel}>Active Today</Text>
          </View>
          <View style={[styles.statCard, styles.infoCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>📅</Text>
            </View>
            <Text style={styles.statNumber}>{stats.postsThisWeek}</Text>
            <Text style={styles.statLabel}>Posts This Week</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎭 Interactive Stories</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.storyPrimaryCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>📚</Text>
            </View>
            <Text style={styles.statNumber}>{stats.totalStories}</Text>
            <Text style={styles.statLabel}>Total Stories</Text>
          </View>
          <View style={[styles.statCard, styles.storySecondaryCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>📄</Text>
            </View>
            <Text style={styles.statNumber}>{stats.totalStoryParts}</Text>
            <Text style={styles.statLabel}>Story Parts</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>🔀</Text>
            </View>
            <Text style={styles.statNumber}>{stats.totalStoryChoices}</Text>
            <Text style={styles.statLabel}>Total Choices</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>💖</Text>
            </View>
            <Text style={styles.statNumber}>{stats.storyReactions}</Text>
            <Text style={styles.statLabel}>Story Reactions</Text>
          </View>
          <View style={[styles.statCard, styles.storyAccentCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>⭐</Text>
            </View>
            <Text style={styles.statNumber}>
              {stats.storyAvgRating > 0 ? stats.storyAvgRating.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.statLabel}>Avg Story Rating</Text>
          </View>
          <View style={[styles.statCard, styles.storySuccessCard]}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>🎯</Text>
            </View>
            <Text style={styles.statNumber}>{stats.storyCompletions}</Text>
            <Text style={styles.statLabel}>Completions</Text>
          </View>
        </View>

        <View style={styles.storyMetricsContainer}>
          <View style={[styles.storyMetricItem, styles.storyMetricItemBordered]}>
            <Text style={styles.storyMetricLabel}>Stories This Week:</Text>
            <Text style={styles.storyMetricValue}>{stats.storiesThisWeek}</Text>
          </View>
          <View style={[styles.storyMetricItem, styles.storyMetricItemBordered]}>
            <Text style={styles.storyMetricLabel}>Parts per Story:</Text>
            <Text style={styles.storyMetricValue}>
              {stats.totalStories > 0 ? (stats.totalStoryParts / stats.totalStories).toFixed(1) : '0.0'}
            </Text>
          </View>
          <View style={styles.storyMetricItem}>
            <Text style={styles.storyMetricLabel}>Choices per Part:</Text>
            <Text style={styles.storyMetricValue}>
              {stats.totalStoryParts > 0 ? (stats.totalStoryChoices / stats.totalStoryParts).toFixed(1) : '0.0'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>💡 Real-time updates enabled</Text>
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
    paddingBottom: 16,
  },
  welcomeText: {
    fontSize: 14,
    color: '#5E5CE6',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
  },
  nameText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  subtitleText: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 6,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    width: '47.5%',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryCard: {
    borderColor: 'rgba(94, 92, 230, 0.3)',
    backgroundColor: 'rgba(94, 92, 230, 0.05)',
  },
  secondaryCard: {
    borderColor: 'rgba(196, 165, 116, 0.3)',
    backgroundColor: 'rgba(196, 165, 116, 0.05)',
  },
  successCard: {
    borderColor: 'rgba(48, 209, 88, 0.3)',
    backgroundColor: 'rgba(48, 209, 88, 0.05)',
  },
  infoCard: {
    borderColor: 'rgba(100, 210, 255, 0.3)',
    backgroundColor: 'rgba(100, 210, 255, 0.05)',
  },
  storyPrimaryCard: {
    borderColor: 'rgba(255, 193, 7, 0.3)',
    backgroundColor: 'rgba(255, 193, 7, 0.05)',
  },
  storySecondaryCard: {
    borderColor: 'rgba(220, 53, 69, 0.3)',
    backgroundColor: 'rgba(220, 53, 69, 0.05)',
  },
  storyAccentCard: {
    borderColor: 'rgba(23, 162, 184, 0.3)',
    backgroundColor: 'rgba(23, 162, 184, 0.05)',
  },
  storySuccessCard: {
    borderColor: 'rgba(40, 167, 69, 0.3)',
    backgroundColor: 'rgba(40, 167, 69, 0.05)',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconText: {
    fontSize: 24,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
  storyMetricsContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  storyMetricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  storyMetricItemBordered: {
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  storyMetricLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  storyMetricValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 48,
  },
  footerText: {
    fontSize: 13,
    color: '#6E6E73',
    fontStyle: 'italic',
  },
});
