import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
  part_id: string;
  choice_text: string;
  next_part_id: string | null;
  order_index: number;
}

export default function StoryReviewScreen() {
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [choiceModalVisible, setChoiceModalVisible] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [choiceText, setChoiceText] = useState('');
  const [selectedNextPartId, setSelectedNextPartId] = useState<string | null>(null);
  const [partModalVisible, setPartModalVisible] = useState(false);
  const [partContent, setPartContent] = useState('');
  const [addingPart, setAddingPart] = useState(false);
  const [addingChoice, setAddingChoice] = useState(false);
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [expandedChoices, setExpandedChoices] = useState<Set<string>>(new Set());
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editing, setEditing] = useState(false);

  // Reactions and ratings state
  const [userReactions, setUserReactions] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [reactionsModalVisible, setReactionsModalVisible] = useState(false);
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false);

  // Edit part modal state
  const [editPartModalVisible, setEditPartModalVisible] = useState(false);
  const [editingPart, setEditingPart] = useState<StoryPart | null>(null);
  const [editPartContent, setEditPartContent] = useState('');
  const [editPartIsStarting, setEditPartIsStarting] = useState(false);
  const [editPartIsEnding, setEditPartIsEnding] = useState(false);
  const [savingPartEdit, setSavingPartEdit] = useState(false);

  // Edit choice modal state
  const [editChoiceModalVisible, setEditChoiceModalVisible] = useState(false);
  const [editingChoice, setEditingChoice] = useState<StoryChoice | null>(null);
  const [editChoiceText, setEditChoiceText] = useState('');
  const [editChoiceNextPartId, setEditChoiceNextPartId] = useState<string | null>(null);
  const [savingChoiceEdit, setSavingChoiceEdit] = useState(false);

  useEffect(() => {
    if (storyId) {
      loadStory();
    }
  }, [storyId]);

  // Real-time subscription for story reactions and ratings
  useEffect(() => {
    if (!storyId) return;

    const subscription = supabase
      .channel(`admin-story-reactions-${storyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'story_reactions',
          filter: `story_id=eq.${storyId}`,
        },
        async (payload) => {
          console.log('Admin story reaction change detected:', payload);
          // Reload story data to get updated reaction counts
          await loadStory();
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
          console.log('Admin story rating change detected:', payload);
          // Reload story data to get updated rating data
          await loadStory();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [storyId]);

  const loadStory = useCallback(async () => {
    try {
      setLoading(true);

      // Load story with author info
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select(`
          *,
          users!author_id(name)
        `)
        .eq('id', storyId)
        .single();

      if (storyError) throw storyError;

      // Get ratings for the story
      const { data: ratings, error: ratingsError } = await supabase
        .from('story_ratings')
        .select('rating')
        .eq('story_id', storyId);

      if (ratingsError) {
        console.error('Error fetching ratings for story:', storyId, ratingsError);
      }

      const totalRatings = ratings?.length || 0;
      const averageRating = totalRatings > 0
        ? ratings!.reduce((sum, r) => sum + r.rating, 0) / totalRatings
        : 0;

      // Get reactions
      const { data: reactions, error: reactionsError } = await supabase
        .from('story_reactions')
        .select('reaction_type')
        .eq('story_id', storyId);

      if (reactionsError) {
        console.error('Error fetching reactions for story:', storyId, reactionsError);
      }

      const likes = reactions?.filter(r => r.reaction_type === 'like').length || 0;
      const dislikes = reactions?.filter(r => r.reaction_type === 'dislike').length || 0;

      // Get admin's personal reaction
      const { data: adminReaction } = await supabase
        .from('story_reactions')
        .select('reaction_type')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      // Get admin's personal rating
      const { data: adminRating } = await supabase
        .from('story_ratings')
        .select('rating')
        .eq('user_id', user?.id)
        .eq('story_id', storyId)
        .single();

      const storyWithRating = {
        ...storyData,
        average_rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
        total_ratings: totalRatings,
        likes: likes,
        dislikes: dislikes,
        user_reaction: adminReaction?.reaction_type || null,
        user_rating: adminRating?.rating || null,
      };

      // Also load story parts
      const { data: parts, error: partsError } = await supabase
        .from('story_parts')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: true });

      if (partsError) {
        console.error('Error loading story parts:', partsError);
      }

      // Load choices for each part
      const partsWithChoices = await Promise.all(
        (parts || []).map(async (part) => {
          const { data: choices, error: choicesError } = await supabase
            .from('story_choices')
            .select('*')
            .eq('part_id', part.id)
            .order('order_index', { ascending: true });

          if (choicesError) {
            console.error('Error loading choices for part:', part.id, choicesError);
          }

          return {
            ...part,
            choices: choices || [],
          };
        })
      );

      setStory({ ...storyWithRating, story_parts: partsWithChoices });
    } catch (error) {
      console.error('Error loading story:', error);
      Alert.alert('Error', 'Failed to load story');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  const loadStoryParts = async (showSuccessMessage = false) => {
    try {
      console.log('loadStoryParts called for storyId:', storyId);

      // Load all parts
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

      setStory(prev => prev ? { ...prev, story_parts: partsWithChoices } : null);
      console.log('Story parts loaded and updated:', partsWithChoices.length, 'parts');

      if (showSuccessMessage) {
        Alert.alert('Success', 'Story parts refreshed successfully');
      }

      return partsWithChoices;
    } catch (error) {
      console.error('Error loading story parts:', error);
      Alert.alert('Error', 'Failed to load story parts');
      return [];
    }
  };

  const handleStoryAction = async (action: 'publish' | 'reject') => {
    if (!story) return;

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

      Alert.alert('Success', `Story ${action}ed successfully`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error(`Error ${action}ing story:`, error);
      Alert.alert('Error', `Failed to ${action} story`);
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

  const openAddChoiceModal = (partId: string) => {
    setSelectedPartId(partId);
    setChoiceText('');
    setSelectedNextPartId(null);
    setAddingChoice(false);
    setChoiceModalVisible(true);
  };

  const handleAddChoice = async () => {
    if (!selectedPartId || !choiceText.trim() || !story || addingChoice) return;

    try {
      setAddingChoice(true);

      const { error } = await supabase
        .from('story_choices')
        .insert({
          part_id: selectedPartId,
          choice_text: choiceText.trim(),
          next_part_id: selectedNextPartId,
          created_by: user?.id,
        });

      if (error) throw error;

      // Reload story parts
      await loadStoryParts();
      setChoiceModalVisible(false);
      setChoiceText('');
      setSelectedNextPartId(null);

      Alert.alert('Success', 'Choice added successfully');
    } catch (error) {
      console.error('Error adding choice:', error);
      Alert.alert('Error', 'Failed to add choice');
    } finally {
      setAddingChoice(false);
    }
  };

  const getPartDisplayName = (partId: string | null) => {
    if (!partId || !story?.story_parts) return 'End Story';
    const part = story.story_parts.find(p => p.id === partId);
    return part ? `"${part.content.substring(0, 30)}${part.content.length > 30 ? '...' : ''}"` : 'End Story';
  };

  const togglePartEnding = async (partId: string, isEnding: boolean) => {
    try {
      const { error } = await supabase
        .from('story_parts')
        .update({
          is_ending: isEnding,
          modified_by: user?.id,
          modified_at: new Date().toISOString(),
        })
        .eq('id', partId);

      if (error) throw error;

      // Log the change
      await supabase
        .from('story_audit_log')
        .insert({
          story_id: story?.id,
          part_id: partId,
          action: 'update',
          field_changed: 'is_ending',
          old_value: (!isEnding).toString(),
          new_value: isEnding.toString(),
          performed_by: user?.id,
        });

      // Reload story parts
      await loadStoryParts();

      Alert.alert('Success', `Part ${isEnding ? 'marked as ending' : 'unmarked as ending'}`);
    } catch (error) {
      console.error('Error toggling part ending:', error);
      Alert.alert('Error', 'Failed to update part');
    }
  };

  const editChoice = async (choice: StoryChoice) => {
    setEditingChoice(choice);
    setEditChoiceText(choice.choice_text);
    setEditChoiceNextPartId(choice.next_part_id);
    setEditChoiceModalVisible(true);
  };

  const handleSaveChoiceEdit = async () => {
    if (!editingChoice || !editChoiceText.trim()) {
      Alert.alert('Error', 'Please enter choice text');
      return;
    }

    try {
      setSavingChoiceEdit(true);

      const { error } = await supabase
        .from('story_choices')
        .update({
          choice_text: editChoiceText.trim(),
          next_part_id: editChoiceNextPartId,
          modified_by: user?.id,
          modified_at: new Date().toISOString(),
        })
        .eq('id', editingChoice.id);

      if (error) throw error;

      // Log the change
      await supabase
        .from('story_audit_log')
        .insert({
          story_id: story?.id,
          choice_id: editingChoice.id,
          action: 'update',
          field_changed: 'choice_text',
          old_value: editingChoice.choice_text,
          new_value: editChoiceText.trim(),
          performed_by: user?.id,
        });

      // Reload story parts
      await loadStoryParts();

      setEditChoiceModalVisible(false);
      setEditingChoice(null);
      Alert.alert('Success', 'Choice updated successfully');
    } catch (error) {
      console.error('Error updating choice:', error);
      Alert.alert('Error', 'Failed to update choice');
    } finally {
      setSavingChoiceEdit(false);
    }
  };

  const openAddPartModal = () => {
    setPartContent('');
    setPartModalVisible(true);
  };

  const openEditModal = () => {
    if (!story) return;
    setEditTitle(story.title);
    setEditDescription(story.description || '');
    setEditGenre(story.genre || '');
    setEditModalVisible(true);
  };

  const handleEditStory = async () => {
    if (!story || editing) return;

    if (!editTitle.trim()) {
      Alert.alert('Error', 'Please enter a story title');
      return;
    }

    try {
      setEditing(true);

      const { error } = await supabase
        .from('stories')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          genre: editGenre.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', story.id);

      if (error) throw error;

      // Log the changes
      if (story.title !== editTitle.trim()) {
        await supabase
          .from('story_audit_log')
          .insert({
            story_id: story.id,
            action: 'update',
            field_changed: 'title',
            old_value: story.title,
            new_value: editTitle.trim(),
            performed_by: user?.id,
          });
      }

      if ((story.description || '') !== editDescription.trim()) {
        await supabase
          .from('story_audit_log')
          .insert({
            story_id: story.id,
            action: 'update',
            field_changed: 'description',
            old_value: story.description || '',
            new_value: editDescription.trim(),
            performed_by: user?.id,
          });
      }

      if ((story.genre || '') !== editGenre.trim()) {
        await supabase
          .from('story_audit_log')
          .insert({
            story_id: story.id,
            action: 'update',
            field_changed: 'genre',
            old_value: story.genre || '',
            new_value: editGenre.trim(),
            performed_by: user?.id,
          });
      }

      setEditModalVisible(false);
      setEditTitle('');
      setEditDescription('');
      setEditGenre('');

      // Reload story data
      await loadStory();

      Alert.alert('Success', 'Story updated successfully');
    } catch (error) {
      console.error('Error updating story:', error);
      Alert.alert('Error', 'Failed to update story');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteStory = (story: any) => {
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

              Alert.alert('Success', 'Story deleted successfully', [
                { text: 'OK', onPress: () => router.back() }
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

  const handleEditPart = (part: StoryPart) => {
    setEditingPart(part);
    setEditPartContent(part.content);
    setEditPartIsStarting(part.is_start);
    setEditPartIsEnding(part.is_ending);
    setEditPartModalVisible(true);
  };

  const handleSavePartEdit = async () => {
    if (!editingPart || !editPartContent.trim()) {
      Alert.alert('Error', 'Please enter content for the story part');
      return;
    }

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

      // Log the change
      await supabase
        .from('story_audit_log')
        .insert({
          story_id: story?.id,
          part_id: editingPart.id,
          action: 'update',
          field_changed: 'content',
          old_value: editingPart.content,
          new_value: editPartContent.trim(),
          performed_by: user?.id,
        });

      // Reload story parts
      await loadStoryParts();

      setEditPartModalVisible(false);
      setEditingPart(null);
      Alert.alert('Success', 'Story part updated successfully');
    } catch (error) {
      console.error('Error updating story part:', error);
      Alert.alert('Error', 'Failed to update story part');
    } finally {
      setSavingPartEdit(false);
    }
  };

  const handleDeletePart = (part: any) => {
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
                  story_id: story?.id,
                  part_id: part.id,
                  action: 'delete_part',
                  field_changed: 'content',
                  old_value: part.content,
                  performed_by: user?.id,
                });

              // Reload story parts
              await loadStoryParts();

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

  const handleAddPart = async () => {
    if (!partContent.trim()) {
      Alert.alert('Error', 'Please enter content for the story part');
      return;
    }

    if (!story || addingPart) return;

    try {
      setAddingPart(true);
      // Check if this is the first part
      const hasNoParts = !story.story_parts || story.story_parts.length === 0;
      const shouldMarkAsStart = hasNoParts; // First part should be starting

      const { data: partData, error: partError } = await supabase
        .from('story_parts')
        .insert({
          story_id: story.id,
          content: partContent.trim(),
          is_start: shouldMarkAsStart,
          is_ending: false,
          created_by: user?.id,
        })
        .select()
        .single();

      if (partError) throw partError;

      // Log the addition
      await supabase
        .from('story_audit_log')
        .insert({
          story_id: story.id,
          part_id: partData.id,
          action: 'create',
          field_changed: 'content',
          new_value: partContent.trim(),
          performed_by: user?.id,
        });

      setPartModalVisible(false);
      setPartContent('');

      // Reload story parts
      await loadStoryParts();

      Alert.alert('Success', 'Story part added successfully');
    } catch (error) {
      console.error('Error adding story part:', error);
      Alert.alert('Error', 'Failed to add story part');
    } finally {
      setAddingPart(false);
    }
  };

  const addFirstPart = async () => {
    if (!story) return;

    Alert.prompt(
      'Add First Story Part',
      'Enter the content for the first part of the story:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (content: string | undefined) => {
            if (!content?.trim()) return;

            try {
              const { data: partData, error: partError } = await supabase
                .from('story_parts')
                .insert({
                  story_id: story.id,
                  content: content.trim(),
                  is_start: true,
                  is_ending: false,
                  created_by: user?.id,
                })
                .select()
                .single();

              if (partError) throw partError;

              // Create a default choice
              const { error: choiceError } = await supabase
                .from('story_choices')
                .insert({
                  part_id: partData.id,
                  choice_text: 'Continue reading...',
                  next_part_id: null,
                  order_index: 0,
                  created_by: user?.id,
                });

              if (choiceError) {
                console.error('Error creating default choice:', choiceError);
              }

              // Log the addition
              await supabase
                .from('story_audit_log')
                .insert({
                  story_id: story.id,
                  part_id: partData.id,
                  action: 'create',
                  field_changed: 'content',
                  new_value: content.trim(),
                  performed_by: user?.id,
                });

              // Reload story parts
              await loadStoryParts();

              Alert.alert('Success', 'First story part created successfully');
            } catch (error) {
              console.error('Error creating first part:', error);
              Alert.alert('Error', 'Failed to create first story part');
            }
          }
        }
      ],
      'plain-text',
      `Welcome to "${story.title}"!\n\nThis is the beginning of your interactive story. Click the choices below to continue your adventure.`
    );
  };

  const deleteChoice = async (choice: StoryChoice) => {
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
                  story_id: story?.id,
                  choice_id: choice.id,
                  action: 'delete',
                  field_changed: 'choice_text',
                  old_value: choice.choice_text,
                  performed_by: user?.id,
                });

              // Reload story parts
              await loadStoryParts();

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

  const handleAdminReaction = async (reactionType: 'like' | 'dislike') => {
    if (!user?.id || !story) return;

    try {
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
          user_reaction: null
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
      console.error('Error handling admin reaction:', error);
      Alert.alert('Error', 'Failed to update reaction');
    }
  };

  const handleAdminRating = async (rating: number) => {
    if (!user?.id || !story) return;

    try {
      if (story.user_rating === rating) {
        // Remove rating
        const { error } = await supabase
          .from('story_ratings')
          .delete()
          .eq('user_id', user.id)
          .eq('story_id', story.id);

        if (error) throw error;

        // Update local state
        setStory(prev => prev ? {
          ...prev,
          total_ratings: Math.max(0, (prev.total_ratings || 0) - 1),
          average_rating: (prev.total_ratings || 0) > 1
            ? ((prev.average_rating || 0) * (prev.total_ratings || 0) - rating) / ((prev.total_ratings || 0) - 1)
            : 0,
          user_rating: null
        } : null);
      } else {
        // Upsert rating
        const { error } = await supabase
          .from('story_ratings')
          .upsert({
            user_id: user.id,
            story_id: story.id,
            rating: rating
          }, {
            onConflict: 'user_id,story_id'
          });

        if (error) throw error;

        // Update local state
        const wasRated = story.user_rating !== null;
        const oldRating = story.user_rating || 0;
        const newTotal = wasRated ? (story.total_ratings || 0) : (story.total_ratings || 0) + 1;
        const newAverage = wasRated
          ? ((story.average_rating || 0) * (story.total_ratings || 0) - oldRating + rating) / (story.total_ratings || 0)
          : ((story.average_rating || 0) * (story.total_ratings || 0) + rating) / newTotal;

        setStory(prev => prev ? {
          ...prev,
          total_ratings: newTotal,
          average_rating: Math.round(newAverage * 10) / 10,
          user_rating: rating
        } : null);
      }
    } catch (error) {
      console.error('Error handling admin rating:', error);
      Alert.alert('Error', 'Failed to update rating');
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C4A574" />
          <Text style={styles.loadingText}>Loading story...</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.storiesButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
          <Text style={styles.storiesButtonText}>Stories</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Review: {story.title}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={openEditModal}
          >
            <IconSymbol name="pencil" size={20} color="#C4A574" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleDeleteStory(story)}
          >
            <IconSymbol name="trash.fill" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Story Info */}
        <View style={styles.storyInfo}>
          <Text style={styles.storyTitle}>{story.title}</Text>
          <Text style={styles.storyAuthor}>by {story.users.name}</Text>
          {story.description && (
            <Text style={styles.storyDescription}>{story.description}</Text>
          )}
          <View style={styles.storyMeta}>
            <Text style={styles.metaText}>Genre: {story.genre || 'N/A'}</Text>
            <Text style={styles.metaText}>
              Submitted: {story.submitted_at ? new Date(story.submitted_at).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <IconSymbol
                  key={star}
                  name={star <= Math.floor(story.average_rating) ? "star.fill" : star <= story.average_rating ? "star.leadinghalf.filled" : "star"}
                  size={16}
                  color="#FFD700"
                />
              ))}
            </View>
            <Text style={styles.ratingText}>
              {story.average_rating > 0 ? `${story.average_rating.toFixed(1)} (${story.total_ratings} ratings)` : 'No ratings yet'}
            </Text>
          </View>
        </View>

        {/* Your Interactions */}
        <View style={styles.adminInteractions}>
          <Text style={styles.interactionsTitle}>Your Interactions:</Text>

          {/* Reaction Buttons */}
          <View style={styles.reactionButtons}>
            <TouchableOpacity
              style={[
                styles.reactionButton,
                styles.likeButton,
                story.user_reaction === 'like' && styles.reactionButtonActive
              ]}
              onPress={() => handleAdminReaction('like')}
            >
              <Text style={{ fontSize: 16, marginRight: 4 }}>👍</Text>
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
              onPress={() => handleAdminReaction('dislike')}
            >
              <Text style={{ fontSize: 16, marginRight: 4 }}>👎</Text>
              <Text style={[
                styles.reactionText,
                story.user_reaction === 'dislike' && styles.reactionTextActive
              ]}>
                {story.dislikes || 0}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rating Buttons */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Your Rating:</Text>
            <View style={styles.adminRatingButtons}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleAdminRating(star)}
                  style={styles.ratingButton}
                >
                  <IconSymbol
                    name={story.user_rating && story.user_rating >= star ? "star.fill" : "star"}
                    size={20}
                    color={story.user_rating && story.user_rating >= star ? "#FFD700" : "#8E8E93"}
                  />
                </TouchableOpacity>
              ))}
            </View>
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
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.publishButton]}
            onPress={() => handleStoryAction('publish')}
          >
            <Text style={styles.actionButtonText}>Publish</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleStoryAction('reject')}
          >
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>

        {/* Load Parts Button */}
        {/* Story Parts */}
        {story.story_parts ? (
          story.story_parts.length > 0 ? (
            <View style={styles.partsSection}>
              <View style={styles.partsHeader}>
                <Text style={styles.partsTitle}>Story Parts & Choices:</Text>
              </View>
              {story.story_parts.map((part) => (
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
                    {part.is_start && <Text style={styles.badge}>Start</Text>}
                    {part.is_ending && <Text style={styles.badge}>End</Text>}
                  </View>
                </View>

                <View style={styles.partActions}>
                  <TouchableOpacity
                    style={styles.partActionButtonSmall}
                    onPress={() => handleEditPart(part)}
                  >
                    <IconSymbol name="pencil" size={16} color="#2196F3" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.partActionButtonSmall}
                    onPress={() => handleDeletePart(part)}
                  >
                    <IconSymbol name="trash.fill" size={16} color="#F44336" />
                  </TouchableOpacity>
                  {!part.is_start && (
                    <TouchableOpacity
                      style={[styles.partActionButton, part.is_ending && styles.partActionButtonActive]}
                      onPress={() => togglePartEnding(part.id, !part.is_ending)}
                    >
                      <Text style={[styles.partActionButtonText, part.is_ending && styles.partActionButtonTextActive]}>
                        {part.is_ending ? 'Remove End' : 'Mark as End'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.choicesSection}>
                  <View style={styles.choicesHeader}>
                    <Text style={styles.choicesTitle}>Choices:</Text>
                    <TouchableOpacity
                      style={styles.addChoiceButton}
                      onPress={() => openAddChoiceModal(part.id)}
                    >
                      <IconSymbol name="plus" size={16} color="#C4A574" />
                      <Text style={styles.addChoiceText}>Add Choice</Text>
                    </TouchableOpacity>
                  </View>

                  {part.choices && part.choices.length > 0 ? (
                    part.choices.map((choice) => (
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
                        <View style={styles.choiceActions}>
                          <TouchableOpacity
                            style={styles.editChoiceButton}
                            onPress={() => editChoice(choice)}
                          >
                            <IconSymbol name="pencil" size={16} color="#2196F3" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteChoiceButton}
                            onPress={() => deleteChoice(choice)}
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
            ))}
          </View>
          ) : (
            <View style={styles.noPartsContainer}>
              <Text style={styles.noPartsText}>No story parts found. This story needs an initial part to begin.</Text>
              <TouchableOpacity
                style={styles.addFirstPartButton}
                onPress={openAddPartModal}
              >
                <IconSymbol name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.addFirstPartButtonText}>Add First Story Part</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading story parts...</Text>
          </View>
        )}

        {/* Add Part and Refresh buttons below the parts section */}
        {story?.story_parts && story.story_parts.length > 0 && (
          <View style={styles.partsActions}>
            <TouchableOpacity
              style={styles.addPartButton}
              onPress={openAddPartModal}
            >
              <IconSymbol name="plus" size={16} color="#C4A574" />
              <Text style={styles.addPartText}>Add Part</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => loadStoryParts(true)}
            >
              <IconSymbol name="arrow.clockwise" size={16} color="#C4A574" />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Choice Modal */}
      <Modal
        visible={choiceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setChoiceModalVisible(false);
          setAddingChoice(false);
        }}
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
              <ScrollView style={styles.partsList} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.partOption, selectedNextPartId === null && styles.selectedPartOption]}
                  onPress={() => setSelectedNextPartId(null)}
                >
                  <Text style={[styles.partOptionText, selectedNextPartId === null && styles.selectedPartOptionText]}>
                    End Story
                  </Text>
                </TouchableOpacity>
                {story?.story_parts?.filter(part => part.id !== selectedPartId).map((part) => (
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
                onPress={() => {
                  setChoiceModalVisible(false);
                  setAddingChoice(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, addingChoice && styles.disabledButton]}
                onPress={handleAddChoice}
                disabled={addingChoice}
              >
                {addingChoice ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Choice</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Part Modal */}
      <Modal
        visible={partModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Story Part</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Part Content *</Text>
              <TextInput
                style={[styles.modalTextInput, { height: 120, textAlignVertical: 'top' }]}
                value={partContent}
                onChangeText={setPartContent}
                placeholder="Enter the content for the new story part..."
                placeholderTextColor="#8E8E93"
                multiline={true}
                numberOfLines={6}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setPartModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, addingPart && styles.disabledButton]}
                onPress={handleAddPart}
                disabled={addingPart}
              >
                {addingPart ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Part</Text>
                )}
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
                style={[styles.modalButton, styles.saveButton, editing && styles.disabledButton]}
                onPress={handleEditStory}
                disabled={editing}
              >
                {editing ? (
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
                        <View style={styles.userInfoContainer}>
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
                        <View style={styles.userInfoContainer}>
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
        <View style={styles.modalOverlay}>
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
                {editPartIsStarting && <Text style={{ fontSize: 16, color: '#C4A574' }}>✓</Text>}
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
                {editPartIsEnding && <Text style={{ fontSize: 16, color: '#C4A574' }}>✓</Text>}
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
        </View>
      </Modal>

      {/* Edit Choice Modal */}
      <Modal
        visible={editChoiceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditChoiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Choice</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Choice Text *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editChoiceText}
                onChangeText={setEditChoiceText}
                placeholder="Enter the choice text..."
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Links to Part</Text>
              <ScrollView style={styles.partsList} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.partOption, editChoiceNextPartId === null && styles.selectedPartOption]}
                  onPress={() => setEditChoiceNextPartId(null)}
                >
                  <Text style={[styles.partOptionText, editChoiceNextPartId === null && styles.selectedPartOptionText]}>
                    End Story
                  </Text>
                </TouchableOpacity>
                {story?.story_parts?.filter(part => part.id !== editingChoice?.part_id).map((part) => (
                  <TouchableOpacity
                    key={part.id}
                    style={[styles.partOption, editChoiceNextPartId === part.id && styles.selectedPartOption]}
                    onPress={() => setEditChoiceNextPartId(part.id)}
                  >
                    <Text style={[styles.partOptionText, editChoiceNextPartId === part.id && styles.selectedPartOptionText]}>
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
                onPress={() => {
                  setEditChoiceModalVisible(false);
                  setEditChoiceText('');
                  setEditChoiceNextPartId(null);
                  setEditingChoice(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, savingChoiceEdit && styles.disabledButton]}
                onPress={handleSaveChoiceEdit}
                disabled={savingChoiceEdit}
              >
                {savingChoiceEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Update Choice</Text>
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
  errorText: {
    color: '#E8D5B7',
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#C4A574',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  backText: {
    color: '#C4A574',
    fontSize: 14,
  },
  storiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  storiesButtonText: {
    color: '#E8D5B7',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  headerRight: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  storyInfo: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  storyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8D5B7',
    marginBottom: 8,
  },
  storyAuthor: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
  storyDescription: {
    fontSize: 14,
    color: '#E8D5B7',
    lineHeight: 20,
    marginBottom: 12,
  },
  storyMeta: {
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#E8D5B7',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  publishButton: {
    backgroundColor: '#2196F3',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadPartsButton: {
    backgroundColor: '#C4A574',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  loadPartsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  partsSection: {
    marginBottom: 20,
  },
  partsTitle: {
    fontSize: 18,
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
  choiceTextContainer: {
    flex: 1,
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
  partsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  partsActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    paddingBottom: 40, // Extra padding for mobile navigation
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
  },
  addPartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addPartText: {
    color: '#C4A574',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshText: {
    color: '#C4A574',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  noPartsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noPartsText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  addFirstPartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C4A574',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstPartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  choiceContent: {
    flex: 1,
  },
  choiceLink: {
    fontSize: 12,
    color: '#C4A574',
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 120, // Extra padding for mobile navigation
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
  partsList: {
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
  submitButton: {
    backgroundColor: '#C4A574',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  partActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  partActionButton: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C4A574',
  },
  partActionButtonSmall: {
    backgroundColor: '#2C2C2E',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C4A574',
    marginRight: 8,
  },
  partActionButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  partActionButtonText: {
    color: '#C4A574',
    fontSize: 12,
    fontWeight: '600',
  },
  partActionButtonTextActive: {
    color: '#FFFFFF',
  },

  // Admin Interactions Styles
  adminInteractions: {
    marginTop: 16,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
  },
  interactionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 12,
  },
  reactionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  reactionTextActive: {
    color: '#FFFFFF',
  },
  ratingSection: {
    gap: 8,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#C4A574',
    fontWeight: '500',
  },
  adminRatingButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingButton: {
    padding: 4,
  },
  viewLinksContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
  },
  viewLink: {
    flex: 1,
  },
  viewLinkText: {
    fontSize: 13,
    color: '#C4A574',
    textAlign: 'center',
  },

  // Modal styles for reactions and ratings
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
  timestampText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 12,
  },
  starIcon: {
    fontSize: 16,
    color: '#3A3A3C',
  },
  starFilled: {
    color: '#FFD60A',
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
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  userInfoContainer: {
    flex: 1,
  },
});
