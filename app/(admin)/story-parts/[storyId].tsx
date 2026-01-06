import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/src/config/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StoryChoice {
  id: string;
  choice_text: string;
  next_part_id: string | null;
  order_index: number;
}

interface StoryPart {
  id: string;
  content: string;
  is_start: boolean;
  is_ending: boolean;
  created_at: string;
  created_by?: string;
  modified_by?: string;
  modified_at?: string;
  choices?: StoryChoice[];
}

interface Story {
  id: string;
  title: string;
  description: string;
  author_id: string;
  is_published: boolean;
  submitted_at?: string;
  story_parts?: StoryPart[];
}

export default function AdminStoryPartsScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { storyId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [addPartModalVisible, setAddPartModalVisible] = useState(false);
  const [partContent, setPartContent] = useState('');
  const [isStartingScene, setIsStartingScene] = useState(false);
  const [isEndingScene, setIsEndingScene] = useState(false);
  const [isFirstPart, setIsFirstPart] = useState(false);
  const [editingPart, setEditingPart] = useState<StoryPart | null>(null);
  const [saving, setSaving] = useState(false);

  // Choice management state
  const [addChoiceModalVisible, setAddChoiceModalVisible] = useState(false);
  const [selectedPartForChoice, setSelectedPartForChoice] = useState<StoryPart | null>(null);
  const [editingChoice, setEditingChoice] = useState<StoryChoice | null>(null);
  const [choiceText, setChoiceText] = useState('');
  const [nextPartId, setNextPartId] = useState<string | null>(null);

  // Choice expansion state for View More/Less functionality
  const [expandedChoices, setExpandedChoices] = useState<Set<string>>(new Set());

  const loadStory = useCallback(async () => {
    if (!storyId || !user?.id) return;

    try {
      setLoading(true);

      // Load story with parts and choices - allow admin to access any story
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select(`
          *,
          story_parts(*, created_by, modified_by, modified_at, choices:story_choices!story_choices_part_id_fkey(*))
        `)
        .eq('id', storyId)
        .single();

      if (storyError) throw storyError;

      setStory(storyData);
    } catch (error) {
      console.error('Error loading story:', error);
      Alert.alert('Error', 'Failed to load story');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [storyId, user?.id]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  const handleAddPart = () => {
    setPartContent('');
    setIsStartingScene(false);
    setIsEndingScene(false);
    setEditingPart(null);
    // Automatically set as starting scene if this is the first part
    const hasNoParts = !story?.story_parts || story.story_parts.length === 0;
    setIsFirstPart(hasNoParts);
    setIsStartingScene(hasNoParts);
    setAddPartModalVisible(true);
  };

  const handleEditPart = (part: StoryPart) => {
    setPartContent(part.content);
    setIsStartingScene(part.is_start);
    setIsEndingScene(part.is_ending);
    setIsFirstPart(false);
    setEditingPart(part);
    setAddPartModalVisible(true);
  };

  const handleDeletePart = (part: StoryPart) => {
    Alert.alert(
      'Delete Story Part',
      `Are you sure you want to delete this story part? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('story_parts')
                .delete()
                .eq('id', part.id);

              if (error) throw error;

              await loadStory(); // Reload to update the list
              Alert.alert('Success', 'Story part deleted successfully');
            } catch (error) {
              console.error('Error deleting part:', error);
              Alert.alert('Error', 'Failed to delete story part');
            }
          },
        },
      ]
    );
  };

  const handleSavePart = async () => {
    if (!story || !partContent.trim()) {
      Alert.alert('Error', 'Please enter content for the story part');
      return;
    }

    // If marking as starting scene, check if another part is already starting (but allow editing the current one)
    if (isStartingScene && story.story_parts?.some(part => part.is_start && part.id !== editingPart?.id)) {
      Alert.alert('Error', 'Only one part can be marked as the starting scene');
      return;
    }

    // Multiple ending scenes are allowed for branching story endings

    // Store current modal state for optimistic updates
    const currentContent = partContent.trim();
    const currentIsStarting = isStartingScene;
    const currentIsEnding = isEndingScene;

    try {
      setSaving(true);

      const partData = {
        content: currentContent,
        is_start: currentIsStarting,
        is_ending: currentIsEnding,
        modified_by: user?.id,
        modified_at: new Date().toISOString(),
      };

      let newPart;

      if (editingPart) {
        // Update existing part
        const { data, error } = await supabase
          .from('story_parts')
          .update(partData)
          .eq('id', editingPart.id)
          .select()
          .single();

        if (error) throw error;

        newPart = data;
        Alert.alert('Success', 'Story part updated successfully');
      } else {
        // Create new part
        const { data, error } = await supabase
          .from('story_parts')
          .insert({
            story_id: story.id,
            ...partData,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        newPart = data;
        Alert.alert('Success', 'Story part added successfully');
      }

      // Close modal first to prevent flickering
      setAddPartModalVisible(false);

      // Use setTimeout to allow modal animation to complete before updating state
      // This prevents layout conflicts that can affect scroll indicator calculation
      setTimeout(() => {
        // Update local state after modal has fully closed
        setStory(prev => {
          if (!prev) return prev;

          if (editingPart) {
            // Update existing part
            return {
              ...prev,
              story_parts: prev.story_parts?.map(part =>
                part.id === editingPart.id ? { ...part, ...newPart } : part
              ) || []
            };
          } else {
            // Add new part
            return {
              ...prev,
              story_parts: [...(prev.story_parts || []), newPart]
            };
          }
        });

        // Reset form state
        setPartContent('');
        setIsStartingScene(false);
        setIsEndingScene(false);
        setEditingPart(null);
      }, 350); // Slightly longer delay to ensure smooth transitions

    } catch (error) {
      console.error('Error saving part:', error);
      Alert.alert('Error', `Failed to ${editingPart ? 'update' : 'save'} story part`);

      // If there's an error, reload the data to ensure consistency
      loadStory();
    } finally {
      setSaving(false);
    }
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

  const getPartDisplayName = (partId: string | null) => {
    if (!partId || !story?.story_parts) return 'End Story';
    const part = story.story_parts.find(p => p.id === partId);
    return part ? `"${part.content.substring(0, 30)}${part.content.length > 30 ? '...' : ''}"` : 'End Story';
  };

  const canPublishStory = () => {
    if (!story?.story_parts || story.story_parts.length === 0) return false;
    return story.story_parts.some(part => part.is_start);
  };

  const handlePublishStory = async () => {
    if (!story) return;

    if (!canPublishStory()) {
      Alert.alert('Cannot Publish', 'You must have at least one story part marked as the starting scene before publishing.');
      return;
    }

    try {
      const { error } = await supabase
        .from('stories')
        .update({
          is_published: true,
          submitted_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', story.id);

      if (error) throw error;

      Alert.alert(
        'Story Published',
        'Your story has been published and is now live!',
        [
          {
            text: 'Back to Management',
            onPress: () => router.replace('../../(tabs)/story-management' as any)
          }
        ]
      );
    } catch (error) {
      console.error('Error publishing story:', error);
      Alert.alert('Error', 'Failed to publish story');
    }
  };

  const handleSubmitForReview = async () => {
    if (!story) return;

    if (!canPublishStory()) {
      Alert.alert('Cannot Submit', 'You must have at least one story part marked as the starting scene before submitting for review.');
      return;
    }

    try {
      const { error } = await supabase
        .from('stories')
        .update({
          submitted_at: new Date().toISOString()
        })
        .eq('id', story.id);

      if (error) throw error;

      Alert.alert(
        'Submitted for Review',
        'Your story has been submitted for admin review. You will be notified once it\'s published.',
        [
          {
            text: 'Back to Management',
            onPress: () => router.replace('../../(tabs)/story-management' as any)
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting for review:', error);
      Alert.alert('Error', 'Failed to submit for review');
    }
  };

  const handleAddChoice = (part: StoryPart) => {
    setSelectedPartForChoice(part);
    setChoiceText('');
    setNextPartId(null);
    setEditingChoice(null);
    setAddChoiceModalVisible(true);
  };

  const handleEditChoice = (part: StoryPart, choice: StoryChoice) => {
    setSelectedPartForChoice(part);
    setChoiceText(choice.choice_text);
    setNextPartId(choice.next_part_id);
    setEditingChoice(choice);
    setAddChoiceModalVisible(true);
  };

  const handleDeleteChoice = (choice: StoryChoice) => {
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

              await loadStory();
              Alert.alert('Success', 'Choice deleted successfully');
            } catch (error) {
              console.error('Error deleting choice:', error);
              Alert.alert('Error', 'Failed to delete choice');
            }
          },
        },
      ]
    );
  };

  const handleSaveChoice = async () => {
    if (!selectedPartForChoice || !choiceText.trim()) {
      Alert.alert('Error', 'Please enter choice text');
      return;
    }

    try {
      setSaving(true);

      const choiceData = {
        choice_text: choiceText.trim(),
        next_part_id: nextPartId,
        order_index: editingChoice ? editingChoice.order_index : (selectedPartForChoice.choices?.length || 0),
      };

      if (editingChoice) {
        // Update existing choice
        const { error } = await supabase
          .from('story_choices')
          .update(choiceData)
          .eq('id', editingChoice.id);

        if (error) throw error;
        Alert.alert('Success', 'Choice updated successfully');
      } else {
        // Create new choice
        const { error } = await supabase
          .from('story_choices')
          .insert({
            part_id: selectedPartForChoice.id,
            ...choiceData,
          });

        if (error) throw error;
        Alert.alert('Success', 'Choice added successfully');
      }

      setAddChoiceModalVisible(false);
      setChoiceText('');
      setNextPartId(null);
      setEditingChoice(null);
      loadStory(); // Reload to show the updated choices
    } catch (error) {
      console.error('Error saving choice:', error);
      Alert.alert('Error', `Failed to ${editingChoice ? 'update' : 'save'} choice`);
    } finally {
      setSaving(false);
    }
  };

  const renderStoryPart = ({ item }: { item: StoryPart }) => (
    <View style={styles.partCard}>
      <View style={styles.partHeader}>
        <Text style={styles.partContent} numberOfLines={3}>
          {item.content}
        </Text>
        <View style={styles.partBadges}>
          {item.is_start && (
            <View style={styles.startBadge}>
              <Text style={styles.startBadgeText}>Start</Text>
            </View>
          )}
          {item.is_ending && (
            <View style={styles.endBadge}>
              <Text style={styles.endBadgeText}>End</Text>
            </View>
          )}
        </View>
      </View>

      {/* Choices Section */}
      <View style={styles.choicesSection}>
        <View style={styles.choicesHeader}>
          <Text style={styles.choicesTitle}>Choices:</Text>
          <TouchableOpacity
            style={styles.addChoiceButton}
            onPress={() => handleAddChoice(item)}
          >
            <IconSymbol name="plus" size={16} color="#4CAF50" />
            <Text style={styles.addChoiceText}>Add Choice</Text>
          </TouchableOpacity>
        </View>

        {item.choices && item.choices.length > 0 ? (
          item.choices
            .sort((a, b) => a.order_index - b.order_index)
            .map((choice) => (
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
                    onPress={() => handleEditChoice(item, choice)}
                  >
                    <IconSymbol name="pencil" size={16} color="#2196F3" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteChoiceButton}
                    onPress={() => handleDeleteChoice(choice)}
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

      <View style={styles.partActions}>
        <TouchableOpacity
          style={styles.addChoiceButton}
          onPress={() => handleAddChoice(item)}
        >
          <IconSymbol name="plus" size={16} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editPartButton}
          onPress={() => handleEditPart(item)}
        >
          <IconSymbol name="pencil" size={16} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deletePartButton}
          onPress={() => handleDeletePart(item)}
        >
          <IconSymbol name="trash.fill" size={16} color="#F44336" />
        </TouchableOpacity>
      </View>

      <Text style={styles.partDate}>
        Created {new Date(item.created_at).toLocaleDateString()}
        {item.modified_at && (
          <Text style={styles.modifiedText}>
            {' • '}Modified {new Date(item.modified_at).toLocaleDateString()}
          </Text>
        )}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
        <Text style={styles.loadingText}>Loading story...</Text>
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Story not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('../../(tabs)/story-management' as any)}
        >
          <IconSymbol name="chevron.left" size={24} color="#C4A574" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{story.title}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Story Parts</Text>

        {(!story.story_parts || story.story_parts.length === 0) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No story parts yet</Text>
            <Text style={styles.emptyText}>
              Add your first story part to begin building your interactive story.
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={handleAddPart}>
              <IconSymbol name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add First Part</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={story.story_parts}
              renderItem={renderStoryPart}
              keyExtractor={(item) => item.id}
              style={styles.partsList}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.addButton} onPress={handleAddPart}>
                <IconSymbol name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Part</Text>
              </TouchableOpacity>

              {canPublishStory() && (
                <View style={styles.publishActions}>
                  <TouchableOpacity
                    style={styles.publishButton}
                    onPress={handlePublishStory}
                  >
                    <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.publishButtonText}>Publish Story</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitReviewButton}
                    onPress={handleSubmitForReview}
                  >
                    <IconSymbol name="paperplane" size={20} color="#FFFFFF" />
                    <Text style={styles.submitReviewButtonText}>Submit to Review</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </View>

      {/* Add Part Modal */}
      <Modal
        visible={addPartModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAddPartModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingPart ? 'Edit Story Part' : 'Add Story Part'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={styles.contentInput}
                value={partContent}
                onChangeText={setPartContent}
                placeholder="Enter the scene content..."
                placeholderTextColor="#8E8E93"
                multiline={true}
                numberOfLines={8}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, isFirstPart && styles.checkboxDisabled]}
                onPress={() => !isFirstPart && setIsStartingScene(!isStartingScene)}
                disabled={isFirstPart}
              >
                {isStartingScene && <IconSymbol name="checkmark" size={16} color="#C4A574" />}
              </TouchableOpacity>
              <Text style={[styles.checkboxLabel, isFirstPart && styles.checkboxLabelDisabled]}>
                Mark as Starting Scene {isFirstPart && '(Auto-set for first part)'}
              </Text>
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setIsEndingScene(!isEndingScene)}
              >
                {isEndingScene && <IconSymbol name="checkmark" size={16} color="#C4A574" />}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                Mark as Ending Scene
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setAddPartModalVisible(false);
                  // Reset form state with a small delay to allow modal animation to complete
                  setTimeout(() => {
                    setPartContent('');
                    setIsStartingScene(false);
                    setIsEndingScene(false);
                    setEditingPart(null);
                  }, 300);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.disabledButton]}
                onPress={handleSavePart}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingPart ? 'Update Part' : 'Save Part'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Choice Modal */}
      <Modal
        visible={addChoiceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setAddChoiceModalVisible(false);
          setSaving(false);
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
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Links to Part</Text>
              <ScrollView
                style={styles.modalPartsList}
                showsVerticalScrollIndicator={false}
              >
                <TouchableOpacity
                  style={[styles.partOption, nextPartId === null && styles.selectedPartOption]}
                  onPress={() => setNextPartId(null)}
                >
                  <Text style={[styles.partOptionText, nextPartId === null && styles.selectedPartOptionText]}>
                    End Story
                  </Text>
                </TouchableOpacity>
                {story?.story_parts?.filter(part => part.id !== selectedPartForChoice?.id).map((part) => (
                  <TouchableOpacity
                    key={part.id}
                    style={[styles.partOption, nextPartId === part.id && styles.selectedPartOption]}
                    onPress={() => setNextPartId(part.id)}
                  >
                    <Text style={[styles.partOptionText, nextPartId === part.id && styles.selectedPartOptionText]}>
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
                  setAddChoiceModalVisible(false);
                  setChoiceText('');
                  setNextPartId(null);
                  setEditingChoice(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.disabledButton]}
                onPress={handleSaveChoice}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Choice</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  loadingText: {
    color: '#C4A574',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#C4A574',
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
    fontSize: 16,
    marginLeft: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#E8D5B7',
  },
  headerRight: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 120, // Extra padding for mobile navigation
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8D5B7',
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C4A574',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C4A574',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  partsList: {
    flex: 1,
  },
  partCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  partHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  partContent: {
    flex: 1,
    fontSize: 16,
    color: '#E8D5B7',
    lineHeight: 22,
  },
  partBadges: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
  },
  startBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  startBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  endBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  endBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  partActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  editPartButton: {
    backgroundColor: '#2C2C2E',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  deletePartButton: {
    backgroundColor: '#2C2C2E',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  partDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  modifiedText: {
    color: '#8E8E93',
  },
  actionButtons: {
    marginTop: 20,
    marginBottom: 40, // Extra margin for mobile navigation
    gap: 12,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: 'center',
    gap: 8,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  publishActions: {
    gap: 12,
  },
  submitReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: 'center',
    gap: 8,
  },
  submitReviewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  choicesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
  },
  choicesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C4A574',
    marginBottom: 8,
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
    flex: 1,
    fontSize: 14,
    color: '#E8D5B7',
  },
  choiceContent: {
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
  choiceLink: {
    fontSize: 12,
    color: '#C4A574',
    fontStyle: 'italic',
    marginTop: 4,
  },
  choiceActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  choicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addChoiceText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  editChoiceButton: {
    backgroundColor: '#2C2C2E',
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  deleteChoiceButton: {
    backgroundColor: '#2C2C2E',
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  noChoicesText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
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
  contentInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalTextInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  },
  checkboxDisabled: {
    backgroundColor: '#2C2C2E',
    opacity: 0.7,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#E8D5B7',
  },
  checkboxLabelDisabled: {
    color: '#8E8E93',
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
  saveButton: {
    backgroundColor: '#C4A574',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
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
});
