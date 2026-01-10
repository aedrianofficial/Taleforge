import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface UserResponse {
  user_id: string;
  user_name: string;
  story_path: StoryPathEntry[];
  comprehension_response: string | null;
  rating: number | null;
  completed_at: string;
}

interface StoryPathEntry {
  part_id: string;
  choice_id: string | null;
  choice_text: string | null;
  part_content: string | null;
  timestamp: string;
}

interface Story {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  status: string;
  submitted_at: string | null;
  genre: string | null;
  users: {
    name: string;
  };
}

export default function StoryResponsesScreen() {
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [userResponses, setUserResponses] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());

  // Filters for user responses
  const [responseFilters, setResponseFilters] = useState({
    userName: '',
    minRating: '',
    maxRating: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    if (storyId && user) {
      loadStoryAndResponses();
    }
  }, [storyId, user]);

  const loadStoryAndResponses = useCallback(async () => {
    if (!storyId || !user?.id) return;

    try {
      setLoading(true);

      // Load story info
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select('*, users!stories_author_id_fkey(name)')
        .eq('id', storyId)
        .single();

      if (storyError) throw storyError;
      setStory(storyData);

      // Load user responses
      await loadUserResponses();
    } catch (error) {
      console.error('Error loading story and responses:', error);
      Alert.alert('Error', 'Failed to load story responses');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [storyId, user?.id]);

  const loadUserResponses = async () => {
    if (!storyId) return;

    try {
      setLoadingResponses(true);

      // Load user story paths with user info
      const { data: storyPaths, error: pathsError } = await supabase
        .from('user_story_paths')
        .select(`
          user_id,
          story_path,
          comprehension_response,
          created_at,
          users!user_id(name)
        `)
        .eq('story_id', storyId);

      if (pathsError) throw pathsError;

      // Load ratings separately
      const { data: ratings, error: ratingsError } = await supabase
        .from('story_ratings')
        .select('user_id, rating')
        .eq('story_id', storyId);

      if (ratingsError) throw ratingsError;

      // Create a map of user_id to rating for easy lookup
      const ratingsMap = new Map();
      ratings?.forEach(rating => {
        ratingsMap.set(rating.user_id, rating.rating);
      });

      // Transform the data to match our interface
      const formattedResponses: UserResponse[] = storyPaths?.map(response => ({
        user_id: response.user_id,
        user_name: response.users?.name || 'Unknown User',
        story_path: response.story_path || [],
        comprehension_response: response.comprehension_response,
        rating: ratingsMap.get(response.user_id) || null,
        completed_at: response.created_at,
      })) || [];

      setUserResponses(formattedResponses);
    } catch (error) {
      console.error('Error loading user responses:', error);
      Alert.alert('Error', 'Failed to load user responses');
    } finally {
      setLoadingResponses(false);
    }
  };

  const toggleResponseExpansion = (userId: string) => {
    const newExpanded = new Set(expandedResponses);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedResponses(newExpanded);
  };

  const filteredResponses = userResponses.filter(response => {
    const matchesUserName = !responseFilters.userName ||
      response.user_name.toLowerCase().includes(responseFilters.userName.toLowerCase());

    const matchesRating = (!responseFilters.minRating || (response.rating && response.rating >= parseInt(responseFilters.minRating))) &&
                         (!responseFilters.maxRating || (response.rating && response.rating <= parseInt(responseFilters.maxRating)));

    const matchesDate = (!responseFilters.startDate || new Date(response.completed_at) >= new Date(responseFilters.startDate)) &&
                       (!responseFilters.endDate || new Date(response.completed_at) <= new Date(responseFilters.endDate));

    return matchesUserName && matchesRating && matchesDate;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C4A574" />
          <Text style={styles.loadingText}>Loading responses...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!story) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Story not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="arrow.left" size={20} color="#C4A574" />
            <Text style={styles.backText}>Back to Review</Text>
          </TouchableOpacity>

          <View style={styles.storyInfo}>
            <Text style={styles.title}>{story.title}</Text>
            <Text style={styles.subtitle}>User Responses ({filteredResponses.length})</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <Text style={styles.filtersTitle}>Filters:</Text>
          <View style={styles.filterRow}>
            <TextInput
              style={[styles.filterInput, { flex: 2 }]}
              placeholder="User name..."
              placeholderTextColor="#8E8E93"
              value={responseFilters.userName}
              onChangeText={(text) => setResponseFilters(prev => ({ ...prev, userName: text }))}
            />
            <TextInput
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="Min rating (1-5)"
              placeholderTextColor="#8E8E93"
              value={responseFilters.minRating}
              onChangeText={(text) => setResponseFilters(prev => ({ ...prev, minRating: text }))}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="Max rating (1-5)"
              placeholderTextColor="#8E8E93"
              value={responseFilters.maxRating}
              onChangeText={(text) => setResponseFilters(prev => ({ ...prev, maxRating: text }))}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.filterRow}>
            <TextInput
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="Start date (YYYY-MM-DD)"
              placeholderTextColor="#8E8E93"
              value={responseFilters.startDate}
              onChangeText={(text) => setResponseFilters(prev => ({ ...prev, startDate: text }))}
            />
            <TextInput
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="End date (YYYY-MM-DD)"
              placeholderTextColor="#8E8E93"
              value={responseFilters.endDate}
              onChangeText={(text) => setResponseFilters(prev => ({ ...prev, endDate: text }))}
            />
          </View>
        </View>

        {/* Responses List */}
        {loadingResponses ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#C4A574" />
            <Text style={styles.loadingText}>Loading responses...</Text>
          </View>
        ) : filteredResponses.length === 0 ? (
          <Text style={styles.noResponsesText}>No user responses found</Text>
        ) : (
          filteredResponses.map((response) => (
            <View key={response.user_id} style={styles.responseItem}>
              <TouchableOpacity
                style={styles.responseHeader}
                onPress={() => toggleResponseExpansion(response.user_id)}
              >
                <View style={styles.responseSummary}>
                  <Text style={styles.userName}>{response.user_name}</Text>
                  <Text style={styles.completionDate}>
                    Completed: {new Date(response.completed_at).toLocaleDateString()}
                  </Text>
                  {response.rating && (
                    <View style={styles.ratingDisplay}>
                      <Text style={styles.ratingLabel}>Rating:</Text>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text key={star} style={[styles.starIcon, star <= response.rating! && styles.starFilled]}>
                          ★
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
                <IconSymbol
                  name={expandedResponses.has(response.user_id) ? "chevron.up" : "chevron.down"}
                  size={20}
                  color="#C4A574"
                />
              </TouchableOpacity>

              {expandedResponses.has(response.user_id) && (
                <View style={styles.responseDetails}>
                  {/* Story Path */}
                  <Text style={styles.detailSectionTitle}>Story Journey:</Text>
                  {response.story_path.map((entry, index) => (
                    <View key={`${entry.part_id}-${index}`} style={styles.pathEntry}>
                      <Text style={styles.partNumber}>Part {index + 1}</Text>
                      {entry.choice_text && (
                        <Text style={styles.choiceText}>&ldquo;{entry.choice_text}&rdquo;</Text>
                      )}
                      {entry.part_content && (
                        <Text style={styles.partContent} numberOfLines={2}>
                          {entry.part_content.substring(0, 100)}...
                        </Text>
                      )}
                    </View>
                  ))}

                  {/* Reflection */}
                  {response.comprehension_response && (
                    <View style={styles.reflectionSection}>
                      <Text style={styles.detailSectionTitle}>Reflection:</Text>
                      <Text style={styles.reflectionText}>{response.comprehension_response}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backText: {
    color: '#C4A574',
    fontSize: 14,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  header: {
    marginBottom: 24,
  },
  storyInfo: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8D5B7',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  filtersContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterInput: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 8,
    color: '#E8D5B7',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#48484A',
  },
  responseItem: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  responseSummary: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 4,
  },
  completionDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  starIcon: {
    fontSize: 14,
    color: '#8E8E93',
  },
  starFilled: {
    color: '#FFD700',
  },
  responseDetails: {
    borderTopWidth: 1,
    borderTopColor: '#3A3A3C',
    padding: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C4A574',
    marginBottom: 12,
  },
  pathEntry: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  partNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C4A574',
    marginBottom: 4,
  },
  choiceText: {
    fontSize: 14,
    color: '#E8D5B7',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  partContent: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
  reflectionSection: {
    marginTop: 16,
  },
  reflectionText: {
    fontSize: 14,
    color: '#E8D5B7',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  noResponsesText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    padding: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
});
