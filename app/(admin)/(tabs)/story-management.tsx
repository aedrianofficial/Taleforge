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
  const [loadedParts, setLoadedParts] = useState<{ [storyId: string]: any[] }>({});
  const [selectedPart, setSelectedPart] = useState<StoryPart | null>(null);
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const [choiceModalVisible, setChoiceModalVisible] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [choiceText, setChoiceText] = useState('');
  const [selectedNextPartId, setSelectedNextPartId] = useState<string | null>(null);
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
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadStories();
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

    setFilteredStories(filtered);
  }, [stories, searchQuery, statusFilter, authorFilter, genreFilter, dateFilter]);

  const loadStories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          users!author_id(name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setStories(data || []);
      setFilteredStories(data || []);
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

  const loadStoryParts = async (storyId: string) => {
    try {
      console.log('Loading story parts for storyId:', storyId);
      const { data: parts, error: partsError } = await supabase
        .from('story_parts')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: true });

      console.log('Parts query result:', { parts, error: partsError });

      if (partsError) {
        console.error('Parts error:', partsError);
        throw partsError;
      }

      // Load choices for each part
      const partsWithChoices = await Promise.all(
        (parts || []).map(async (part) => {
          console.log('Loading choices for part:', part.id);
          const { data: choices, error: choicesError } = await supabase
            .from('story_choices')
            .select('*')
            .eq('part_id', part.id)
            .order('order_index', { ascending: true });

          console.log('Choices for part', part.id, ':', { choices, error: choicesError });

          if (choicesError) {
            console.error('Error loading choices for part:', part.id, choicesError);
          }

          return {
            ...part,
            choices: choices || [],
          };
        })
      );

      console.log('Final parts with choices:', partsWithChoices);

      return partsWithChoices;
    } catch (error) {
      console.error('Error loading story parts:', error);
      return [];
    }
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
      }
      // For reject, we just mark as reviewed but don't publish

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

      Alert.alert('Success', `Story ${action}d successfully`);
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

  const handleEditPart = (part: StoryPart, storyId: string) => {
    Alert.prompt(
      'Edit Story Part',
      'Enter the new content for this story part:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newContent: string | undefined) => {
            if (!newContent?.trim()) return;

            try {
              const { error } = await supabase
                .from('story_parts')
                .update({
                  content: newContent.trim(),
                  modified_by: user?.id,
                  modified_at: new Date().toISOString(),
                })
                .eq('id', part.id);

              if (error) throw error;

              // Log the change
              await supabase
                .from('story_audit_log')
                .insert({
                  story_id: storyId,
                  part_id: part.id,
                  action: 'update',
                  field_changed: 'content',
                  old_value: part.content,
                  new_value: newContent.trim(),
                  performed_by: user?.id,
                });

              // Reload the parts for this story
              const updatedParts = await loadStoryParts(storyId);
              setLoadedParts(prev => ({
                ...prev,
                [storyId]: updatedParts,
              }));

              Alert.alert('Success', 'Story part updated successfully');
            } catch (error) {
              console.error('Error updating story part:', error);
              Alert.alert('Error', 'Failed to update story part');
            }
          }
        }
      ],
      'plain-text',
      part.content
    );
  };

  const handleDeletePart = (part: StoryPart, storyId: string) => {
    Alert.alert(
      'Delete Story Part',
      'Are you sure you want to delete this story part? This will also delete all choices associated with it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete choices for this part first
              await supabase
                .from('story_choices')
                .delete()
                .eq('part_id', part.id);

              // Delete the part
              const { error } = await supabase
                .from('story_parts')
                .delete()
                .eq('id', part.id);

              if (error) throw error;

              // Log the deletion
              await supabase
                .from('story_audit_log')
                .insert({
                  story_id: storyId,
                  part_id: part.id,
                  action: 'delete_part',
                  field_changed: 'content',
                  old_value: part.content,
                  performed_by: user?.id,
                });

              // Reload the parts for this story
              const updatedParts = await loadStoryParts(storyId);
              setLoadedParts(prev => ({
                ...prev,
                [storyId]: updatedParts,
              }));

              Alert.alert('Success', 'Story part deleted successfully');
            } catch (error) {
              console.error('Error deleting story part:', error);
              Alert.alert('Error', 'Failed to delete story part');
            }
          }
        }
      ]
    );
  };

  const openAddChoiceModal = (partId: string, storyId: string) => {
    setSelectedPartId(partId);
    setSelectedStoryId(storyId);
    setChoiceText('');
    setSelectedNextPartId(null);
    setChoiceModalVisible(true);
  };

  const handleAddChoice = async () => {
    if (!choiceText.trim()) {
      Alert.alert('Error', 'Please enter choice text');
      return;
    }

    if (!selectedPartId || !selectedStoryId) return;

            try {
              const { error } = await supabase
                .from('story_choices')
                .insert({
          part_id: selectedPartId,
                  choice_text: choiceText.trim(),
          next_part_id: selectedNextPartId,
                  created_by: user?.id,
                });

              if (error) throw error;

      setChoiceModalVisible(false);
      setChoiceText('');
      setSelectedNextPartId(null);

      // Reload the parts for this story
      const updatedParts = await loadStoryParts(selectedStoryId);
      setLoadedParts(prev => ({
        ...prev,
        [selectedStoryId]: updatedParts,
      }));

              Alert.alert('Success', 'Choice added successfully');
            } catch (error) {
              console.error('Error adding choice:', error);
              Alert.alert('Error', 'Failed to add choice');
            }
  };

  const editChoice = async (choice: StoryChoice, storyId: string) => {
    Alert.prompt(
      'Edit Choice',
      'Enter the new choice text:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newText: string | undefined) => {
            if (!newText?.trim()) return;

            try {
              const { error } = await supabase
                .from('story_choices')
                .update({
                  choice_text: newText.trim(),
                  modified_by: user?.id,
                  modified_at: new Date().toISOString(),
                })
                .eq('id', choice.id);

              if (error) throw error;

              // Log the change
              await supabase
                .from('story_audit_log')
                .insert({
                  story_id: storyId,
                  choice_id: choice.id,
                  action: 'update',
                  field_changed: 'choice_text',
                  old_value: choice.choice_text,
                  new_value: newText.trim(),
                  performed_by: user?.id,
                });

              // Reload the parts for this story
              const updatedParts = await loadStoryParts(storyId);
              setLoadedParts(prev => ({
                ...prev,
                [storyId]: updatedParts,
              }));

              Alert.alert('Success', 'Choice updated successfully');
            } catch (error) {
              console.error('Error updating choice:', error);
              Alert.alert('Error', 'Failed to update choice');
            }
          }
        }
      ],
      'plain-text',
      choice.choice_text
    );
  };

  const deleteChoice = async (choice: StoryChoice, storyId: string) => {
    Alert.alert(
      'Delete Choice',
      'Are you sure you want to delete this choice?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('story_choices')
                .delete()
                .eq('id', choice.id);

              if (error) throw error;

              // Log the deletion
              await supabase
                .from('story_audit_log')
                .insert({
                  story_id: storyId,
                  choice_id: choice.id,
                  action: 'delete',
                  field_changed: 'choice_text',
                  old_value: choice.choice_text,
                  performed_by: user?.id,
                });

              // Reload the parts for this story
              const updatedParts = await loadStoryParts(storyId);
              setLoadedParts(prev => ({
                ...prev,
                [storyId]: updatedParts,
              }));

              Alert.alert('Success', 'Choice deleted successfully');
            } catch (error) {
              console.error('Error deleting choice:', error);
              Alert.alert('Error', 'Failed to delete choice');
            }
          }
        }
      ]
    );
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
          </View>
          <IconSymbol
            name={isExpanded ? "chevron.up" : "chevron.down"}
            size={20}
            color="#C4A574"
          />
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

            <TouchableOpacity
              style={styles.loadPartsButton}
              onPress={async () => {
                console.log('Loading parts for story:', item.id);
                const parts = await loadStoryParts(item.id);
                console.log('Loaded parts:', parts);
                setLoadedParts(prev => ({
                  ...prev,
                  [item.id]: parts,
                }));
              }}
            >
              <Text style={styles.loadPartsButtonText}>Load Story Parts</Text>
            </TouchableOpacity>

            {loadedParts[item.id] && (
              <View style={styles.partsList}>
                <Text style={styles.partsTitle}>Story Parts & Choices:</Text>
                {loadedParts[item.id].length > 0 ? (
                  loadedParts[item.id].map((part) => {
                    return (
                  <View key={part.id} style={styles.partCard}>
                    <View style={styles.partHeader}>
                      <Text style={styles.partContent} numberOfLines={2}>
                        {part.content}
                      </Text>
                      <View style={styles.partActions}>
                        <TouchableOpacity
                          style={styles.editPartButton}
                          onPress={() => handleEditPart(part, item.id)}
                        >
                          <IconSymbol name="pencil" size={16} color="#2196F3" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deletePartButton}
                          onPress={() => handleDeletePart(part, item.id)}
                        >
                          <IconSymbol name="trash.fill" size={16} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                      <View style={styles.partBadges}>
                        {part.is_start && <Text style={styles.badge}>Start</Text>}
                        {part.is_ending && <Text style={styles.badge}>End</Text>}
                    </View>

                    <View style={styles.choicesSection}>
                      <View style={styles.choicesHeader}>
                        <Text style={styles.choicesTitle}>Choices:</Text>
                        <TouchableOpacity
                          style={styles.addChoiceButton}
                              onPress={() => openAddChoiceModal(part.id, item.id)}
                        >
                          <IconSymbol name="plus" size={16} color="#C4A574" />
                          <Text style={styles.addChoiceText}>Add Choice</Text>
                        </TouchableOpacity>
                      </View>

                      {part.choices && part.choices.length > 0 ? (
                        part.choices.map((choice: StoryChoice) => (
                          <View key={choice.id} style={styles.choiceItem}>
                            <Text style={styles.choiceText}>{choice.choice_text}</Text>
                            <View style={styles.choiceActions}>
                              <TouchableOpacity
                                style={styles.editChoiceButton}
                                    onPress={() => editChoice(choice, item.id)}
                              >
                                <IconSymbol name="pencil" size={16} color="#2196F3" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.deleteChoiceButton}
                                    onPress={() => deleteChoice(choice, item.id)}
                              >
                                <IconSymbol name="trash.fill" size={16} color="#F44336" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noChoicesText}>No choices added yet</Text>
                      )}
                    </View>
                  </View>
                    );
                  })
                ) : (
                  <Text style={styles.noPartsText}>No story parts found. The story may not have been properly initialized.</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C4A574" />
          <Text style={styles.loadingText}>Loading stories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Get unique authors and genres for filter dropdowns
  const uniqueAuthors = Array.from(new Set(stories.map(s => s.author_id)))
    .map(authorId => {
      const story = stories.find(s => s.author_id === authorId);
      return { id: authorId, name: story?.users?.name || 'Unknown' };
    });

  const uniqueGenres = Array.from(new Set(stories.map(s => s.genre).filter(Boolean)));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Story Management</Text>
        <Text style={styles.headerSubtitle}>Review and manage user-submitted stories</Text>
      </View>

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
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setAuthorFilter('all');
                  setGenreFilter('all');
                  setDateFilter('all');
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

      {/* Add Choice Modal */}
      <Modal
        visible={choiceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setChoiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Choice</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Choice Text *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={choiceText}
                onChangeText={setChoiceText}
                placeholder="Enter the choice text..."
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Links to Part</Text>
              <ScrollView style={styles.modalPartsList} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.partOption, selectedNextPartId === null && styles.selectedPartOption]}
                  onPress={() => setSelectedNextPartId(null)}
                >
                  <Text style={[styles.partOptionText, selectedNextPartId === null && styles.selectedPartOptionText]}>
                    End Story
                  </Text>
                </TouchableOpacity>
                {selectedStoryId && loadedParts[selectedStoryId]?.filter(part => part.id !== selectedPartId).map((part) => (
                  <TouchableOpacity
                    key={part.id}
                    style={[styles.partOption, selectedNextPartId === part.id && styles.selectedPartOption]}
                    onPress={() => setSelectedNextPartId(part.id)}
                  >
                    <Text style={[styles.partOptionText, selectedNextPartId === part.id && styles.selectedPartOptionText]}>
                      {part.is_start && '🏁 '}
                      {part.is_ending && '🏆 '}
                      {part.content.substring(0, 50)}{part.content.length > 50 ? '...' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setChoiceModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleAddChoice}
              >
                <Text style={styles.submitButtonText}>Add Choice</Text>
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
                placeholder="Enter genre (e.g., Fantasy, Mystery)..."
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
                style={[styles.modalButton, styles.submitButton, updating && styles.disabledButton]}
                onPress={handleUpdateStory}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8D5B7',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  listContainer: {
    padding: 20,
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
  loadPartsButton: {
    backgroundColor: '#C4A574',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadPartsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  partsList: {
    marginTop: 16,
  },
  partsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 12,
  },
  partCard: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  partHeader: {
    marginBottom: 12,
  },
  partContent: {
    fontSize: 14,
    color: '#E8D5B7',
    lineHeight: 20,
  },
  partActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editPartButton: {
    padding: 4,
  },
  deletePartButton: {
    padding: 4,
  },
  partBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#C4A574',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
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
  addChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addChoiceText: {
    color: '#C4A574',
    fontSize: 12,
    fontWeight: '600',
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
  choiceText: {
    fontSize: 14,
    color: '#E8D5B7',
    flex: 1,
  },
  choiceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editChoiceButton: {
    padding: 4,
  },
  deleteChoiceButton: {
    padding: 4,
  },
  noChoicesText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  noPartsText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
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
});
